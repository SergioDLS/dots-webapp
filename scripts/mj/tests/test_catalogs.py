import sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCH = Path(__file__).resolve().parents[1] / "batches" / "fase-1.json"

SLUGS = {
    "expressions": {"feliz", "muy-feliz", "emocionado", "orgulloso", "sorprendido", "pensando",
                    "preocupado", "triste", "enojado", "decepcionado", "riendo", "timido",
                    "enamorado", "cansado", "dormido"},
    "poses": {"saludando", "pulgar-arriba", "senalando", "ven-aqui", "bienvenido", "aplaudiendo", "caminando",
              "corriendo", "saltando", "bailando", "sentado", "leyendo", "escribiendo",
              "en-laptop", "escuchando", "en-celular", "hablando"},
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
              "word-tower", "sentence-builder", "ghost-race", "dotaxi", "dont-pop", "dot-bombs"},
    "characters": {"doty-fem", "doty-sailor", "doty-scientist"},
    "app-icon": {"app-icon"},
}

# Fallbacks que la tabla §4.5 del spec de diseño nombra explícitamente.
EXPECTED = {g: len(s) for g, s in SLUGS.items()}
GAMES = SLUGS["games"]

def test_fase1_counts_and_rules():
    cat = mjlib.load_catalog(BATCH)
    counts = Counter(p["group"] for p in cat["pieces"])
    assert dict(counts) == EXPECTED and len(cat["pieces"]) == 92
    for p in cat["pieces"]:
        # "games" es ahora el unico grupo no-mascota: "icons" (correcto,
        # incorrecto, atencion, cargando, racha, nivel-completado) se retiro
        # entero, ver test_fase1_slugs_exactos_por_grupo.
        expect_mascot = p["group"] != "games"
        assert p["mascot"] is expect_mascot, p["slug"]
        assert p["size"] == (512 if p["group"] == "games" else 1024), p["slug"]
        assert "," not in p["prefix"], p["slug"]
        assert "glasses" not in p["prompt"].lower() or p["slug"] in ("lentes", "doty-scientist"), p["slug"]
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "games"} == GAMES
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "characters"} == {"doty-fem", "doty-sailor", "doty-scientist"}
    assert any(p["slug"] == "hablando" and p["group"] == "poses" for p in cat["pieces"])
    assert len({p["prefix"] for p in cat["pieces"]}) == 92

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
