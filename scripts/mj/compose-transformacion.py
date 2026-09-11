# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["pillow>=10"]
# ///
"""Convierte el video de la transformación de Doty en un WebP animado con alfa.

  uv run scripts/mj/compose-transformacion.py --src $RAW/<video>.mp4 --report
  uv run scripts/mj/compose-transformacion.py --src $RAW/<video>.mp4 --apply

Necesita `ffmpeg` en el PATH para extraer los fotogramas.

**Por qué no se usa rembg aquí.** El video llega con el fondo cambiando de
blanco a negro a mitad del clip — los modelos de video ignoran "fondo plano
inmutable" porque están hechos para movimiento cinematográfico. Recortar contra
el color del fondo obliga a acertar ese color en cada fotograma, y en la franja
de transición falla: medido, daba saltos de área del 67 % entre fotogramas
contiguos, que se ven como parpadeo.

En su lugar se recorta por **saturación**: Doty es rosa saturado y el blanco, el
gris y el negro son todos desaturados, así que la máscara es inmune a lo que
haga el fondo. Dos correcciones que hacen falta para que funcione:

- **Puerta de brillo.** La saturación es inestable con poca luz: en RGB(3,1,1)
  vale 0,67, así que el ruido de compresión del fondo negro entraba como figura.
  Se exige `max(r,g,b) >= 45` — el navy del contorno tiene 92 y el ruido del
  fondo no pasa de 20.
- **Relleno de agujeros internos.** Los ojos y los dientes son blancos, o sea
  desaturados, y la máscara los deja fuera. Los devuelve `fill_internal_holes`,
  el mismo que repara los sprites (ver mjlib).

De regalo, la sombra elíptica que el Doty clásico trae pintada desaparece sola:
es gris.

Después cada fotograma se reescala y se recentra a un anclaje común, porque el
modelo también ignoró la cámara fija — la figura llegó a variar 2,21× de tamaño
y a desplazarse 188 px de 624.
"""
from __future__ import annotations
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import mjlib  # noqa: E402

REPO = HERE.parent.parent
DESTINO = REPO / "public/images/doty-transformacion.webp"
# El estático del login sale del MISMO primer fotograma (--quieto), así que al
# arrancar la animación no hay salto: es el mismo píxel.

# Medidos sobre el clip real; ver el docstring.
SAT_MIN, SAT_MAX = 0.20, 0.36
BRILLO_MIN = 45
LADO_TRABAJO = 312          # se procesa aquí y se emite a LADO_SALIDA
LADO_SALIDA = 256
ALTO_FIGURA = 212           # ~83 % del lienzo: deja aire para el penacho y los pies
PASO = 2                    # 1 de cada 2 fotogramas → 12 fps desde un origen de 24


def extrae(video: Path, destino: Path) -> list[Path]:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(video), "-fps_mode", "passthrough",
         str(destino / "f%04d.png")],
        check=True,
    )
    return sorted(destino.glob("f*.png"))


def recorta(img: "Image.Image") -> "Image.Image":
    """Alfa por saturación con puerta de brillo. Devuelve RGBA sin recortar."""
    px = img.load()
    w, h = img.size
    a = Image.new("L", (w, h), 0)
    ap = a.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx = max(r, g, b)
            if mx < BRILLO_MIN:
                continue
            sat = (mx - min(r, g, b)) / mx
            if sat <= SAT_MIN:
                continue
            ap[x, y] = 255 if sat >= SAT_MAX else int(255 * (sat - SAT_MIN) / (SAT_MAX - SAT_MIN))
    # El mediano quita las motas que deja el ruido de compresión sin comerse el borde.
    a = a.filter(ImageFilter.MedianFilter(5))
    out = img.convert("RGBA")
    out.putalpha(a)
    return mjlib.fill_internal_holes(out, img)


def normaliza(rgba: "Image.Image") -> "Image.Image | None":
    """Reescala y recentra a un anclaje común: el modelo no respetó la cámara fija."""
    bb = rgba.getchannel("A").getbbox()
    if bb is None:
        return None
    fig = rgba.crop(bb)
    ancho = max(1, round(fig.width * ALTO_FIGURA / fig.height))
    fig = fig.resize((ancho, ALTO_FIGURA), Image.LANCZOS)
    z = Image.new("RGBA", (LADO_SALIDA, LADO_SALIDA), (0, 0, 0, 0))
    z.alpha_composite(fig, ((LADO_SALIDA - ancho) // 2, (LADO_SALIDA - ALTO_FIGURA) // 2))
    return z


def encuadre_comun(recortados: list["Image.Image"]) -> tuple[int, int, int, int]:
    """Caja que contiene a la figura en TODOS los fotogramas, cuadrada y centrada.

    Sirve para recortar todos igual y conservar el tamaño relativo entre ellos.
    """
    cajas = [r.getchannel("A").getbbox() for r in recortados]
    cajas = [c for c in cajas if c]
    x0 = min(c[0] for c in cajas)
    y0 = min(c[1] for c in cajas)
    x1 = max(c[2] for c in cajas)
    y1 = max(c[3] for c in cajas)
    lado = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    return (cx - lado // 2, cy - lado // 2, cx + lado // 2, cy + lado // 2)


def procesa(rutas: list[Path], normalizar: bool) -> list["Image.Image"]:
    """`normalizar` reescala cada fotograma a una altura fija.

    Hace falta cuando el modelo ignoró la cámara y la figura deriva de tamaño —
    el caso de la transformación, que llegó a variar 2,21×. Pero es RUINOSO
    cuando el cambio de tamaño es la animación: el saludo termina con Doty
    encogiéndose hasta desaparecer, y normalizar cada fotograma a la misma altura
    borra justamente ese final. Ahí se usa un encuadre común para todos, que
    conserva el tamaño relativo.
    """
    recortados = []
    for ruta in rutas:
        img = Image.open(ruta).convert("RGB").resize((LADO_TRABAJO, LADO_TRABAJO), Image.LANCZOS)
        recortados.append(recorta(img))

    if normalizar:
        return [s for s in (normaliza(r) for r in recortados) if s is not None]

    caja = encuadre_comun(recortados)
    salida = []
    for r in recortados:
        fig = r.crop(caja).resize((LADO_SALIDA, LADO_SALIDA), Image.LANCZOS)
        salida.append(fig)
    return salida


def reporte(sprites: list["Image.Image"]) -> None:
    """Estabilidad temporal: cuánto cambia el área opaca entre fotogramas contiguos.

    Un salto grande entre contiguos es parpadeo, y el parpadeo se ve mucho más
    que un defecto en un fotograma quieto. En el clip del saludo los cuatro
    peores saltos estaban todos en los últimos ocho fotogramas: mirar dónde caen
    dice si sobra recortar la cola o si el problema es del recorte.
    """
    areas = [sum(1 for v in s.getchannel("A").get_flattened_data() if v > 200) for s in sprites]
    saltos = [(abs(areas[i + 1] - areas[i]) / areas[i] * 100, i + 1) for i in range(len(areas) - 1)]
    orden = sorted(saltos, reverse=True)
    mediana = sorted(v for v, _ in saltos)[len(saltos) // 2]
    print(f"  fotogramas          {len(sprites)}")
    print(f"  cambio de área      mediana {mediana:.1f}%   peor {orden[0][0]:.0f}%")
    print("  peores saltos       " + ", ".join(f"{v:.0f}% en f{i}" for v, i in orden[:4]))


def rel(p: Path) -> str:
    """Ruta legible tanto si llegó absoluta como relativa al repo."""
    try:
        return str(p.resolve().relative_to(REPO))
    except ValueError:
        return str(p)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, required=True, help="el .mp4 descargado de Midjourney")
    ap.add_argument("--out", type=Path, default=DESTINO)
    ap.add_argument("--report", action="store_true", help="solo medir, sin escribir")
    ap.add_argument("--recorta-cola", type=int, default=0, metavar="N",
                    help="descarta los N últimos fotogramas (el modelo se descompone al final)")
    ap.add_argument("--quieto", type=Path, default=None, metavar="RUTA",
                    help="además, guarda el primer fotograma suelto en esa ruta")
    ap.add_argument("--recorta-medio", metavar="A:B",
                    help="quita los fotogramas A..B de la SALIDA (1-indexado, inclusive) "
                         "y empalma. Para acortar sin perder el principio ni el final: "
                         "el saludo trae cuatro ciclos y con uno basta.")
    ap.add_argument("--normalizar", action="store_true",
                    help="reescala cada fotograma a altura fija; solo si el modelo "
                         "ignoró la cámara. NO usar si el tamaño cambia a propósito.")
    a = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        rutas = extrae(a.src, Path(tmp))
        if a.recorta_cola:
            rutas = rutas[: -a.recorta_cola]
        sprites = procesa(rutas[::PASO], a.normalizar)

    if a.recorta_medio:
        ini, fin = (int(v) for v in a.recorta_medio.split(":"))
        # El empalme se nota poco si los dos extremos se parecen; el script no
        # lo elige por ti porque depende de qué parte del gesto quieras
        # conservar. Mide la diferencia y decide con ella delante.
        sprites = sprites[: ini - 1] + sprites[fin:]
        print(f"  recortado el medio    f{ini}–f{fin}")

    if not sprites:
        print("no quedó ningún fotograma con figura", file=sys.stderr)
        return 1

    reporte(sprites)
    if a.report:
        print("\n(solo medición — usa --apply para escribir)")
        return 0

    a.out.parent.mkdir(parents=True, exist_ok=True)
    sprites[0].save(a.out, format="WEBP", save_all=True, append_images=sprites[1:],
                    duration=1000 // (24 // PASO), loop=1, quality=80)
    kb = a.out.stat().st_size / 1024
    print(f"\n  → {rel(a.out)}  {LADO_SALIDA}px  {kb:.0f} kB")

    if a.quieto:
        sprites[0].save(a.quieto, format="PNG", optimize=True)
        kb2 = a.quieto.stat().st_size / 1024
        print(f"  → {rel(a.quieto)}  {LADO_SALIDA}px  {kb2:.0f} kB"
              "  (primer fotograma; es lo que el login pinta antes de animar)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
