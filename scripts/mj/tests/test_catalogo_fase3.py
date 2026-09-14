import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import mjlib

CATALOGO = pathlib.Path(__file__).resolve().parents[1] / "batches" / "fase-3.json"


def _cat():
    return mjlib.load_catalog(str(CATALOGO))


def test_son_doce_piezas_todas_del_grupo_ui():
    piezas = _cat()["pieces"]
    assert len(piezas) == 12
    assert {p["group"] for p in piezas} == {"ui"}


def test_ninguna_es_mascota():
    # Son objetos, no Doty. Si alguna llevara mascot: true recibiría el
    # brand_lock del personaje y saldría un Doty con forma de gema.
    assert all(p["mascot"] is False for p in _cat()["pieces"])


def test_exactamente_un_ancla_y_es_gemas():
    # validate_catalog ya exige exactamente un ancla por grupo no-mascota. Esto
    # fija CUÁL, porque de ella cuelga el estilo de las once restantes: si el
    # ancla cambia, hay que regenerarlas todas.
    anclas = [p["slug"] for p in _cat()["pieces"] if p.get("anchor")]
    assert anclas == ["gemas"]


def test_los_tres_del_podio_se_distinguen_por_barras_no_por_metal():
    # Oro, plata y bronce no están en la paleta y el navy está prohibido como
    # masa, así que el rango se codifica en el número de barras del disco.
    piezas = {p["slug"]: p["prompt"] for p in _cat()["pieces"]}
    assert "single vertical bar" in piezas["podio-oro"]
    assert "two short horizontal bars" in piezas["podio-plata"]
    assert "three short horizontal bars" in piezas["podio-bronce"]
    for s in ("podio-oro", "podio-plata", "podio-bronce"):
        assert "gold" not in piezas[s] and "silver" not in piezas[s] and "bronze" not in piezas[s]


def test_ningun_prompt_pide_navy_de_relleno():
    for p in _cat()["pieces"]:
        mjlib.dark_fill_mentions(p["prompt"])  # lanza si lo pide
