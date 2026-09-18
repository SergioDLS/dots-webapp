import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import mjlib

BATCHES = pathlib.Path(__file__).resolve().parents[1] / "batches"
CATALOGO = BATCHES / "fase-4.json"

EXPRESIONES = {"en-llamas", "aura", "cocinado", "llanto-dramatico", "cerebro-galaxia", "reojo",
               "mente-volada", "lentes-deal", "gamer", "chismoso", "facepalm", "flexeando",
               "meditando", "bostezo"}
NARRADORES = {"narrador-beginner", "narrador-intermediate", "narrador-advanced"}
AVATARES_GRATIS = {"clasico", "nerd", "crack", "hype", "buena-onda", "techie"}
AVATARES_PAGO = {"superheroe", "campeon", "jugador", "veloz", "capitan", "astronauta", "chef", "rockstar",
                 "detective", "pirata", "mago", "surfista", "ninja", "artista", "dj", "explorador"}
PERSONAJES = {"fem", "marinero", "cientifica"}
FRANQUICIAS = re.compile(r"dragon ?ball|saiyan|sayayin|goku|pokemon|mario|sonic|naruto|marvel|disney", re.I)


def _cat():
    return mjlib.load_catalog(str(CATALOGO))


def _por_grupo(cat):
    out = {}
    for p in cat["pieces"]:
        out.setdefault(p["group"], set()).add(p["slug"])
    return out


def test_grupos_y_slugs_exactos():
    g = _por_grupo(_cat())
    assert g["expressions"] == EXPRESIONES
    assert g["poses"] == NARRADORES
    assert g["avatars"] == AVATARES_GRATIS | AVATARES_PAGO | PERSONAJES
    assert set(g) == {"expressions", "poses", "avatars"}
    assert len(_cat()["pieces"]) == 42


def test_todo_es_mascota_con_tamano_por_grupo():
    # `done` no se comprueba: deja de ser falso en cuanto se aplica una tanda, y
    # los tests de las fases ya trabajadas (2 y 3) tampoco lo miran. Lo que sigue
    # siendo invariante es que todas son piezas de mascota y su tamaño por grupo.
    for p in _cat()["pieces"]:
        assert p["mascot"] is True, p["slug"]
        assert p["size"] == (512 if p["group"] == "avatars" else 1024), p["slug"]


def test_los_avatares_son_retratos():
    for p in _cat()["pieces"]:
        if p["group"] == "avatars":
            assert "head and shoulders" in p.get("framing", ""), p["slug"]
        else:
            assert "framing" not in p, p["slug"]


def test_ninguna_franquicia_por_nombre():
    for p in _cat()["pieces"]:
        assert not FRANQUICIAS.search(p["prompt"] + " " + p["prefix"]), p["slug"]


def test_prefijos_arrancan_por_su_familia():
    for p in _cat()["pieces"]:
        esperado = "Avatar Doty" if p["group"] == "avatars" else "Doty"
        assert p["prefix"].startswith(esperado), p["slug"]


def test_las_llamas_van_pegadas_al_cuerpo():
    en_llamas = next(p for p in _cat()["pieces"] if p["slug"] == "en-llamas")
    assert "touching the silhouette" in en_llamas["prompt"]
    assert "nothing floating" in en_llamas["prompt"]


def test_solo_las_piezas_con_lentes_llevan_glasses():
    con = {p["slug"] for p in _cat()["pieces"] if p.get("glasses")}
    assert con == {"aura", "lentes-deal", "nerd", "cientifica"}


def test_los_personajes_conservan_el_color_de_fase1():
    """El mismo personaje no puede cambiar de cuerpo entre fases.

    Se compara el HEX y no el `brand_lock` entero porque la redaccion difiere a
    proposito: en fase-4 las tres piezas se generan adjuntando su render
    canonico de fase-1, asi que su lock dice "the exact violet of the attached
    character" — una frase que en fase-1, donde no hay nada adjunto, hablaria de
    si misma. Lo que hay que blindar es el color, que es lo que se fue: los tres
    hex de fase-1 estaban inventados y ninguno coincidia con el personaje (ver
    docs/brand/doty-identity.md, lecciones de la tanda 3). Medido sobre el arte
    publicado, el cuerpo de fem da #A830B8, el de marinero #D80030 y el de
    cientifica #A088D0 — los de fase-4, no los viejos.
    """
    f1 = {p["slug"]: p for p in json.loads((BATCHES / "fase-1.json").read_text(encoding="utf-8"))["pieces"]}
    f4 = {p["slug"]: p for p in _cat()["pieces"]}

    def hexes(pieza):
        encontrados = re.findall(r"#[0-9A-Fa-f]{6}", pieza["brand_lock"])
        assert len(encontrados) == 1, f"{pieza['slug']}: se espera un solo hex, hay {encontrados}"
        return encontrados[0].upper()

    for viejo_slug, nuevo_slug in [("doty-fem", "fem"), ("doty-sailor", "marinero"),
                                   ("doty-scientist", "cientifica")]:
        assert hexes(f4[nuevo_slug]) == hexes(f1[viejo_slug]), nuevo_slug


def test_el_registro_unido_con_fase1_no_repite_claves_y_suma_las_expresiones():
    f1 = mjlib.load_catalog(str(BATCHES / "fase-1.json"))
    ts = mjlib.emit_registry([f1, _cat()])
    assert '"en-llamas"' in ts and "narradorBeginner" not in ts  # kebab-case va entre comillas
    assert '"narrador-beginner"' in ts
    assert ts.count("feliz:") == 1
