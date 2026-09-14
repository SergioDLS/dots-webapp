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


def test_los_tres_del_podio_son_la_misma_medalla_solo_cambia_el_color_del_disco():
    # Dos intentos anteriores (barras verticales/horizontales, luego
    # "one/two/three short horizontal bars") salieron con un numeral escrito
    # igual: la palabra "medal" con un rango asociado empuja a Midjourney para
    # ese lado pase lo que diga el resto del prompt -- no se gana esa pelea
    # con adjetivos. El rango ahora lo da el color del disco (rosa/cyan/azul,
    # los tres colores de marca) y el disco queda vacío. Esto protege que las
    # tres sigan siendo la misma plantilla -- si una cambia de forma o de
    # estructura, deja de leerse como serie -- y que ninguna vuelva a invocar
    # un puesto, un metal o un numeral.
    piezas = {p["slug"]: p["prompt"] for p in _cat()["pieces"]}
    prefijos = {p["slug"]: p["prefix"] for p in _cat()["pieces"]}
    color_por_slug = {"podio-oro": "pink", "podio-plata": "cyan", "podio-bronce": "blue"}

    plantillas = set()
    for slug, color in color_por_slug.items():
        prompt = piezas[slug]
        assert f"disc and ribbon both solid {color}" in prompt
        assert "nothing inside the disc" in prompt
        plantillas.add(prompt.replace(color, "COLOR"))
    assert len(plantillas) == 1, "las tres piezas del podio dejaron de ser la misma plantilla"

    prohibidas = ("first", "second", "third", "place", "gold", "silver", "bronze", "numeral")
    for slug in color_por_slug:
        texto = (piezas[slug] + " " + prefijos[slug]).lower()
        for palabra in prohibidas:
            assert palabra not in texto, f"{slug}: {palabra!r} invoca puesto, metal o numeral"


def test_gemas_es_ancla_con_sref_de_la_fase_2():
    # gemas no se genera "sin nada adjunto" como el resto de anclas: describir
    # la paleta con palabras no bastó (salió turquesa, con degradados) y el
    # coordinador decidió darle de ejemplo el ancla ya cerrada de la fase 2
    # (estructuras.png), que ya encarna el acabado correcto. mjlib.emit_lote
    # depende de este campo para no mentirle al operador en el lote.
    gemas = next(p for p in _cat()["pieces"] if p["slug"] == "gemas")
    assert gemas["anchor_sref"] == "public/images/levels/estructuras.png"


def test_ningun_prompt_invita_a_degradado_o_brillo():
    # La tanda descartada salió con degradados y brillos: "lighter cyan
    # highlight facet" (gemas) y "white highlight" (vidas) son las dos
    # palabras que de verdad lo pidieron. Se revisan las doce, no solo esas
    # dos, para que no se cuele otra del mismo patrón.
    palabras = ("highlight", "shiny", "glossy", "sparkle", "gleam", "lighter")
    for p in _cat()["pieces"]:
        texto = p["prompt"].lower()
        for palabra in palabras:
            assert palabra not in texto, f"{p['slug']}: {palabra!r} invita a brillo o degradado"


def test_ningun_prompt_pide_navy_de_relleno():
    for p in _cat()["pieces"]:
        mjlib.dark_fill_mentions(p["prompt"])  # lanza si lo pide
