import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCH = Path(__file__).resolve().parents[1] / "batches" / "fase-2.json"

# Los 70 niveles de las secciones 2 a 12, según la tabla de la spec.
# Las 25 de vocabulario de la sección 1 NO están y no deben estarlo.
ASIGNACION = {
    "esto-eso": [20], "reflexivos": [24, 32], "singular-plural": [27],
    "preposiciones": [29, 95], "frecuencia": [30], "comparativo": [35],
    "parecido": [37], "preguntas": [38], "cantidad": [40, 53],
    "desde-durante": [41], "opuestos": [55, 94], "exclamaciones": [56],
    "palabras-compuestas": [57], "acciones": [58], "conectores": [62],
    "condicionales": [64], "imperativo": [65], "estilo-indirecto": [70],
    "deseo": [73], "modismos": [84], "jerga": [85], "formal-informal": [86],
    "no-me-gusta": [87], "me-gusta": [88], "presentarse": [89], "calma": [90],
    "te-extrano": [91], "decir-no": [92], "felicitar": [93],
    "pronombres": [21, 22, 26, 36], "presente": [23, 25],
    "pasado": [31, 34, 42, 43, 67], "futuro": [51, 52, 66, 76, 77],
    "perfectos": [59, 60, 61], "modales": [54, 69, 74, 75],
    "estructuras": [63, 68, 71, 72, 78, 79, 80, 81, 82, 83],
    "articulos": [19, 33, 39], "complementos": [28],
}


def test_cada_nivel_aparece_exactamente_una_vez():
    # El fallo fácil de una tabla escrita a mano es un nivel olvidado o contado
    # dos veces, y no se ve leyéndola.
    todos = [n for ids in ASIGNACION.values() for n in ids]
    esperados = set(range(19, 96)) - {44, 45, 46, 47, 48, 49, 50}
    assert len(todos) == len(set(todos)), "hay niveles repetidos"
    assert set(todos) == esperados


def test_el_catalogo_cubre_la_asignacion():
    cat = mjlib.load_catalog(BATCH)
    slugs = {p["slug"] for p in cat["pieces"]}
    assert slugs == set(ASIGNACION), slugs ^ set(ASIGNACION)


def test_todas_son_del_grupo_levels_a_512():
    cat = mjlib.load_catalog(BATCH)
    for p in cat["pieces"]:
        assert p["group"] == "levels", p["slug"]
        assert p["size"] == 512, p["slug"]


def test_exactamente_un_ancla_y_es_estructuras():
    # validate_catalog ya exige una por grupo no-mascota; esto fija CUÁL, porque
    # el ancla define el lenguaje visual de los símbolos puros restantes. Vive
    # en estructuras y no en preposiciones: la revisión movió el ancla porque
    # preposiciones pasó a llevar a Doty dibujado, y anchor exige mascot: false.
    cat = mjlib.load_catalog(BATCH)
    anclas = [p["slug"] for p in cat["pieces"] if p.get("anchor")]
    assert anclas == ["estructuras"]
