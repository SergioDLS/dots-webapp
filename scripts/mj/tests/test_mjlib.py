import json
from pathlib import Path
import pytest
from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

def piece(**over):
    base = {"slug": "feliz", "group": "expressions", "prefix": "Doty beaming with joy",
            "prompt": "big smile", "size": 1024, "oref": True, "fallback": "02", "done": False}
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

def test_registry_piece_needs_fallback_until_done(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(fallback=None)]})
    with pytest.raises(mjlib.CatalogError, match="fallback"):
        mjlib.load_catalog(p)
    p2 = write(tmp_path, "d.json", {"fase": "x", "pieces": [piece(fallback=None, done=True)]})
    mjlib.load_catalog(p2)  # no raise

def test_extra_group_needs_no_fallback(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(group="games", slug="wordle", oref=False, fallback=None)]})
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


STYLE = {"model": "7", "oref_file": "ref-hero.png", "ow": 300, "sref": "", "sw": 200, "stylize": 50,
         "aspect": "1:1", "negative": ["text", "shadow"],
         "character": "Doty the mascot: round pink ball", "style_block": "flat vector, white background",
         "icon_block": "flat icon, brand palette"}

def test_build_prompt_with_oref():
    out = mjlib.build_prompt(piece(), STYLE)
    assert out.startswith("Doty beaming with joy, Doty the mascot: round pink ball, big smile, flat vector, white background")
    assert "--ar 1:1 --stylize 50 --oref ref-hero.png --ow 300" in out
    assert out.endswith("--no text, shadow")
    assert "--sref" not in out

def test_build_prompt_icon_without_oref():
    out = mjlib.build_prompt(piece(group="icons", slug="correcto", oref=False, prompt="green check mark"), STYLE)
    assert out.startswith("Doty beaming with joy, green check mark, flat icon, brand palette")
    assert "--oref" not in out and "Doty the mascot" not in out

def test_build_prompt_sref_and_overrides():
    style = dict(STYLE, sref="abc123")
    out = mjlib.build_prompt(piece(ow=100, model="7"), style)
    assert "--sref abc123 --sw 200" in out and "--ow 100" in out and "--v 7" in out

def test_build_prompt_sref_only_uses_character_block():
    out = mjlib.build_prompt(piece(oref=False, sref_only=True), dict(STYLE, sref="abc123"))
    assert "Doty the mascot" in out and "--oref" not in out and "--sref abc123" in out

def test_emit_prompts_is_numbered_markdown():
    cat = {"fase": "fase-1", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad", fallback="05")]}
    md = mjlib.emit_prompts(cat, STYLE)
    assert md.splitlines()[0] == "# fase-1 — prompts"
    assert "1. `feliz` → `expressions/feliz.png`" in md and "2. `triste`" in md
    assert md.count("```") == 4  # un bloque de código por prompt

def test_registry_src_uses_fallback_until_done():
    assert mjlib.registry_src(piece()) == "/images/Doty/DOTTY-POSES-02.png"
    assert mjlib.registry_src(piece(done=True)) == "/images/Doty/expressions/feliz.png"

def test_emit_registry_shape():
    cat = {"fase": "fase-1", "pieces": [
        piece(done=True),
        piece(group="stickers", slug="good-job", prefix="Doty thumbs up wink", fallback="02"),
        piece(group="games", slug="wordle", prefix="Green letter tiles", oref=False, fallback=None),
    ]}
    ts = mjlib.emit_registry(cat)
    assert ts.startswith("// GENERADO por scripts/mj/process.py --emit-registry")
    assert '  feliz: { src: "/images/Doty/expressions/feliz.png", group: "expressions" },' in ts
    assert '  "sticker-good-job": { src: "/images/Doty/DOTTY-POSES-02.png", group: "stickers" },' in ts
    assert "wordle" not in ts
    assert 'export const FALLBACK_POSE: DotyPose = "feliz";' in ts
    assert "export function toDotyPose(" in ts

def test_emit_registry_requires_feliz():
    with pytest.raises(mjlib.CatalogError, match="feliz"):
        mjlib.emit_registry({"fase": "x", "pieces": [piece(slug="triste", prefix="Doty sad", fallback="05")]})

def test_emit_registry_feliz_in_stickers_does_not_satisfy_guard():
    # registry_key() would emit "sticker-feliz", so FALLBACK_POSE "feliz" would not exist
    with pytest.raises(mjlib.CatalogError, match="feliz"):
        mjlib.emit_registry({"fase": "x", "pieces": [
            piece(group="stickers", slug="feliz", prefix="Doty happy sticker", fallback="02"),
        ]})

def test_normalize_collapses_separators():
    assert mjlib.normalize("sergio_Doty_beaming_with_joy_3f2a.png") == "sergio doty beaming with joy 3f2a png"
    assert mjlib.normalize("Doty beaming with joy") == "doty beaming with joy"

def test_match_downloads_by_prefix():
    cat = {"fase": "x", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad", fallback="05")]}
    files = ["sergio_Doty_beaming_with_joy_aaaa.png", "sergio_Doty_beaming_with_joy_bbbb.png",
             "sergio_Doty_feeling_sad_cccc.png", "random.png", "PROMPTS.md"]
    m = mjlib.match_downloads(cat, files)
    assert m["feliz"] == ["sergio_Doty_beaming_with_joy_aaaa.png", "sergio_Doty_beaming_with_joy_bbbb.png"]
    assert m["triste"] == ["sergio_Doty_feeling_sad_cccc.png"]

def test_render_dry_run_lists_states():
    cat = {"fase": "x", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad", fallback="05"),
                                   piece(slug="wow", prefix="Doty amazed", fallback="06")]}
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


def test_halo_ratio_detects_pink_fringe():
    clean = blob()
    assert mjlib.halo_ratio(clean) == 0.0
    fringe = blob()
    for x in range(50, 150):
        fringe.putpixel((x, 80), (255, 60, 150, 120))  # borde semitransparente rosado
    assert mjlib.halo_ratio(fringe) == 1.0
    grey = blob()
    for x in range(50, 150):
        grey.putpixel((x, 80), (120, 120, 120, 120))
    assert mjlib.halo_ratio(grey) == 0.0

def test_trim_square_resize_keeps_the_long_axis():
    # el sujeto de blob() es 100x40: el resultado debe seguir siendo más ancho que alto.
    # Con side=min(w,h) el contenido se recortaría a un cuadrado y ancho==alto.
    out = mjlib.trim_square_resize(blob(), 256)
    bbox = out.getbbox()
    ancho, alto = bbox[2] - bbox[0], bbox[3] - bbox[1]
    assert 0.35 * ancho <= alto <= 0.55 * ancho

def test_halo_ratio_needs_both_colour_conditions():
    # r>180 pero g>=120, y r<=180 pero g<120: ninguno es rosa. Con `or` contarían como halo.
    im = blob()
    for x in range(50, 100):
        im.putpixel((x, 80), (200, 150, 160, 120))
    for x in range(100, 150):
        im.putpixel((x, 80), (100, 50, 60, 120))
    assert mjlib.halo_ratio(im) == 0.0

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
        piece(slug="triste", prefix="Doty feeling sad", fallback="05", size=64),
        piece(slug="wow", prefix="Doty amazed", fallback="06", size=64),
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
    cat = {"fase": "fase-1", "pieces": [piece(slug="triste", prefix="Doty feeling sad", fallback="05", size=64), piece(done=True)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover, picks={"triste": "sergio_Doty_feeling_sad_c2.png"})
    assert rep["done"] == ["triste"] and rep["skipped"] == ["feliz"]
    rep2 = mjlib.apply_batch(mjlib.load_catalog(cpath), cpath, raw, repo, fake_remover)
    assert rep2["skipped"] == ["triste", "feliz"] and rep2["done"] == []


def test_render_report_sections():
    txt = mjlib.render_report({"fase": "fase-1", "done": ["feliz"], "skipped": [], "missing": ["wow"],
                               "ambiguous": ["triste"], "halo": [("feliz", 0.05)]})
    assert "# fase-1 — REPORT" in txt and "## Hechas (1)" in txt and "- wow" in txt
    assert "feliz (5.0%)" in txt
