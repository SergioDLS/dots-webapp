"""Funciones puras del pipeline de arte de Doty. Sin rembg aquí: lo importa process.py."""
from __future__ import annotations
import json
import re
from pathlib import Path

REGISTRY_GROUPS = ("expressions", "poses", "states", "celebrations", "accessories", "themed", "stickers", "icons")
EXTRA_GROUPS = ("games", "characters", "app-icon")
LEGACY_RE = re.compile(r"^(0[1-9]|1[0-9]|2[0-2])$")


class CatalogError(ValueError):
    pass


def load_style(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_catalog(path: Path) -> dict:
    cat = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_catalog(cat)
    return cat


def validate_catalog(cat: dict) -> None:
    if not isinstance(cat.get("fase"), str) or not isinstance(cat.get("pieces"), list):
        raise CatalogError("catalog needs 'fase' (str) and 'pieces' (list)")
    slugs, prefixes = set(), {}
    for p in cat["pieces"]:
        slug = p.get("slug")
        if not slug or slug in slugs:
            raise CatalogError(f"duplicate or missing slug: {slug!r}")
        slugs.add(slug)
        prefix = p.get("prefix")
        if not prefix:
            raise CatalogError(f"missing prefix for {slug!r}")
        norm = normalize(prefix)
        for other_norm, other_slug in prefixes.items():
            if norm in other_norm or other_norm in norm:
                raise CatalogError(
                    f"{slug!r}: prefix {prefix!r} collides with {other_slug!r} "
                    f"({norm!r} vs {other_norm!r}) — downloads would match both"
                )
        prefixes[norm] = slug
        group = p.get("group")
        if group not in REGISTRY_GROUPS + EXTRA_GROUPS:
            raise CatalogError(f"{slug}: invalid group {group!r}")
        if not isinstance(p.get("size"), int) or p["size"] <= 0:
            raise CatalogError(f"{slug}: size must be a positive int")
        if not isinstance(p.get("done"), bool):
            raise CatalogError(f"{slug}: done must be bool")
        fb = p.get("fallback")
        if group in REGISTRY_GROUPS and not p["done"]:
            if not (isinstance(fb, str) and LEGACY_RE.match(fb)):
                raise CatalogError(f"{slug}: fallback ('01'..'22') required while done=false")


def registry_key(piece: dict) -> str:
    return f"sticker-{piece['slug']}" if piece["group"] == "stickers" else piece["slug"]


def output_path(piece: dict, fase: str, repo_root: Path, raw_root: Path) -> Path:
    g, s = piece["group"], piece["slug"]
    if g in REGISTRY_GROUPS:
        return Path(repo_root) / "public/images/Doty" / g / f"{s}.png"
    if g == "games":
        return Path(repo_root) / "public/images/games" / f"{s}.png"
    if g == "characters":
        return Path(raw_root) / fase / "out/characters" / f"{s}.png"
    return Path(raw_root) / fase / "out/app-icon.png"


def build_prompt(piece: dict, style: dict) -> str:
    use_oref = bool(piece.get("oref"))
    mascot = use_oref or bool(piece.get("sref_only"))
    body = [piece["prefix"]]
    if mascot:
        body += [style["character"], piece["prompt"], style["style_block"]]
    else:
        body += [piece["prompt"], style["icon_block"]]
    flags = [f"--ar {style['aspect']}", f"--stylize {style['stylize']}"]
    model = piece.get("model")
    if model:
        flags.append(f"--v {model}")
    if use_oref:
        flags.append(f"--oref {style['oref_file']} --ow {piece.get('ow', style['ow'])}")
    if style.get("sref"):
        flags.append(f"--sref {style['sref']} --sw {style['sw']}")
    flags.append("--no " + ", ".join(style["negative"]))
    return ", ".join(body) + " " + " ".join(flags)


def emit_prompts(cat: dict, style: dict) -> str:
    lines = [f"# {cat['fase']} — prompts", "",
             "Pega cada prompt tal cual. En la web, arrastra `ref-hero.png` al slot de Omni Reference "
             "cuando el prompt lleve `--oref`, y la hoja/código al de Style Reference cuando lleve `--sref`.",
             "Descarga la imagen elegida a la carpeta de este lote sin renombrarla.", ""]
    for i, p in enumerate(cat["pieces"], 1):
        target = f"{p['group']}/{p['slug']}.png"
        status = " ✅" if p.get("done") else ""
        lines += [f"{i}. `{p['slug']}` → `{target}`{status}", "", "```", build_prompt(p, style), "```", ""]
    return "\n".join(lines)


def registry_src(piece: dict) -> str:
    if piece.get("done"):
        return f"/images/Doty/{piece['group']}/{piece['slug']}.png"
    return f"/images/Doty/DOTTY-POSES-{piece['fallback']}.png"


def _ts_key(key: str) -> str:
    return key if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) else f'"{key}"'


def emit_registry(cat: dict) -> str:
    pieces = [p for p in cat["pieces"] if p["group"] in REGISTRY_GROUPS]
    if not any(registry_key(p) == "feliz" for p in pieces):
        raise CatalogError("registry needs a 'feliz' piece (FALLBACK_POSE)")
    groups = " | ".join(f'"{g}"' for g in REGISTRY_GROUPS)
    rows = "\n".join(
        f'  {_ts_key(registry_key(p))}: {{ src: "{registry_src(p)}", group: "{p["group"]}" }},' for p in pieces
    )
    return f'''// GENERADO por scripts/mj/process.py --emit-registry — no editar a mano.
// Fuente: scripts/mj/batches/{cat["fase"]}.json. Reglas de uso: docs/brand/doty-identity.md
export type DotyGroup = {groups};
export type PoseEntry = {{ src: string; group: DotyGroup }};

export const POSES = {{
{rows}
}} as const satisfies Record<string, PoseEntry>;

export type DotyPose = keyof typeof POSES;
export const FALLBACK_POSE: DotyPose = "feliz";

export function isDotyPose(v: unknown): v is DotyPose {{
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(POSES, v);
}}

/** Strings dinámicos (BD, params) → pose válida o la cara amable por defecto. */
export function toDotyPose(v: string | null | undefined): DotyPose {{
  return isDotyPose(v) ? v : FALLBACK_POSE;
}}
'''


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def match_downloads(cat: dict, filenames: list[str]) -> dict[str, list[str]]:
    pngs = sorted(f for f in filenames if f.lower().endswith(".png"))
    out: dict[str, list[str]] = {}
    for p in cat["pieces"]:
        key = normalize(p["prefix"])
        out[p["slug"]] = [f for f in pngs if key in normalize(f)]
    return out


def render_dry_run(cat: dict, matches: dict[str, list[str]]) -> str:
    lines = []
    for p in cat["pieces"]:
        files = matches.get(p["slug"], [])
        if p.get("done"):
            lines.append(f"HECHO    {p['slug']}")
        elif len(files) == 1:
            lines.append(f"OK       {p['slug']} ← {files[0]}")
        elif files:
            lines.append(f"AMBIGUO  {p['slug']} ← {' | '.join(files)}")
        else:
            lines.append(f"FALTA    {p['slug']}")
    return "\n".join(lines)
