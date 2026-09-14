import json
import pathlib
import re
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


def _color_del_disco(prompt: str) -> str:
    """Extrae el color del disco de un prompt del podio. Las tres piezas ya no
    comparten una plantilla textual idéntica -- podio-bronce fija a mano el
    hex de marca -- así que hacen falta dos formas: "disc and ribbon both
    solid {color}" (oro y plata) y "the disc solid {hex} {color} and the
    ribbon solid {hex} {color}" (bronce)."""
    m = re.search(r"disc and ribbon both solid (\w+)", prompt)
    if m:
        return m.group(1)
    m = re.search(r"the disc solid \S+ ([a-z ]+?) and the ribbon", prompt)
    if m:
        return m.group(1).strip()
    raise AssertionError(f"no se pudo leer el color del disco en: {prompt!r}")


def test_los_tres_del_podio_comparten_forma_y_cada_uno_tiene_disco_de_color_distinto():
    # Versión anterior de este test: exigía la plantilla literal "disc and
    # ribbon both solid {color}" en las tres piezas. Esa afirmación ya era
    # falsa antes de que podio-bronce cambiara -- el arte generado de
    # podio-oro salió con disco rosa y cinta cyan pese a pedir "both solid
    # pink", así que Midjourney nunca respetó el "both" -- y con tres colores
    # de relleno y un objeto de dos partes tampoco es alcanzable: si disco y
    # cinta comparten color la pieza queda monocroma, y si la cinta es
    # siempre el mismo color choca con el disco en una de las tres. Lo que de
    # verdad hay que proteger es más débil pero cierto: que las tres sigan
    # siendo la misma medalla, que cada una tenga su propio color de disco, y
    # que ninguna vuelva a nombrar un puesto, un metal o un numeral.
    piezas = {p["slug"]: p["prompt"] for p in _cat()["pieces"]}
    prefijos = {p["slug"]: p["prefix"] for p in _cat()["pieces"]}
    slugs = ("podio-oro", "podio-plata", "podio-bronce")

    compartido = ("round medal hanging from a short ribbon", "nothing inside the disc")
    for slug in slugs:
        for fragmento in compartido:
            assert fragmento in piezas[slug], f"{slug}: no describe {fragmento!r}"

    colores = {slug: _color_del_disco(piezas[slug]) for slug in slugs}
    assert len(set(colores.values())) == len(slugs), (
        f"los discos del podio no son de tres colores distintos: {colores}"
    )

    prohibidas = ("first", "second", "third", "place", "gold", "silver", "bronze", "numeral")
    for slug in slugs:
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


def test_las_doce_piden_saturacion_plena_sin_metalico_ni_transparencia():
    # La tanda descartada no solo salió del tono equivocado: salió lavada
    # (mediana 21% de píxeles apagados contra 4.2% de los tiles de la fase 2,
    # medido por el coordinador en la ronda 4 sobre la tanda real). Nombrar el
    # hex no bastó -- Midjourney lo suaviza, sobre todo en objetos metálicos o
    # translúcidos -- así que las doce piden la saturación como propiedad
    # explícita, no solo el color como valor.
    marcadores = ("full saturation", "no metallic finish", "no transparency", "no shading")
    for p in _cat()["pieces"]:
        for marcador in marcadores:
            assert marcador in p["prompt"], f"{p['slug']}: falta {marcador!r}"


def test_gemas_trofeo_medalla_y_podio_piden_forma_no_material():
    # Estas seis son, por convención, objetos de metal o cristal de verdad --
    # ahí es donde salió el peor lavado de la tanda descartada (las tres del
    # podio primero, gema y trofeo justo detrás). Cada una tiene que decir
    # explícitamente que es la FORMA del objeto, no el material: una gema de
    # cristal o una medalla de metal traen brillos y medios tonos por
    # definición, y ningún adjetivo de color se los va a quitar.
    con_riesgo_de_material = {"gemas", "trofeo", "medalla", "podio-oro", "podio-plata", "podio-bronce"}
    piezas = {p["slug"]: p["prompt"] for p in _cat()["pieces"]}
    for slug in con_riesgo_de_material:
        assert "not real" in piezas[slug], f"{slug}: no declara forma-no-material"
    # Y ninguna de las otras seis debería necesitarlo -- si aparece ahí, algo
    # se copió de más.
    for slug, prompt in piezas.items():
        if slug not in con_riesgo_de_material:
            assert "not real" not in prompt, f"{slug}: forma-no-material fuera de lugar"
