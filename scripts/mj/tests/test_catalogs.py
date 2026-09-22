import re
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCH = Path(__file__).resolve().parents[1] / "batches" / "fase-1.json"
BATCHES_DIR = Path(__file__).resolve().parents[1] / "batches"

SLUGS = {
    "expressions": {"feliz", "muy-feliz", "emocionado", "orgulloso", "sorprendido", "pensando",
                    "preocupado", "triste", "enojado", "decepcionado", "riendo", "timido",
                    "enamorado", "cansado", "dormido"},
    "poses": {"saludando", "pulgar-arriba", "senalando", "ven-aqui", "bienvenido", "aplaudiendo", "caminando",
              "corriendo", "saltando", "bailando", "sentado", "leyendo", "escribiendo",
              "en-laptop", "escuchando", "en-celular", "hablando", "taxista"},
    "states": {"wow", "oh-no", "ups", "excelente", "perfecto", "sigue-asi"},
    "celebrations": {"lo-lograste", "confeti", "trofeo-celebracion", "medalla",
                     "diploma-celebracion", "fuegos-artificiales"},
    "accessories": {"libro", "lapiz", "laptop", "tablet", "celular", "mochila", "taza", "diploma",
                    "trofeo", "microfono", "bandera-uk", "bandera-usa", "maleta", "lentes",
                    "idea", "globo"},
    "themed": {"navidad", "halloween", "san-valentin", "fiestas-patrias", "graduacion",
               "back-to-school"},
    "stickers": {"good-job", "amazing", "keep-going", "you-can-do-it", "lets-practice", "oops",
                 "almost", "nice", "excellent", "see-you"},
    "games": {"wordle", "crossword", "dot-match", "true-false", "memory", "audio-blitz",
              "word-tower", "sentence-builder", "ghost-race", "dotaxi", "dont-pop", "dot-bombs",
              # arte de dentro de dotaxi (no tiles): el taxi cenital, sus dos estados
              # de daño editados a partir de él, el bache y la casa de llegada
              "dotaxi-taxi", "dotaxi-taxi-d1", "dotaxi-taxi-d2", "dotaxi-taxi-d3", "dotaxi-taxi-d4",
              "dotaxi-taxi-wrecked", "dotaxi-pothole", "dotaxi-puerto", "dotaxi-laboratorio", "dotaxi-estadio",
              "dotaxi-skyline-dia", "dotaxi-skyline-noche"},
    "characters": {"doty-fem", "doty-sailor", "doty-scientist"},
    "app-icon": {"app-icon"},
}

# Fallbacks que la tabla §4.5 del spec de diseño nombra explícitamente.
EXPECTED = {g: len(s) for g, s in SLUGS.items()}
GAMES = SLUGS["games"]

def test_fase1_counts_and_rules():
    cat = mjlib.load_catalog(BATCH)
    counts = Counter(p["group"] for p in cat["pieces"])
    assert dict(counts) == EXPECTED and len(cat["pieces"]) == 105
    for p in cat["pieces"]:
        # "games" es ahora el unico grupo no-mascota: "icons" (correcto,
        # incorrecto, atencion, cargando, racha, nivel-completado) se retiro
        # entero, ver test_fase1_slugs_exactos_por_grupo.
        expect_mascot = p["group"] != "games"
        assert p["mascot"] is expect_mascot, p["slug"]
        if p.get("aspect"):
            assert p["size"] == 1536, p["slug"]  # franjas 3:1: el lado largo
        else:
            assert p["size"] == (512 if p["group"] == "games" else 1024), p["slug"]
        assert "," not in p["prefix"], p["slug"]
        assert "glasses" not in p["prompt"].lower() or p["slug"] in ("lentes", "doty-scientist"), p["slug"]
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "games"} == GAMES
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "characters"} == {"doty-fem", "doty-sailor", "doty-scientist"}
    assert any(p["slug"] == "hablando" and p["group"] == "poses" for p in cat["pieces"])
    assert len({p["prefix"] for p in cat["pieces"]}) == 105

def test_solo_lentes_y_scientist_llevan_glasses():
    cat = mjlib.load_catalog(BATCH)
    con_glasses = {p["slug"] for p in cat["pieces"] if p.get("glasses")}
    assert con_glasses == {"lentes", "doty-scientist"}

def test_fase1_slugs_exactos_por_grupo():
    cat = mjlib.load_catalog(BATCH)
    por_grupo = {}
    for p in cat["pieces"]:
        por_grupo.setdefault(p["group"], set()).add(p["slug"])
    assert por_grupo == SLUGS

def test_ninguna_pieza_arrastra_el_campo_fallback():
    # `fallback` elegia uno de los 22 sprites legacy, que se archivaron en
    # public/images/doty-classic/ al cerrarse la fase 1. Dejarlo en el catalogo
    # invita a interpretarlo, y apuntar ahi genera un registro que
    # check-doty-assets rechaza por "falta en disco".
    cat = mjlib.load_catalog(BATCH)
    assert [p["slug"] for p in cat["pieces"] if "fallback" in p] == []


def test_el_placeholder_es_una_pieza_real_y_hecha():
    cat = mjlib.load_catalog(BATCH)
    hechas = {mjlib.registry_src(p) for p in cat["pieces"] if p.get("done")}
    assert mjlib.PLACEHOLDER in hechas

def test_fase1_ancla_es_exactamente_wordle():
    # wordle abre `games`, la unica familia no-mascota que queda en fase 1: el
    # grupo `icons` (y su ancla `correcto`) se retiro entero, ver
    # test_fase1_slugs_exactos_por_grupo. De un ancla cuelga el estilo de todo
    # su grupo (spec Sec.2-bis): si cambia, hay que regenerar el grupo entero.
    cat = mjlib.load_catalog(BATCH)
    anclas = {p["slug"] for p in cat["pieces"] if p.get("anchor")}
    assert anclas == {"wordle"}


def _normaliza_como_mj(prefix: str) -> str:
    """Imita el nombre de archivo que Midjourney genera al descargar: todo en
    minúsculas y cada tramo no alfanumérico colapsado a un solo guion bajo
    (así lucen los `source_file` que ya hay en disco, p. ej.
    "Mandrakin_Doty_in_on_and_under_a_box_..."). No es `mjlib.normalize()`
    -esa usa espacios y sirve a la comprobación de substring de
    `validate_catalog`-, sino la forma real del archivo que hay que
    reasociar a su pieza.
    """
    return re.sub(r"[^a-z0-9]+", "_", prefix.lower())


@pytest.mark.parametrize("n", [20, 30])
def test_prefijos_no_colisionan_truncados_al_nombre_de_archivo_mj(n):
    # Midjourney nombra el archivo descargado con las primeras palabras del
    # prompt, y `match_downloads` reasocia cada descarga a su pieza por ese
    # nombre. `validate_catalog` ya rechaza que un prefix completo sea
    # substring de otro, pero eso no alcanza: dos prefijos distintos en su
    # totalidad pueden colapsar al mismo texto una vez truncados a como queda
    # el nombre de archivo real. Cuando eso pasa el pipeline asigna el arte a
    # la pieza equivocada SIN dar ningún error -- nadie se entera hasta ver
    # el Camino con los dibujos cambiados. Se revisa por catálogo (no
    # fusionado entre fases) porque cada fase descarga a su propia carpeta:
    # solo una colisión dentro del mismo archivo es un riesgo real.
    # fase-0.json es la matriz de calibracion de GPU-minutes del diseno
    # original (2026-09-09, ver style.json:gpu_minutes_medidos): es anterior a
    # la regla de anchor y hoy ya no pasa mjlib.load_catalog() por eso (grupo
    # "poses" tiene una pieza no-mascota, t15-sref-only-saludando, sin ancla).
    # Ningun test la cargo nunca -- nadie lo noto porque nada lo ejercitaba.
    # Tampoco paso nunca por --emit-lote/--apply, los comandos que de verdad
    # emparejan descargas por prefix (solo por --emit-prompts/--dry-run, ver
    # docs/superpowers/plans/2026-09-07-doty-midjourney-assets.md); no es un
    # catalogo de generacion real, asi que queda fuera de esta comprobacion.
    for path in sorted(BATCHES_DIR.glob("fase-*.json")):
        if path.name == "fase-0.json":
            continue
        cat = mjlib.load_catalog(path)
        vistos: dict[str, str] = {}
        for p in cat["pieces"]:
            clave = _normaliza_como_mj(p["prefix"])[:n]
            if clave in vistos:
                pytest.fail(
                    f"{path.name}: {p['slug']!r} y {vistos[clave]!r} colisionan "
                    f"truncados a {n} caracteres ({clave!r})"
                )
            vistos[clave] = p["slug"]


# ── edit_from: variantes editadas a partir de otra pieza ──────────────────────

def _cat_games(*extra):
    """Catálogo mínimo válido del grupo games (necesita su ancla) más piezas extra."""
    base = [
        {"slug": "ancla", "group": "games", "prefix": "Anchor tile", "prompt": "a tile",
         "size": 512, "mascot": False, "anchor": True, "done": True, "source_file": "Mandrakin_Anchor_tile_x_0.png"},
        {"slug": "taxi", "group": "games", "prefix": "Yellow taxi from above", "prompt": "a taxi",
         "size": 512, "mascot": False, "done": True, "source_file": "Mandrakin_Yellow_taxi_from_above_x_2.png"},
    ]
    return {"fase": "fase-t", "pieces": base + list(extra)}


def _variant(**over):
    p = {"slug": "taxi-dented", "group": "games", "prefix": "Dented yellow taxi", "prompt": "two dents",
         "size": 512, "mascot": False, "done": False, "edit_from": "taxi"}
    p.update(over)
    return p


def test_edit_from_valid_passes():
    mjlib.validate_catalog(_cat_games(_variant()))


def test_edit_from_unknown_slug_fails():
    with pytest.raises(mjlib.CatalogError, match="not a slug"):
        mjlib.validate_catalog(_cat_games(_variant(edit_from="nope")))


def test_edit_from_cannot_be_anchor():
    cat = _cat_games(_variant(anchor=True))
    cat["pieces"][0]["anchor"] = False  # deja a la variante como única ancla
    with pytest.raises(mjlib.CatalogError, match="anchor cannot be an edit_from"):
        mjlib.validate_catalog(cat)


def test_edit_from_must_share_group():
    cat = _cat_games(_variant(group="ui"))
    cat["pieces"].append({"slug": "ui-ancla", "group": "ui", "prefix": "Ui anchor", "prompt": "x",
                          "size": 256, "mascot": False, "anchor": True, "done": True})
    with pytest.raises(mjlib.CatalogError, match="not 'ui'"):
        mjlib.validate_catalog(cat)


def test_edit_from_prompt_is_an_edit_instruction_without_flags():
    style = mjlib.load_style(Path(__file__).resolve().parents[1] / "style.json")
    prompt = mjlib.build_prompt(_variant(), style)
    assert "--ar" not in prompt and "--no" not in prompt
    assert "exactly as in the source image" in prompt


def test_emit_lote_tells_operator_which_download_to_attach():
    style = mjlib.load_style(Path(__file__).resolve().parents[1] / "style.json")
    out = mjlib.emit_lote(_cat_games(_variant()), style, ["games"], pendientes_solo=True)
    assert "🖌️ edición" in out
    assert "fase-t/Mandrakin_Yellow_taxi_from_above_x_2.png" in out
    assert "Style reference* va vacío" in out


def test_emit_lote_warns_when_source_not_generated_yet():
    style = mjlib.load_style(Path(__file__).resolve().parents[1] / "style.json")
    cat = _cat_games(_variant())
    cat["pieces"][1]["done"] = False
    del cat["pieces"][1]["source_file"]
    out = mjlib.emit_lote(cat, style, ["games"], pendientes_solo=True)
    assert "aún no está generada" in out


def test_fase1_dotaxi_variants_are_edits_of_the_intact_taxi():
    cat = mjlib.load_catalog(BATCH)
    by = {p["slug"]: p for p in cat["pieces"]}
    for slug in ("dotaxi-taxi-d1", "dotaxi-taxi-d2", "dotaxi-taxi-d3", "dotaxi-taxi-d4", "dotaxi-taxi-wrecked"):
        assert by[slug]["edit_from"] == "dotaxi-taxi"
    for slug in ("dotaxi-pothole", "dotaxi-puerto", "dotaxi-laboratorio", "dotaxi-estadio"):
        assert "edit_from" not in by[slug]


# ── aspect: formato por pieza (franjas de skyline) ─────────────────────────────

def test_aspect_overrides_style_ar():
    style = mjlib.load_style(Path(__file__).resolve().parents[1] / "style.json")
    strip = {"slug": "skyline", "group": "games", "prefix": "Skyline strip", "prompt": "buildings",
             "size": 1536, "mascot": False, "done": False, "aspect": "3:1"}
    assert "--ar 3:1" in mjlib.build_prompt(strip, style)
    plain = dict(strip, aspect=None)
    assert f"--ar {style['aspect']}" in mjlib.build_prompt(plain, style)


def test_aspect_must_be_w_colon_h():
    cat = _cat_games({"slug": "skyline", "group": "games", "prefix": "Skyline strip", "prompt": "buildings",
                      "size": 1536, "mascot": False, "done": False, "aspect": "wide"})
    with pytest.raises(mjlib.CatalogError, match="aspect must look like"):
        mjlib.validate_catalog(cat)

