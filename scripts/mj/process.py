# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["rembg[gpu]>=2.0.60", "pillow>=10"]
# ///
"""Pipeline de arte de Doty. Ver docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md §5.

  uv run scripts/mj/process.py --emit-prompts fase-1 --raw $RAW
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


def cmd_dry_run(fase: str, raw: Path) -> int:
    cat = mjlib.load_catalog(batch_path(fase))
    files = [f.name for f in (raw / fase).iterdir() if f.is_file()] if (raw / fase).exists() else []
    print(mjlib.render_dry_run(cat, mjlib.match_downloads(cat, files)))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--emit-prompts", metavar="FASE")
    g.add_argument("--emit-registry", metavar="FASE")
    g.add_argument("--dry-run", metavar="FASE")
    g.add_argument("--apply", metavar="FASE")
    ap.add_argument("--raw", type=Path, help="carpeta raíz de descargas (dots/imagenes/mj)")
    ap.add_argument("--pick", action="append", default=[], metavar="SLUG=ARCHIVO")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    if a.emit_prompts:
        if not a.raw:
            ap.error("--emit-prompts requiere --raw")
        cmd_emit_prompts(a.emit_prompts, a.raw)
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
    ap.error("subcomando aún no implementado")


if __name__ == "__main__":
    raise SystemExit(main())
