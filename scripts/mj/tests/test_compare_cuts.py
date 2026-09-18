import pathlib
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import compare_cuts  # noqa: E402
import mjlib  # noqa: E402


def disco(size=256, alfa=255, fleco_px=0, color=(255, 31, 143)):
    """Disco con antialiasing real: se dibuja a 4x y se reduce."""
    s = size * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    off = s * 0.12
    if fleco_px:
        g = fleco_px * 4
        d.ellipse([off - g, off - g, s - off + g, s - off + g], fill=(*color, 110))
    d.ellipse([off, off, s - off, s - off], fill=(*color, alfa))
    return im.resize((size, size), Image.LANCZOS)


def test_medidas_de_un_sprite_limpio():
    # No llega a 255: la orla de antialiasing pesa mas en un disco de 256 px que
    # en un avatar real, donde la misma banda de ~1.4 px reparte sobre mas area.
    # Los 25 avatares publicados miden entre 249 y 251.
    m = compare_cuts.medidas(disco())
    assert m["alfa"] > 240
    assert m["blando"] < 0.01
    assert m["fleco"] < 2.5


def test_medidas_ven_el_cuerpo_traslucido():
    limpio = compare_cuts.medidas(disco())
    roto = compare_cuts.medidas(disco(alfa=120))
    assert roto["alfa"] < limpio["alfa"] - 50
    assert roto["blando"] > 0.99


def test_el_fleco_de_compare_cuts_no_mira_el_color():
    """La razon de ser de esta metrica frente a `halo_thickness_px`.

    Aquella solo cuenta pixeles ROSADOS saturados (r>180, g<120), asi que es
    ciega con los tres personajes de color propio: el fleco de `cientifica` es
    blanquecino y el de `marinero` carmin. Justo donde hace falta comparar.
    """
    gris = (170, 170, 175)
    limpio = disco(color=gris)
    con_fleco = disco(color=gris, fleco_px=6)

    assert mjlib.halo_thickness_px(con_fleco) == mjlib.halo_thickness_px(limpio) == 0.0
    assert compare_cuts.medidas(con_fleco)["fleco"] > compare_cuts.medidas(limpio)["fleco"] * 1.5


def _m(alfa, blando, fleco):
    return {"alfa": alfa, "blando": blando, "fleco": fleco}


def test_veredicto_calla_cuando_el_cambio_es_ruido():
    antes = _m(250.0, 0.010, 1.70)
    ahora = _m(250.4, 0.011, 1.74)
    assert compare_cuts.veredicto(antes, ahora) == "="


def test_veredicto_mejor_cuando_las_tres_medidas_ganan():
    assert compare_cuts.veredicto(_m(201, 0.5146, 8.30), _m(251, 0.0, 1.44)) == "mejor"


def test_veredicto_peor_cuando_las_tres_medidas_pierden():
    assert compare_cuts.veredicto(_m(251, 0.0, 1.44), _m(201, 0.5146, 8.30)) == "PEOR"


def test_veredicto_mixta_no_se_vende_como_mejora():
    # Gana opacidad y estrena fleco: eso no es una mejora, es algo que mirar.
    assert compare_cuts.veredicto(_m(230, 0.02, 1.60), _m(252, 0.001, 4.90)) == "mixta"


def test_movimiento_ordena_por_cuanto_cambio_no_por_si_mejoro():
    """Una pieza que empeora mucho tiene que salir arriba de la lista: la tabla
    es para mirar primero lo que mas se movio, en cualquier direccion."""
    quieta = (_m(250, 0.01, 1.70), _m(250, 0.01, 1.72))
    hundida = (_m(251, 0.0, 1.44), _m(201, 0.5146, 8.30))
    assert compare_cuts.movimiento(*hundida) > compare_cuts.movimiento(*quieta) * 50
