import json
from pathlib import Path
import pytest
from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

def piece(**over):
    base = {"slug": "feliz", "group": "expressions", "prefix": "Doty beaming with joy",
            "prompt": "big smile", "size": 1024, "mascot": True, "done": False}
    base.update(over)
    return base

def write(tmp_path, name, data):
    p = tmp_path / name
    p.write_text(json.dumps(data), encoding="utf-8")
    return p

def test_load_catalog_ok(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "fase-1", "pieces": [piece()]})
    cat = mjlib.load_catalog(p)
    assert cat["pieces"][0]["slug"] == "feliz"

def test_duplicate_slug_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(), piece(prefix="Other words")]})
    with pytest.raises(mjlib.CatalogError, match="slug"):
        mjlib.load_catalog(p)

def test_duplicate_prefix_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(), piece(slug="otro")]})
    with pytest.raises(mjlib.CatalogError, match="prefix"):
        mjlib.load_catalog(p)

def test_bad_group_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(group="nope")]})
    with pytest.raises(mjlib.CatalogError, match="group"):
        mjlib.load_catalog(p)

def test_registry_piece_sin_hacer_cae_al_placeholder_que_existe(tmp_path):
    # El placeholder era uno de los 22 legacy, que ya no viven en
    # public/images/Doty/: apuntar ahi generaba un registro que check-doty-assets
    # rechaza por "falta en disco".
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece()]})
    cat = mjlib.load_catalog(p)
    assert mjlib.registry_src(cat["pieces"][0]) == "/images/Doty/expressions/feliz.png"
    assert "DOTTY-POSES" not in mjlib.emit_registry(cat)
    p2 = write(tmp_path, "d.json", {"fase": "x", "pieces": [piece(done=True)]})
    mjlib.load_catalog(p2)  # no raise

def test_extra_group_no_exige_placeholder(tmp_path):
    # anchor=True porque este es el único no-mascota del grupo "games" del fixture:
    # sin él, el nuevo guard de anchors (más abajo) rechazaría el catálogo por una
    # razón ajena a lo que este test verifica (que "games" es un grupo válido).
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(group="games", slug="wordle", mascot=False, anchor=True)]})
    mjlib.load_catalog(p)

def test_anchor_true_requires_mascot_false(tmp_path):
    # anchor solo tiene sentido para piezas sin fuente fija (spec Sec.2-bis): una
    # pieza de mascota con anchor:true confundiría al operador, que ya adjunta
    # ref-patron.png y no necesita ningún Style reference.
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(anchor=True)]})  # mascot=True por defecto
    with pytest.raises(mjlib.CatalogError, match="anchor"):
        mjlib.load_catalog(p)

def test_at_most_one_anchor_per_group(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [
        piece(group="icons", slug="correcto", mascot=False, anchor=True),
        piece(group="icons", slug="incorrecto", mascot=False, prefix="Red cross mark badge", anchor=True),
    ]})
    with pytest.raises(mjlib.CatalogError, match="anchor"):
        mjlib.load_catalog(p)

def test_non_mascot_group_needs_exactly_one_anchor(tmp_path):
    # dos piezas no-mascota en el mismo grupo, ninguna marcada anchor: el grupo
    # se queda sin ancla y las piezas derivarían en estilo sin que nadie lo note.
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [
        piece(group="icons", slug="correcto", mascot=False),
        piece(group="icons", slug="incorrecto", mascot=False, prefix="Red cross mark badge"),
    ]})
    with pytest.raises(mjlib.CatalogError, match="anchor"):
        mjlib.load_catalog(p)

def test_registry_key_prefixes_stickers():
    assert mjlib.registry_key(piece(group="stickers", slug="good-job")) == "sticker-good-job"
    assert mjlib.registry_key(piece()) == "feliz"

def test_output_path_per_group(tmp_path):
    repo, raw = tmp_path / "repo", tmp_path / "raw"
    assert mjlib.output_path(piece(), "fase-1", repo, raw) == repo / "public/images/Doty/expressions/feliz.png"
    assert mjlib.output_path(piece(group="games", slug="wordle"), "fase-1", repo, raw) == repo / "public/images/games/wordle.png"
    assert mjlib.output_path(piece(group="characters", slug="doty-fem"), "fase-1", repo, raw) == raw / "fase-1/out/characters/doty-fem.png"
    assert mjlib.output_path(piece(group="app-icon", slug="app-icon"), "fase-1", repo, raw) == raw / "fase-1/out/app-icon.png"
    assert mjlib.output_path(piece(group="levels", slug="preposiciones"), "fase-2", repo, raw) == repo / "public/images/levels/preposiciones.png"


STYLE = {"edit_source": "ref-patron.png",
         "brand_lock": "keep the dark navy outline, the navy eyes with white highlights and the hot-pink body",
         "framing": "full body centered, plain white background, no shadow on the floor",
         "icon_block": "flat icon, brand palette", "negative": ["text", "shadow"],
         "aspect": "1:1", "stylize": 50}

def test_build_prompt_mascot_is_edit_instruction_without_flags():
    # spec Sec.5.1-bis: pieza de mascota -> instruccion de Edit, sin flags de ningun tipo.
    out = mjlib.build_prompt(piece(), STYLE)
    assert out == ", ".join(["Doty beaming with joy", "big smile", STYLE["brand_lock"], STYLE["framing"]])
    assert out.endswith(STYLE["framing"])
    assert STYLE["brand_lock"] in out
    assert "--" not in out

def test_build_prompt_icon_is_flagged_text_to_image():
    # las piezas que no son mascota (icons/games) conservan el texto a imagen de siempre.
    out = mjlib.build_prompt(piece(group="icons", slug="correcto", mascot=False, prompt="green check mark"), STYLE)
    assert out.startswith("Doty beaming with joy, green check mark, flat icon, brand palette")
    assert "--ar 1:1" in out
    assert "--stylize 50" in out
    assert out.endswith("--no text, shadow")
    assert STYLE["brand_lock"] not in out and STYLE["framing"] not in out

def test_build_prompt_feliz_matches_spec_example():
    # pin de extremo a extremo: catalogo y style.json reales -> el ejemplo literal del spec Sec.5.1-bis.
    cat = mjlib.load_catalog(Path(__file__).resolve().parents[1] / "batches" / "fase-1.json")
    style = mjlib.load_style(Path(__file__).resolve().parents[1] / "style.json")
    feliz = next(p for p in cat["pieces"] if p["slug"] == "feliz")
    out = mjlib.build_prompt(feliz, style)
    assert out == (
        "Doty beaming with joy, standing upright, arms slightly open, big happy smile, "
        "keep the dark navy outline, the navy eyes with white highlights and the hot-pink body, "
        "full body centered, plain white background, no shadow on the floor"
    )
    assert "--" not in out

def test_build_prompt_correcto_icon_matches_expected_shape():
    # mismo catalogo/style reales, pieza no-mascota: forma con flags de siempre, sin brand_lock/framing.
    cat = mjlib.load_catalog(Path(__file__).resolve().parents[1] / "batches" / "fase-1.json")
    style = mjlib.load_style(Path(__file__).resolve().parents[1] / "style.json")
    correcto = next(p for p in cat["pieces"] if p["slug"] == "correcto")
    out = mjlib.build_prompt(correcto, style)
    # se fija el ORDEN de ensamblado, no el texto del prompt: ese es dato del
    # catalogo y se afina lote a lote (este test se rompio al recolorear los iconos).
    assert out.startswith(f"{correcto['prefix']}, {correcto['prompt']}, {style['icon_block']}")
    assert "--ar 1:1" in out and "--stylize 50" in out
    assert out.endswith("--no text, watermark, glasses, shadow, background objects")
    assert style["brand_lock"] not in out and style["framing"] not in out

def test_emit_prompts_is_numbered_markdown():
    cat = {"fase": "fase-1", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad")]}
    md = mjlib.emit_prompts(cat, STYLE)
    assert md.splitlines()[0] == "# fase-1 — prompts"
    assert "1. `feliz` → `expressions/feliz.png`" in md and "2. `triste`" in md
    assert md.count("```") == 4  # un bloque de código por prompt

def test_emit_prompts_header_reflects_edit_model_no_stale_v7_terms():
    cat = {"fase": "fase-1", "pieces": [
        piece(),
        piece(group="icons", slug="correcto", mascot=False, prompt="green check mark"),
    ]}
    md = mjlib.emit_prompts(cat, STYLE)
    assert "V8.2" in md
    assert STYLE["edit_source"] in md
    assert "nunca encadenes" in md
    assert "🎨 mascota" in md and "🔤 icono" in md
    for stale in ("--oref", "--ow ", "--sref", "Omni"):
        assert stale not in md, stale


def test_emit_lote_mascota_sola_no_menciona_style_reference():
    cat = {"fase": "fase-1", "pieces": [
        piece(),
        piece(slug="triste", prefix="Doty feeling sad"),
    ]}
    md = mjlib.emit_lote(cat, STYLE, ["expressions"])
    assert STYLE["edit_source"] in md
    assert "encaden" in md.lower()  # "nunca encadenes" / "encadenar acumula deriva"
    assert "Style reference" not in md

def test_emit_lote_no_mascota_menciona_style_reference_y_ancla_no_edit_source():
    cat = {"fase": "fase-1", "pieces": [
        piece(group="icons", slug="correcto", mascot=False, prompt="green check mark",
              prefix="Green check mark badge", anchor=True),
        piece(group="icons", slug="incorrecto", mascot=False, prompt="red cross mark",
              prefix="Red cross mark badge"),
    ]}
    md = mjlib.emit_lote(cat, STYLE, ["icons"])
    assert "Style reference" in md
    assert "ancla" in md.lower()
    assert STYLE["edit_source"] not in md  # no se instruye adjuntar la fuente de Edit

def test_emit_lote_mixto_cubre_ambos_modos():
    cat = {"fase": "fase-1", "pieces": [
        piece(),
        piece(group="icons", slug="correcto", mascot=False, prompt="green check mark",
              prefix="Green check mark badge", anchor=True),
    ]}
    md = mjlib.emit_lote(cat, STYLE, ["expressions", "icons"])
    assert STYLE["edit_source"] in md
    assert "encaden" in md.lower()
    assert "Style reference" in md
    assert "ancla" in md.lower()

def test_emit_lote_marca_la_pieza_ancla_en_su_grupo():
    cat = {"fase": "fase-1", "pieces": [
        piece(group="icons", slug="correcto", mascot=False, prompt="green check mark",
              prefix="Green check mark badge", anchor=True),
        piece(group="icons", slug="incorrecto", mascot=False, prompt="red cross mark",
              prefix="Red cross mark badge"),
    ]}
    md = mjlib.emit_lote(cat, STYLE, ["icons"])
    linea_ancla = next(l for l in md.splitlines() if "`correcto`" in l)
    linea_normal = next(l for l in md.splitlines() if "`incorrecto`" in l)
    assert "ANCLA" in linea_ancla
    assert "ANCLA" not in linea_normal

def test_emit_lote_titulo_lleva_grupos_y_cantidad():
    cat = {"fase": "fase-1", "pieces": [
        piece(),
        piece(slug="triste", prefix="Doty feeling sad"),
        piece(group="icons", slug="correcto", mascot=False, prompt="green check mark",
              prefix="Green check mark badge", anchor=True),
    ]}
    md = mjlib.emit_lote(cat, STYLE, ["expressions", "icons"])
    titulo = md.splitlines()[0]
    assert "expressions" in titulo and "icons" in titulo and "3" in titulo

def test_emit_lote_lista_los_criterios_de_aceptacion_clave():
    # no se fija la prosa completa (se afina con el uso), pero sí los hechos
    # concretos que costaron un defecto real: si alguno desaparece, el criterio
    # correspondiente desaparece con él.
    cat = {"fase": "fase-1", "pieces": [piece()]}
    md = mjlib.emit_lote(cat, STYLE, ["expressions"])
    for clave in ("#FF1F8F", "#1E1B5C", "#3768FF", "#35D8F5", "lentes", "1.18", "rembg", "dormido"):
        assert clave in md, clave

def test_emit_lote_grupo_desconocido_falla_con_su_nombre():
    cat = {"fase": "fase-1", "pieces": [piece()]}
    with pytest.raises(mjlib.CatalogError, match="grupo-fantasma"):
        mjlib.emit_lote(cat, STYLE, ["grupo-fantasma"])

def test_emit_lote_un_bloque_de_prompt_por_pieza():
    cat = {"fase": "fase-1", "pieces": [
        piece(),
        piece(slug="triste", prefix="Doty feeling sad"),
    ]}
    md = mjlib.emit_lote(cat, STYLE, ["expressions"])
    assert md.count("```") == 4
    assert mjlib.build_prompt(cat["pieces"][1], STYLE) in md

def test_emit_lote_marca_las_piezas_ya_hechas():
    cat = {"fase": "fase-1", "pieces": [piece(done=True)]}
    md = mjlib.emit_lote(cat, STYLE, ["expressions"])
    assert "✅" in md

def test_registry_src_usa_el_placeholder_hasta_que_esta_hecha():
    assert mjlib.registry_src(piece()) == "/images/Doty/expressions/feliz.png"
    assert mjlib.registry_src(piece(done=True)) == "/images/Doty/expressions/feliz.png"

def test_emit_registry_shape():
    cat = {"fase": "fase-1", "pieces": [
        piece(done=True),
        piece(group="stickers", slug="good-job", prefix="Doty thumbs up wink"),
        piece(group="games", slug="wordle", prefix="Green letter tiles", mascot=False),
    ]}
    ts = mjlib.emit_registry(cat)
    assert ts.startswith("// GENERADO por scripts/mj/process.py --emit-registry")
    assert '  feliz: { src: "/images/Doty/expressions/feliz.png", group: "expressions" },' in ts
    assert '  "sticker-good-job": { src: "/images/Doty/expressions/feliz.png", group: "stickers" },' in ts
    assert "wordle" not in ts
    assert 'export const FALLBACK_POSE: DotyPose = "feliz";' in ts
    assert "export function toDotyPose(" in ts

def test_emit_registry_requires_feliz():
    with pytest.raises(mjlib.CatalogError, match="feliz"):
        mjlib.emit_registry({"fase": "x", "pieces": [piece(slug="triste", prefix="Doty sad")]})

def test_emit_registry_feliz_in_stickers_does_not_satisfy_guard():
    # registry_key() would emit "sticker-feliz", so FALLBACK_POSE "feliz" would not exist
    with pytest.raises(mjlib.CatalogError, match="feliz"):
        mjlib.emit_registry({"fase": "x", "pieces": [
            piece(group="stickers", slug="feliz", prefix="Doty happy sticker"),
        ]})

def test_normalize_collapses_separators():
    assert mjlib.normalize("sergio_Doty_beaming_with_joy_3f2a.png") == "sergio doty beaming with joy 3f2a png"
    assert mjlib.normalize("Doty beaming with joy") == "doty beaming with joy"

def test_match_downloads_by_prefix():
    cat = {"fase": "x", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad")]}
    files = ["sergio_Doty_beaming_with_joy_aaaa.png", "sergio_Doty_beaming_with_joy_bbbb.png",
             "sergio_Doty_feeling_sad_cccc.png", "random.png", "PROMPTS.md"]
    m = mjlib.match_downloads(cat, files)
    assert m["feliz"] == ["sergio_Doty_beaming_with_joy_aaaa.png", "sergio_Doty_beaming_with_joy_bbbb.png"]
    assert m["triste"] == ["sergio_Doty_feeling_sad_cccc.png"]

def test_render_dry_run_lists_states():
    cat = {"fase": "x", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad"),
                                   piece(slug="wow", prefix="Doty amazed")]}
    m = {"feliz": ["a.png", "b.png"], "triste": ["c.png"], "wow": []}
    txt = mjlib.render_dry_run(cat, m)
    assert "OK       triste ← c.png" in txt
    assert "AMBIGUO  feliz ← a.png | b.png" in txt
    assert "FALTA    wow" in txt

def test_prefixes_that_normalize_alike_are_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [
        piece(prefix="Doty Waving Hello!"),
        piece(slug="otro", prefix="doty waving hello"),
    ]})
    with pytest.raises(mjlib.CatalogError, match="collides"):
        mjlib.load_catalog(p)

def test_prefix_contained_in_another_is_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [
        piece(prefix="Doty with a big smile"),
        piece(slug="otro", prefix="Doty with a big smile beaming widely"),
    ]})
    with pytest.raises(mjlib.CatalogError, match="collides"):
        mjlib.load_catalog(p)

def test_slug_must_be_lowercase_kebab_case(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(slug="Bad_Slug")]})
    with pytest.raises(mjlib.CatalogError, match="kebab-case"):
        mjlib.load_catalog(p)

def test_prefix_that_normalizes_to_empty_is_rejected(tmp_path):
    # un prefix hecho solo de puntuación normaliza a "" y ese "" es substring de
    # cualquier nombre de archivo: coincidiría con todas las descargas.
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(prefix="!!! --- ???")]})
    with pytest.raises(mjlib.CatalogError, match="empty"):
        mjlib.load_catalog(p)

def test_render_dry_run_marks_done_pieces():
    cat = {"fase": "x", "pieces": [piece(done=True)]}
    assert mjlib.render_dry_run(cat, {"feliz": []}) == "HECHO    feliz"

def test_match_downloads_returns_sorted_candidates():
    cat = {"fase": "x", "pieces": [piece()]}
    files = ["z_Doty_beaming_with_joy_zzz.png", "a_Doty_beaming_with_joy_aaa.png"]
    assert mjlib.match_downloads(cat, files)["feliz"] == [
        "a_Doty_beaming_with_joy_aaa.png", "z_Doty_beaming_with_joy_zzz.png"
    ]

def test_match_downloads_ignores_non_png():
    cat = {"fase": "x", "pieces": [piece()]}
    assert mjlib.match_downloads(cat, ["sergio_Doty_beaming_with_joy_x.txt"])["feliz"] == []


def blob(w=200, h=200, box=(50, 80, 150, 120), color=(255, 31, 143, 255)):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for x in range(box[0], box[2]):
        for y in range(box[1], box[3]):
            im.putpixel((x, y), color)
    return im


def test_trim_square_resize_centers_and_sizes():
    out = mjlib.trim_square_resize(blob(), 128, margin=0.0)
    assert out.size == (128, 128) and out.mode == "RGBA"
    bbox = out.getbbox()  # el contenido ocupa todo el ancho y queda centrado en vertical
    assert bbox[0] == 0 and bbox[2] == 128
    assert abs((bbox[1] + bbox[3]) / 2 - 64) <= 1


def test_trim_square_resize_applies_margin():
    out = mjlib.trim_square_resize(blob(), 100, margin=0.10)
    bbox = out.getbbox()
    assert 9 <= bbox[0] <= 11 and 89 <= bbox[2] <= 91


def test_trim_square_resize_empty_image_raises():
    with pytest.raises(ValueError, match="empty"):
        mjlib.trim_square_resize(Image.new("RGBA", (10, 10), (0, 0, 0, 0)), 64)


def test_halo_thickness_px_detects_pink_fringe():
    clean = blob()
    assert mjlib.halo_thickness_px(clean) == 0.0
    fringe = blob()
    for x in range(50, 150):
        fringe.putpixel((x, 80), (255, 60, 150, 120))  # borde semitransparente rosado
    assert mjlib.halo_thickness_px(fringe) > 0
    grey = blob()
    for x in range(50, 150):
        grey.putpixel((x, 80), (120, 120, 120, 120))
    assert mjlib.halo_thickness_px(grey) == 0.0

def test_trim_square_resize_keeps_the_long_axis():
    # el sujeto de blob() es 100x40: el resultado debe seguir siendo más ancho que alto.
    # Con side=min(w,h) el contenido se recortaría a un cuadrado y ancho==alto.
    out = mjlib.trim_square_resize(blob(), 256)
    bbox = out.getbbox()
    ancho, alto = bbox[2] - bbox[0], bbox[3] - bbox[1]
    assert 0.35 * ancho <= alto <= 0.55 * ancho

def test_halo_thickness_px_needs_both_colour_conditions():
    # r>180 pero g>=120, y r<=180 pero g<120: ninguno es rosa. Con `or` contarían como halo.
    im = blob()
    for x in range(50, 100):
        im.putpixel((x, 80), (200, 150, 160, 120))
    for x in range(100, 150):
        im.putpixel((x, 80), (100, 50, 60, 120))
    assert mjlib.halo_thickness_px(im) == 0.0

def test_trim_square_resize_rounds_the_inner_size():
    # margen por defecto 0.04 sobre 256: round(235.52)=236, truncar daría 235.
    out = mjlib.trim_square_resize(blob(), 256)
    bbox = out.getbbox()
    assert bbox[2] - bbox[0] == 236

def test_trim_square_resize_clamps_a_degenerate_margin():
    # margin 0.5 anula el interior; el clamp max(1, ...) evita un lienzo vacío.
    out = mjlib.trim_square_resize(blob(), 64, margin=0.5)
    assert out.size == (64, 64)
    assert out.getbbox() is not None


def test_trim_square_resize_ignores_rgb_of_a_transparent_background():
    # rembg suele dejar el blanco del fondo con alfa 0. Si se perdiera el
    # alpha_only=True (o Pillow cambiara su default), getbbox consideraría ese
    # blanco como contenido y el recorte sería un no-op sobre el lienzo entero.
    im = Image.new("RGBA", (200, 200), (255, 255, 255, 0))
    for x in range(50, 150):
        for y in range(80, 120):
            im.putpixel((x, y), (255, 31, 143, 255))
    out = mjlib.trim_square_resize(im, 128, margin=0.0)
    bbox = out.getbbox()
    assert bbox[0] == 0 and bbox[2] == 128  # el sujeto (más ancho que alto) llena el lienzo


def raw_png(dirpath, name):
    im = Image.new("RGBA", (300, 300), (255, 255, 255, 255))
    for x in range(100, 200):
        for y in range(120, 180):
            im.putpixel((x, y), (255, 31, 143, 255))
    im.save(dirpath / name)


def fake_remover(im):
    # vuelve transparente todo píxel blanco puro
    im = im.convert("RGBA")
    data = [(0, 0, 0, 0) if (r, g, b) == (255, 255, 255) else (r, g, b, a) for r, g, b, a in im.get_flattened_data()]
    out = Image.new("RGBA", im.size)
    out.putdata(data)
    return out


def test_apply_writes_marks_done_and_reports(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c1.png")
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c2.png")
    cat = {"fase": "fase-1", "pieces": [
        piece(size=64),
        piece(slug="triste", prefix="Doty feeling sad", size=64),
        piece(slug="wow", prefix="Doty amazed", size=64),
    ]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover)
    out = repo / "public/images/Doty/expressions/feliz.png"
    assert out.exists() and Image.open(out).size == (64, 64)
    assert rep["done"] == ["feliz"] and rep["ambiguous"] == ["triste"] and rep["missing"] == ["wow"]
    saved = json.loads(cpath.read_text())
    assert saved["pieces"][0]["done"] is True and saved["pieces"][1]["done"] is False


def test_apply_pick_resolves_ambiguity_and_skips_existing(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c1.png")
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c2.png")
    cat = {"fase": "fase-1", "pieces": [piece(slug="triste", prefix="Doty feeling sad", size=64), piece(done=True)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover, picks={"triste": "sergio_Doty_feeling_sad_c2.png"})
    assert rep["done"] == ["triste"] and rep["skipped"] == ["feliz"]
    rep2 = mjlib.apply_batch(mjlib.load_catalog(cpath), cpath, raw, repo, fake_remover)
    assert rep2["skipped"] == ["triste", "feliz"] and rep2["done"] == []


def test_render_report_sections():
    # failed y duplicates no vacíos: desempaquetan tuplas de 2 y 3 elementos, así
    # que un orden de desempaquetado cambiado en render_report debe romper esto.
    txt = mjlib.render_report({"fase": "fase-1", "done": ["feliz"], "skipped": [], "missing": ["wow"],
                               "ambiguous": ["triste"], "halo": [("feliz", 2.5)],
                               "failed": [("bailando", "RuntimeError: modelo caído")],
                               "duplicates": [("dot-bombs", "sergio_archivo.png", "wordle")]})
    assert "# fase-1 — REPORT" in txt and "## Hechas (1)" in txt and "- wow" in txt
    assert "feliz (2.50 px)" in txt
    assert "bailando: RuntimeError: modelo caído" in txt
    assert "dot-bombs y wordle -> sergio_archivo.png" in txt


def test_halo_thickness_distingue_halo_de_antialiasing():
    from PIL import ImageDraw

    def circulo(halo_px=0, size=512):
        s = size * 4
        im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        off = s * 0.07
        if halo_px:
            g = halo_px * 4
            d.ellipse([off - g, off - g, s - off + g, s - off + g], fill=(255, 31, 143, 110))
        d.ellipse([off, off, s - off, s - off], fill=(255, 31, 143, 255))
        return im.resize((size, size), Image.LANCZOS)  # antialiasing real

    limpio = mjlib.halo_thickness_px(circulo())
    con_halo = mjlib.halo_thickness_px(circulo(halo_px=6))
    assert 1.0 < limpio < mjlib.HALO_THRESHOLD < con_halo


def test_halo_thickness_no_depende_del_tamano():
    from PIL import ImageDraw

    def circulo(size):
        s = size * 4
        im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        off = s * 0.07
        d.ellipse([off, off, s - off, s - off], fill=(255, 31, 143, 255))
        return im.resize((size, size), Image.LANCZOS)

    a = mjlib.halo_thickness_px(circulo(512))
    b = mjlib.halo_thickness_px(circulo(1024))
    assert abs(a - b) < 0.15 and a < mjlib.HALO_THRESHOLD


def test_apply_force_reprocesa_una_pieza_done(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64, done=True)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover, force=True)
    assert rep["done"] == ["feliz"] and rep["skipped"] == []
    assert (repo / "public/images/Doty/expressions/feliz.png").exists()



def test_apply_rechaza_un_pick_inexistente(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    cat = {"fase": "fase-1", "pieces": [piece(size=64)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    with pytest.raises(mjlib.CatalogError, match="no existen"):
        mjlib.apply_batch(cat, cpath, raw, repo, fake_remover, picks={"feliz": "fantasma.png"})


def test_apply_detecta_el_mismo_archivo_en_dos_piezas(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    cat = {"fase": "fase-1", "pieces": [
        piece(size=64),
        piece(slug="triste", prefix="Doty feeling sad", size=64),
    ]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover,
                            picks={"triste": "sergio_Doty_beaming_with_joy_aaaa.png"})
    assert rep["done"] == ["feliz", "triste"]
    assert [(s, f) for s, f, _ in rep["duplicates"]] == [("triste", "sergio_Doty_beaming_with_joy_aaaa.png")]


def test_apply_aisla_el_fallo_de_una_pieza(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_bbbb.png")
    cat = {"fase": "fase-1", "pieces": [
        piece(size=64),
        piece(slug="triste", prefix="Doty feeling sad", size=64),
    ]}
    cpath = write(tmp_path, "fase-1.json", cat)

    def remover_que_falla(im):
        raise RuntimeError("modelo caído")

    rep = mjlib.apply_batch(cat, cpath, raw, repo, remover_que_falla)
    assert rep["done"] == [] and len(rep["failed"]) == 2
    assert all("RuntimeError" in e for _, e in rep["failed"])

def test_apply_no_marca_halo_en_un_sprite_limpio(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover)
    assert rep["done"] == ["feliz"]
    assert rep["halo"] == []


def test_apply_marca_halo_cuando_el_remover_deja_banda(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64)]}
    cpath = write(tmp_path, "fase-1.json", cat)

    def remover_con_halo(im):
        """Deja una banda de 8 px rosa semitransparente alrededor del sujeto,
        imitando el fallo real de rembg que este alerta debe cazar."""
        im = im.convert("RGBA")
        out = Image.new("RGBA", im.size, (0, 0, 0, 0))
        for x in range(92, 208):
            for y in range(112, 188):
                out.putpixel((x, y), (250, 60, 150, 110))
        for x in range(100, 200):
            for y in range(120, 180):
                out.putpixel((x, y), (255, 31, 143, 255))
        return out

    rep = mjlib.apply_batch(cat, cpath, raw, repo, remover_con_halo)
    assert rep["done"] == ["feliz"]
    assert [s for s, _ in rep["halo"]] == ["feliz"]
    assert rep["halo"][0][1] > mjlib.HALO_THRESHOLD

def test_build_prompt_quita_glasses_del_negativo_si_la_pieza_los_lleva():
    # el opt-out de glasses solo tiene efecto en el camino de icono: una pieza de
    # mascota no lleva "--no" en absoluto (ver test_build_prompt_mascot_is_edit_instruction_without_flags).
    style = dict(STYLE, negative=["text", "glasses", "shadow"])
    out = mjlib.build_prompt(piece(group="icons", mascot=False, glasses=True), style)
    assert out.endswith("--no text, shadow")

def test_build_prompt_mantiene_glasses_en_el_negativo_por_defecto():
    style = dict(STYLE, negative=["text", "glasses", "shadow"])
    out = mjlib.build_prompt(piece(group="icons", mascot=False), style)
    assert out.endswith("--no text, glasses, shadow")

def test_apply_mide_el_halo_antes_del_resize(tmp_path):
    """El upscaling difumina el borde: la misma fuente limpia mide 0.000 px antes del
    resize y 6.906 px después a size 1024. Si el halo se midiera sobre la imagen ya
    redimensionada, esta pieza limpia saldría marcada."""
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=1024)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover)
    assert rep["done"] == ["feliz"]
    assert rep["halo"] == []


def test_brand_lock_por_pieza_anula_el_de_style():
    # los narradores derivados llevan otro color de cuerpo; sin este override la
    # instruccion diria "cuerpo lavanda ... keep the hot-pink body" y se contradiria.
    propio = "keep the dark navy outline, and a lavender body — not pink"
    out = mjlib.build_prompt(piece(brand_lock=propio), STYLE)
    assert propio in out
    assert STYLE["brand_lock"] not in out


def test_sin_brand_lock_propio_usa_el_de_style():
    out = mjlib.build_prompt(piece(), STYLE)
    assert STYLE["brand_lock"] in out


def test_framing_por_pieza_anula_el_de_style():
    # el app-icon es un primer plano; el framing por defecto pide cuerpo entero.
    propio = "head and shoulders only, centered with margin"
    out = mjlib.build_prompt(piece(framing=propio), STYLE)
    assert out.endswith(propio)
    assert STYLE["framing"] not in out


def raw_png_con_ojo(dirpath, name):
    """Como raw_png, pero con un cuadro BLANCO dentro del cuerpo rosa: es la
    trampa exacta en la que cae rembg, que decide por color y no por topología."""
    im = Image.new("RGBA", (300, 300), (255, 255, 255, 255))
    for x in range(100, 200):
        for y in range(120, 180):
            im.putpixel((x, y), (255, 31, 143, 255))
    for x in range(140, 160):
        for y in range(140, 160):
            im.putpixel((x, y), (255, 255, 255, 255))
    im.save(dirpath / name)


def test_internal_hole_mask_no_marca_el_fondo_que_toca_el_borde():
    im = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    for x in range(10, 30):
        for y in range(10, 30):
            im.putpixel((x, y), (255, 31, 143, 255))
    assert mjlib.internal_hole_mask(im).getbbox() is None


def test_internal_hole_mask_marca_el_agujero_rodeado_de_figura():
    im = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    for x in range(10, 30):
        for y in range(10, 30):
            im.putpixel((x, y), (255, 31, 143, 255))
    for x in range(18, 22):
        for y in range(18, 22):
            im.putpixel((x, y), (0, 0, 0, 0))
    assert mjlib.internal_hole_mask(im).getbbox() == (18, 18, 22, 22)


def test_fill_internal_holes_recupera_el_color_del_original_no_un_blanco_inventado():
    src = Image.new("RGBA", (40, 40), (255, 255, 255, 255))
    for x in range(10, 30):
        for y in range(10, 30):
            src.putpixel((x, y), (255, 31, 143, 255))
    for x in range(18, 22):          # el "ojo": un gris, no blanco puro
        for y in range(18, 22):
            src.putpixel((x, y), (230, 230, 240, 255))
    cut = src.copy()
    for x in range(18, 22):
        for y in range(18, 22):
            cut.putpixel((x, y), (0, 0, 0, 0))
    out = mjlib.fill_internal_holes(cut, src)
    assert out.getpixel((20, 20)) == (230, 230, 240, 255)


def test_apply_batch_rellena_el_ojo_que_rembg_se_comio(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png_con_ojo(raw / "fase-1", "sergio_Doty_beaming_with_joy_c1.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64)]}
    rep = mjlib.apply_batch(cat, write(tmp_path, "fase-1.json", cat), raw, repo, fake_remover)
    assert rep["done"] == ["feliz"]
    salida = Image.open(repo / "public/images/Doty/expressions/feliz.png")
    assert mjlib.internal_hole_mask(salida).getbbox() is None


def test_keep_holes_deja_el_anillo_hueco(tmp_path):
    # `cargando` es un anillo: su centro es fondo de verdad y rellenarlo lo
    # convertiria en un disco. La topologia no puede distinguirlo, lo dice el catalogo.
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png_con_ojo(raw / "fase-1", "sergio_Doty_beaming_with_joy_c1.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64, keep_holes=True)]}
    mjlib.apply_batch(cat, write(tmp_path, "fase-1.json", cat), raw, repo, fake_remover)
    salida = Image.open(repo / "public/images/Doty/expressions/feliz.png")
    assert mjlib.internal_hole_mask(salida).getbbox() is not None


def test_force_reusa_el_source_file_ya_elegido(tmp_path):
    # Sin esto, un --force devuelve a "ambigua" toda pieza que se habia resuelto
    # con --pick y deja el PNG viejo en disco: parece hecha y esta sin reprocesar.
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_c1.png")
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_c2.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover,
                            picks={"feliz": "sergio_Doty_beaming_with_joy_c2.png"})
    assert rep["done"] == ["feliz"]
    de_nuevo = mjlib.apply_batch(mjlib.load_catalog(cpath), cpath, raw, repo,
                                 fake_remover, force=True)
    assert de_nuevo["done"] == ["feliz"] and de_nuevo["ambiguous"] == []


def test_force_ignora_un_source_file_que_ya_no_existe(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_c1.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64, source_file="borrado.png")]}
    rep = mjlib.apply_batch(cat, write(tmp_path, "fase-1.json", cat), raw, repo,
                            fake_remover, force=True)
    assert rep["done"] == ["feliz"]        # cae al único candidato, no explota


def test_internal_hole_mask_incluye_la_orla_semitransparente_del_agujero():
    # El interior de una figura solida es opaco por definicion, asi que la orla
    # del agujero es agujero. Dejarla fuera la deja dentro de la figura y
    # halo_thickness_px la lee como halo: alerta falsa al arreglar los ojos.
    im = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    for x in range(10, 30):
        for y in range(10, 30):
            im.putpixel((x, y), (255, 31, 143, 255))
    for x in range(18, 22):
        for y in range(18, 22):
            im.putpixel((x, y), (0, 0, 0, 0))
    for x in range(17, 23):          # orla a medio alfa alrededor del agujero
        for y in (17, 22):
            im.putpixel((x, y), (255, 31, 143, 128))
    for y in range(17, 23):
        for x in (17, 22):
            im.putpixel((x, y), (255, 31, 143, 128))
    assert mjlib.internal_hole_mask(im).getbbox() == (17, 17, 23, 23)


def test_translucent_silencia_la_alerta_de_halo(tmp_path):
    # ghost-race es un fantasma translucido: sus pixeles semitransparentes son el
    # dibujo. La metrica no puede distinguirlo, asi que la pieza lo declara.
    def remover_con_halo(im):
        im = im.convert("RGBA")
        datos = [(r, g, b, 128) if (r, g, b) != (255, 255, 255) else (0, 0, 0, 0)
                 for r, g, b, a in im.get_flattened_data()]
        out = Image.new("RGBA", im.size); out.putdata(datos); return out
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_c1.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64)]}
    ruidosa = mjlib.apply_batch(cat, write(tmp_path, "a.json", cat), raw, repo, remover_con_halo)
    assert [s for s, _ in ruidosa["halo"]] == ["feliz"]
    cat2 = {"fase": "fase-1", "pieces": [piece(size=64, translucent=True)]}
    callada = mjlib.apply_batch(cat2, write(tmp_path, "b.json", cat2), raw, repo, remover_con_halo)
    assert callada["halo"] == [] and callada["done"] == ["feliz"]


@pytest.mark.parametrize("prompt", [
    "thick navy outlines around each tile",
    "a crossword grid of white squares with a navy border",
    "wearing round navy-framed glasses",
    "a bold navy-outline star",
    "the navy eyes with white highlights",
])
def test_navy_como_linea_o_rasgo_se_acepta(prompt):
    assert mjlib.dark_fill_mentions(prompt) == []


@pytest.mark.parametrize("prompt,esperado", [
    ("hands on a navy laptop keyboard", ["navy"]),
    ("an open navy blue book", ["navy"]),
    ("pink, navy and blue bricks", ["navy"]),
    ("a dark grey wide-brimmed huaso hat", ["dark grey"]),
    ("a black rubber tire", ["black"]),
])
def test_navy_de_relleno_se_rechaza(prompt, esperado):
    assert mjlib.dark_fill_mentions(prompt) == esperado


def test_catalogo_rechaza_el_navy_de_relleno_nombrando_la_pieza(tmp_path):
    cat = {"fase": "fase-1", "pieces": [piece(slug="leyendo", prefix="Doty engrossed in a book",
                                              prompt="an open navy blue book")]}
    with pytest.raises(mjlib.CatalogError) as e:
        mjlib.load_catalog(write(tmp_path, "fase-1.json", cat))
    assert "leyendo" in str(e.value) and "navy" in str(e.value)


def test_el_brand_lock_de_estilo_no_lo_bloquea_el_guard():
    # "keep the dark navy outline" es de style.json y llega por build_prompt, no por
    # el prompt de la pieza: el guard no debe impedir la linea de la marca.
    assert mjlib.dark_fill_mentions(STYLE["brand_lock"]) == []


def test_regen_reprocesa_sin_force_y_se_limpia(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_c1.png")
    cat = {"fase": "fase-1", "pieces": [piece(size=64, done=True, regen=True)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover)
    assert rep["done"] == ["feliz"] and rep["skipped"] == []
    guardado = json.loads(cpath.read_text())["pieces"][0]
    assert guardado["done"] is True and "regen" not in guardado


def test_regen_no_devuelve_el_registro_a_legacy():
    # El motivo de existir de `regen`: con done=false el registro caeria al sprite
    # legacy en la proxima regeneracion, en silencio y con el arte bueno en disco.
    p = piece(slug="leyendo", group="poses", done=True, regen=True)
    assert mjlib.registry_src(p) == "/images/Doty/poses/leyendo.png"


def test_dry_run_muestra_pendiente_la_pieza_en_cola():
    cat = {"fase": "fase-1", "pieces": [piece(size=64, done=True, regen=True)]}
    salida = mjlib.render_dry_run(cat, {"feliz": ["sergio_Doty_beaming_with_joy_c1.png"]})
    assert "HECHO" not in salida and "OK       feliz" in salida


def test_emit_lote_pendientes_deja_fuera_lo_ya_bueno():
    cat = {"fase": "fase-1", "pieces": [
        piece(slug="feliz", prefix="Doty beaming with joy", done=True),
        piece(slug="triste", prefix="Doty feeling sad", done=True, regen=True),
        piece(slug="wow", group="states", prefix="Doty amazed", done=False),
    ]}
    todo = mjlib.emit_lote(cat, STYLE, ["expressions", "states"])
    solo = mjlib.emit_lote(cat, STYLE, ["expressions", "states"], pendientes_solo=True)
    assert "`feliz`" in todo
    assert "`feliz`" not in solo                 # ya buena: fuera
    assert "`triste`" in solo and "`wow`" in solo  # en cola y sin generar: dentro
    assert "(2 piezas)" in solo


def test_emit_lote_pendientes_omite_el_grupo_que_queda_vacio():
    cat = {"fase": "fase-1", "pieces": [
        piece(slug="feliz", prefix="Doty beaming with joy", done=True),
        piece(slug="wow", group="states", prefix="Doty amazed", done=False),
    ]}
    solo = mjlib.emit_lote(cat, STYLE, ["expressions", "states"], pendientes_solo=True)
    assert "## Grupo: states" in solo and "## Grupo: expressions" not in solo


def test_emit_lote_marca_la_cola_distinto_que_lo_hecho():
    # ✅ significa "no la toques". Una pieza en cola hay que tocarla, asi que no
    # puede llevar el mismo marcador.
    cat = {"fase": "fase-1", "pieces": [
        piece(slug="feliz", prefix="Doty beaming with joy", done=True),
        piece(slug="triste", prefix="Doty feeling sad", done=True, regen=True),
    ]}
    txt = mjlib.emit_lote(cat, STYLE, ["expressions"])
    linea_feliz = next(l for l in txt.splitlines() if "`feliz`" in l)
    linea_triste = next(l for l in txt.splitlines() if "`triste`" in l)
    assert "✅" in linea_feliz and "REGENERAR" not in linea_feliz
    assert "REGENERAR" in linea_triste and "✅" not in linea_triste


def test_levels_escribe_en_su_carpeta_y_no_sobre_el_app_icon():
    # `_relative_output` cae por defecto a la ruta del app-icon: sin una rama
    # propia, las 38 piezas de niveles se escribirían todas encima de
    # fase-2/out/app-icon.png, en silencio y pisándose entre sí.
    p = piece(slug="preposiciones", group="levels", mascot=False, size=512)
    assert mjlib._relative_output(p, "fase-2") == "public/images/levels/preposiciones.png"


def test_levels_es_un_grupo_valido(tmp_path):
    cat = {"fase": "fase-2", "pieces": [
        piece(slug="preposiciones", group="levels", prefix="Level tile prepositions",
              mascot=False, size=512, anchor=True),
    ]}
    assert mjlib.load_catalog(write(tmp_path, "fase-2.json", cat))["fase"] == "fase-2"
