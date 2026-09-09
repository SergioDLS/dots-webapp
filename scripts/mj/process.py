# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["rembg[gpu]>=2.0.60", "pillow>=10"]
# ///
"""Pipeline de arte de Doty. Ver docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md §5.

  uv run scripts/mj/process.py --emit-prompts fase-1 --raw $RAW
  uv run scripts/mj/process.py --emit-lote GRUPO [GRUPO ...] --raw $RAW [--fase fase-1]
  uv run scripts/mj/process.py --emit-registry fase-1
  uv run scripts/mj/process.py --dry-run fase-1 --raw $RAW
  uv run scripts/mj/process.py --apply fase-1 --raw $RAW [--pick slug=archivo.png ...] [--force]

Si onnxruntime-gpu no instala en tu equipo, cambia "rembg[gpu]" por "rembg[cpu]" arriba: el
resultado es idéntico, solo más lento.
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
import mjlib  # noqa: E402


def batch_path(fase: str) -> Path:
    return HERE / "batches" / f"{fase}.json"


def cmd_emit_prompts(fase: str, raw: Path) -> None:
    cat = mjlib.load_catalog(batch_path(fase))
    style = mjlib.load_style(HERE / "style.json")
    out_dir = raw / fase
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "PROMPTS.md"
    out.write_text(mjlib.emit_prompts(cat, style), encoding="utf-8")
    print(f"{len(cat['pieces'])} prompts → {out}")


def cmd_emit_lote(fase: str, raw: Path, grupos: list[str]) -> None:
    cat = mjlib.load_catalog(batch_path(fase))
    style = mjlib.load_style(HERE / "style.json")
    out_dir = raw / fase
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"LOTE-{'+'.join(grupos)}.md"
    out.write_text(mjlib.emit_lote(cat, style, grupos), encoding="utf-8")
    pieces = [p for g in grupos for p in cat["pieces"] if p["group"] == g]
    n_mascota = sum(1 for p in pieces if p.get("mascot"))
    n_icono = len(pieces) - n_mascota
    print(f"{len(pieces)} piezas ({n_mascota} mascota, {n_icono} icono) → {out}")


def cmd_dry_run(fase: str, raw: Path) -> int:
    cat = mjlib.load_catalog(batch_path(fase))
    files = [f.name for f in (raw / fase).iterdir() if f.is_file()] if (raw / fase).exists() else []
    print(mjlib.render_dry_run(cat, mjlib.match_downloads(cat, files)))
    return 0


def parse_picks(picks: list[str]) -> dict[str, str]:
    """--pick SLUG=ARCHIVO, uno por uno. Sale con mensaje claro si a alguno le falta el '='."""
    pick_map: dict[str, str] = {}
    for raw_pick in picks:
        if "=" not in raw_pick:
            sys.exit(f"--pick inválido (falta '='): {raw_pick!r}. Formato esperado SLUG=ARCHIVO")
        slug, file = raw_pick.split("=", 1)
        pick_map[slug] = file
    return pick_map


def cmd_apply(fase: str, raw: Path, picks: list[str], force: bool) -> int:
    from rembg import new_session, remove  # perezoso: pesa y solo hace falta aquí
    session = new_session("isnet-general-use")

    def remover(im):
        return remove(im, session=session, alpha_matting=True,
                      alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10,
                      alpha_matting_erode_size=10)

    cpath = batch_path(fase)
    cat = mjlib.load_catalog(cpath)
    pick_map = parse_picks(picks)
    known_slugs = {p["slug"] for p in cat["pieces"]}
    for slug in pick_map:
        if slug not in known_slugs:
            print(f"advertencia: --pick {slug}=... no corresponde a ningún slug del catálogo", file=sys.stderr)
    rep = mjlib.apply_batch(cat, cpath, raw, REPO, remover, picks=pick_map, force=force)
    report = raw / fase / "REPORT.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(mjlib.render_report(rep), encoding="utf-8")
    print(mjlib.render_report(rep))
    print(f"→ {report}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--emit-prompts", metavar="FASE")
    g.add_argument("--emit-registry", metavar="FASE")
    g.add_argument("--dry-run", metavar="FASE")
    g.add_argument("--apply", metavar="FASE")
    # A diferencia de las anteriores, esta no puede cargar la fase en su propio valor:
    # nargs="+" ya consume esa posición para la lista de grupos, y mezclar un escalar
    # con una lista variable en el mismo flag es ambiguo. Por eso --fase vive aparte,
    # con el default que cubre el caso común y sin pertenecer al grupo mutuamente
    # exclusivo (es un modificador, no un modo — debe poder acompañar a --emit-lote).
    g.add_argument("--emit-lote", nargs="+", metavar="GRUPO")
    ap.add_argument("--fase", default="fase-1", metavar="FASE",
                     help="fase objetivo; solo la usa --emit-lote (las demás la reciben como su propio valor)")
    ap.add_argument("--raw", type=Path, help="carpeta raíz de descargas (dots/imagenes/mj)")
    ap.add_argument("--pick", action="append", default=[], metavar="SLUG=ARCHIVO")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    if a.emit_prompts:
        if not a.raw:
            ap.error("--emit-prompts requiere --raw")
        cmd_emit_prompts(a.emit_prompts, a.raw)
        return 0
    if a.emit_lote:
        if not a.raw:
            ap.error("--emit-lote requiere --raw")
        cmd_emit_lote(a.fase, a.raw, a.emit_lote)
        return 0
    if a.emit_registry:
        cat = mjlib.load_catalog(batch_path(a.emit_registry))
        out = REPO / "components/ui/doty/poses.ts"
        out.write_text(mjlib.emit_registry(cat), encoding="utf-8")
        print(f"registro → {out}")
        return 0
    if a.dry_run:
        if not a.raw:
            ap.error("--dry-run requiere --raw")
        return cmd_dry_run(a.dry_run, a.raw)
    if a.apply:
        if not a.raw:
            ap.error("--apply requiere --raw")
        return cmd_apply(a.apply, a.raw, a.pick, a.force)


if __name__ == "__main__":
    raise SystemExit(main())
