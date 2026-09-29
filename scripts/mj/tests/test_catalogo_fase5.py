import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCHES = Path(__file__).resolve().parents[1] / "batches"
BATCH = BATCHES / "fase-5.json"

# Las 46 piezas nuevas de la spec 2026-09-29-tiles-de-modulos, por tanda. El
# catálogo crece tanda a tanda: una tanda entra entera o no entra.
TANDAS = {
    1: {"formas", "abecedario", "numeros-1-20", "decenas", "dias", "meses",
        "estaciones", "partes-del-dia", "clima", "hora", "colores", "familia",
        "profesiones", "ropa", "cuerpo", "cuidado-personal", "alimentos",
        "comidas", "frutas", "cocina", "deportes", "animales", "casa",
        "muebles", "escuela", "ciudad"},
    2: {"luna", "peces", "volcan", "pelo", "oceano", "telefono", "saludos",
        "supervivencia", "frases-clase", "cognados", "falsos-amigos"},
    3: {"ship-sheep", "hat-hut", "bath-bat", "heart-art", "van-ban",
        "cash-catch", "sonido", "adjetivos", "hay"},
}
NUEVAS = set().union(*TANDAS.values())
MASCOTA = {"familia", "saludos", "supervivencia", "frases-clase", "falsos-amigos", "hay"}


def _cat():
    return mjlib.load_catalog(BATCH)


def _slugs():
    return {p["slug"] for p in _cat()["pieces"]}


def test_las_tandas_suman_46_sin_repetir():
    todas = [s for t in TANDAS.values() for s in t]
    assert (len(TANDAS[1]), len(TANDAS[2]), len(TANDAS[3])) == (26, 11, 9)
    assert len(todas) == len(set(todas)) == 46


def test_el_catalogo_solo_trae_piezas_de_la_spec():
    assert _slugs() <= NUEVAS, _slugs() - NUEVAS


def test_las_tandas_entran_enteras_y_en_orden():
    slugs = _slugs()
    parciales = [n for n, t in TANDAS.items() if t & slugs and not t <= slugs]
    assert not parciales, parciales
    presentes = [n for n, t in TANDAS.items() if t <= slugs]
    assert presentes == list(range(1, len(presentes) + 1))


def test_todas_son_del_grupo_levels_a_512():
    for p in _cat()["pieces"]:
        assert p["group"] == "levels", p["slug"]
        assert p["size"] == 512, p["slug"]


def test_ningun_slug_pisa_un_tile_de_la_fase_2():
    fase2 = {p["slug"] for p in mjlib.load_catalog(BATCHES / "fase-2.json")["pieces"]}
    assert not (NUEVAS & fase2), NUEVAS & fase2


def test_el_ancla_es_formas_y_hereda_de_estructuras():
    anclas = [p for p in _cat()["pieces"] if p.get("anchor")]
    assert [p["slug"] for p in anclas] == ["formas"]
    assert anclas[0]["anchor_sref"] == "public/images/levels/estructuras.png"
    assert (BATCHES.parents[2] / anclas[0]["anchor_sref"]).exists()


def test_doty_solo_donde_la_spec_lo_pone():
    assert {p["slug"] for p in _cat()["pieces"] if p.get("mascot")} == MASCOTA & _slugs()


def test_solo_abecedario_y_numeros_llevan_glifos():
    assert {p["slug"] for p in _cat()["pieces"] if p.get("glyphs")} == \
        {"abecedario", "numeros-1-20"} & _slugs()


def test_solo_colores_sale_de_la_paleta_cerrada():
    assert {p["slug"] for p in _cat()["pieces"] if p.get("icon_block")} == {"colores"} & _slugs()
