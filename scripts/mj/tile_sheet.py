# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Hoja de revisión de tiles del Camino a su tamaño real sobre los dos temas.

  uv run scripts/mj/tile_sheet.py FILA [FILA ...] --out /ruta/hoja.png

Cada FILA es una lista de slugs separados por ':' que se pintan juntos —
un grupo que tiene que distinguirse entre sí (spec 2026-09-29, §Legibilidad)
o una pieza nueva al lado del tile existente que más se le parece. La hoja
sale dos veces, sobre el fondo claro y el oscuro de la paleta rosa.
"""
import argparse
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
LEVELS = REPO / "public" / "images" / "levels"
ART = 128  # `ART` de components/path/path-node.tsx: el tamaño real del arte del nodo
PAD = 16
FONDOS = ["#fff7fb", "#14122e"]  # --background rosa claro y oscuro (lib/theme-colors.ts)


def tile(slug: str) -> Image.Image:
    return Image.open(LEVELS / f"{slug}.png").convert("RGBA").resize((ART, ART), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("filas", nargs="+")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    filas = [f.split(":") for f in a.filas]
    celda = ART + PAD
    ancho = max(len(f) for f in filas) * celda
    alto = len(filas) * celda
    hoja = Image.new("RGBA", (ancho * len(FONDOS), alto))
    for i, fondo in enumerate(FONDOS):
        x0 = i * ancho
        hoja.paste(Image.new("RGBA", (ancho, alto), fondo), (x0, 0))
        for fi, fila in enumerate(filas):
            for ci, slug in enumerate(fila):
                hoja.alpha_composite(tile(slug), (x0 + ci * celda + PAD // 2, fi * celda + PAD // 2))
    hoja.save(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
