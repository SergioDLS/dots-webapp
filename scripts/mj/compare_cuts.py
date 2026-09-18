# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["pillow>=10"]
# ///
"""Compara el recorte de las piezas publicadas contra una referencia de git.

  uv run scripts/mj/compare_cuts.py                    # arbol de trabajo vs HEAD
  uv run scripts/mj/compare_cuts.py --ref HEAD~3
  uv run scripts/mj/compare_cuts.py --top 20 --todas

Para que existe: recortar el catalogo entero con otro modelo deja 102 PNGs
cambiados y ninguna forma de saber cuales mejoraron. Los canarios de
`apply_batch` no sirven aqui — son umbrales, cantan el desastre y callan la
mejora pequena. La bata de `cientifica` estuvo rota marcando 1.42 % de interior
blando, muy por debajo del umbral del 10 %.

Esto no pone umbrales: mide las dos versiones de cada pieza y las ordena por
cuanto se movieron, para mirar primero las que mas cambiaron. El veredicto de
cada fila es una pista, no un fallo: quien decide si una pieza mejoro es el ojo.
"""
from __future__ import annotations

import argparse
import io
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
import mjlib  # noqa: E402

# Carpetas con arte recortado por el pipeline, relativas al repo.
DIRS = [
    "public/images/avatars",
    "public/images/Doty/poses",
    "public/images/Doty/expressions",
    "public/images/Doty/states",
    "public/images/Doty/celebrations",
    "public/images/Doty/accessories",
]

# Cuanto tiene que moverse una medida para no ser ruido de recompresion.
RUIDO = {"alfa": 1.0, "blando": 0.003, "fleco": 0.10}


def medidas(img: "Image.Image") -> dict[str, float]:
    """Alfa medio, interior blando y grosor de fleco de un sprite ya recortado.

    El fleco se mide SIN mirar el color, al reves que `halo_thickness_px`, que
    solo cuenta pixeles rosados saturados (r>180, g<120). Esa metrica es ciega
    con los tres personajes de color propio — el fleco de `cientifica` es
    blanquecino y el de `marinero` carmin — y justamente ahi es donde hace falta
    comparar. A cambio, este numero no distingue un fleco de un antialiasing
    honesto, asi que solo vale para comparar la MISMA pieza consigo misma.
    """
    img = img.convert("RGBA")
    a = img.getchannel("A")
    visible = a.point(lambda v: 255 if v > 0 else 0, mode="L")
    semi = a.point(lambda v: 255 if 0 < v < 255 else 0, mode="L")
    # El contorno es lo visible menos su erosion de 1 px: la orla exterior.
    contorno = visible.filter(ImageFilter.MinFilter(3))
    n_vis = n_semi = n_contorno = suma = 0
    for alfa, v, s, c in zip(a.get_flattened_data(), visible.get_flattened_data(),
                             semi.get_flattened_data(), contorno.get_flattened_data()):
        if v:
            n_vis += 1
            suma += alfa
            if not c:
                n_contorno += 1
        if s:
            n_semi += 1
    return {
        "alfa": suma / n_vis if n_vis else 0.0,
        "blando": mjlib.soft_interior_fraction(img),
        "fleco": n_semi / n_contorno if n_contorno else 0.0,
    }


def version_en_git(ref: str, rel: str) -> "Image.Image | None":
    """La pieza tal y como esta en `ref`, o None si alli no existia."""
    r = subprocess.run(["git", "show", f"{ref}:{rel}"], cwd=REPO,
                       capture_output=True)
    if r.returncode != 0 or not r.stdout:
        return None
    return Image.open(io.BytesIO(r.stdout))


def veredicto(antes: dict, ahora: dict) -> str:
    """Pista de una palabra. Mejor = mas opaca y con menos fleco.

    Se exige que ninguna de las tres medidas empeore por encima del ruido: una
    pieza que gana opacidad pero estrena fleco no es una mejora, es un cambio
    que hay que mirar.
    """
    d_alfa = ahora["alfa"] - antes["alfa"]
    d_blando = antes["blando"] - ahora["blando"]
    d_fleco = antes["fleco"] - ahora["fleco"]
    mueve = (abs(d_alfa) > RUIDO["alfa"] or abs(d_blando) > RUIDO["blando"]
             or abs(d_fleco) > RUIDO["fleco"])
    if not mueve:
        return "="
    gana = d_alfa > -RUIDO["alfa"] and d_blando > -RUIDO["blando"] and d_fleco > -RUIDO["fleco"]
    pierde = d_alfa < RUIDO["alfa"] and d_blando < RUIDO["blando"] and d_fleco < RUIDO["fleco"]
    if gana:
        return "mejor"
    if pierde:
        return "PEOR"
    return "mixta"


def movimiento(antes: dict, ahora: dict) -> float:
    """Cuanto se movio la pieza, para ordenar. Cada medida en unidades de su
    propio ruido, para que sumar un 3 % de alfa y un 2 % de blando tenga
    sentido."""
    return sum(abs(ahora[k] - antes[k]) / RUIDO[k] for k in RUIDO)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", default="HEAD", help="referencia de git contra la que comparar (por defecto HEAD)")
    ap.add_argument("--top", type=int, default=0, help="mostrar solo las N que mas se movieron")
    ap.add_argument("--todas", action="store_true", help="incluir tambien las que no cambiaron")
    a = ap.parse_args(argv)

    filas = []
    sin_referencia = []
    for d in DIRS:
        carpeta = REPO / d
        if not carpeta.is_dir():
            continue
        for f in sorted(carpeta.glob("*.png")):
            rel = str(f.relative_to(REPO))
            vieja = version_en_git(a.ref, rel)
            if vieja is None:
                sin_referencia.append(f.stem)
                continue
            antes, ahora = medidas(vieja), medidas(Image.open(f))
            filas.append((f.stem, antes, ahora))

    if not filas:
        print(f"no hay piezas que comparar contra {a.ref}")
        return 1

    filas.sort(key=lambda r: -movimiento(r[1], r[2]))
    if not a.todas:
        filas = [r for r in filas if veredicto(r[1], r[2]) != "="]
    if a.top:
        filas = filas[: a.top]

    print(f"arbol de trabajo vs {a.ref}\n")
    print(f"{'pieza':<24}{'alfa medio':>18}{'interior blando':>22}{'fleco (px)':>18}   veredicto")
    for nombre, antes, ahora in filas:
        print(f"{nombre:<24}"
              f"{antes['alfa']:>7.0f} -> {ahora['alfa']:<7.0f}"
              f"{antes['blando']:>10.2%} -> {ahora['blando']:<9.2%}"
              f"{antes['fleco']:>8.2f} -> {ahora['fleco']:<8.2f}"
              f"   {veredicto(antes, ahora)}")

    if not filas:
        print("  (ninguna se movio)")
    if sin_referencia:
        print(f"\nsin version en {a.ref} (piezas nuevas): {', '.join(sin_referencia)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
