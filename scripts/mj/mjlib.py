"""Funciones puras del pipeline de arte de Doty. Sin rembg aquí: lo importa process.py."""
from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Callable
from PIL import Image, ImageChops, ImageFilter

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


def trim_square_resize(img: "Image.Image", size: int, margin: float = 0.04) -> "Image.Image":
    img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox is None:
        raise ValueError("empty image (fully transparent)")
    content = img.crop(bbox)
    w, h = content.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(content, ((side - w) // 2, (side - h) // 2))
    inner = max(1, round(size * (1 - 2 * margin)))
    scaled = canvas.resize((inner, inner), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(scaled, ((size - inner) // 2, (size - inner) // 2))
    return out


def halo_thickness_px(img: "Image.Image") -> float:
    """Grosor medio, en píxeles, de la banda semitransparente ROSADA (r>180, g<120)
    alrededor del sujeto: cuenta de esos píxeles dividida por el largo del contorno.

    El antialiasing de un sprite limpio deja una banda de ~1.4 px en cualquier
    silueta y a cualquier resolución; un halo de rembg la engrosa proporcionalmente.
    Se mide grosor y no una fracción del sprite porque la fracción depende de la
    silueta y del tamaño: la de Doty (pelo en picos, extremidades finas) tiene mucho
    más perímetro por área que un círculo, y a 512 px un sprite limpio ya daba más
    del 2 % — los rangos limpio/con-halo se solapaban entre formas.

    Nota: la medida asume que la fuente es al menos tan grande como el destino.
    Una fuente muy upscalada (ej: 512 px a 1024 px) desenfoca la arista alfa en
    una banda genuinamente gruesa que se lee como halo sin tener uno. Los
    descargas de Midjourney son ~1024 px nativas, así que esto no se espera
    en condiciones normales.
    """
    img = img.convert("RGBA")
    a = img.getchannel("A")
    visible = a.point(lambda v: 255 if v > 0 else 0, mode="L")
    semi = a.point(lambda v: 255 if 0 < v < 255 else 0, mode="L")
    rosa = ImageChops.multiply(
        img.getchannel("R").point(lambda v: 255 if v > 180 else 0, mode="L"),
        img.getchannel("G").point(lambda v: 255 if v < 120 else 0, mode="L"),
    )
    semi_rosa = ImageChops.multiply(semi, rosa)
    contorno = ImageChops.subtract(visible, visible.filter(ImageFilter.MinFilter(3)))
    n_contorno = sum(1 for v in contorno.get_flattened_data() if v)
    n_semi = sum(1 for v in semi_rosa.get_flattened_data() if v)
    return n_semi / n_contorno if n_contorno else 0.0


# Grosor de banda semitransparente por encima del cual la pieza es candidata a
# regenerar. Un sprite limpio mide ~1.4 px en cualquier silueta y resolución.
HALO_THRESHOLD = 2.0


def save_catalog(cat: dict, path: Path) -> None:
    Path(path).write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def apply_batch(cat: dict, catalog_path: Path, raw_root: Path, repo_root: Path,
                remover: Callable[["Image.Image"], "Image.Image"],
                picks: dict[str, str] | None = None, force: bool = False) -> dict:
    picks = picks or {}
    fase = cat["fase"]
    raw_dir = Path(raw_root) / fase
    files = [f.name for f in raw_dir.iterdir() if f.is_file()] if raw_dir.exists() else []
    matches = match_downloads(cat, files)
    rep = {"fase": fase, "done": [], "skipped": [], "missing": [], "ambiguous": [], "halo": [], "duplicates": [], "failed": []}

    # Validar picks: todos los archivos deben existir
    missing_picks = [f"{s}={f}" for s, f in picks.items() if not (raw_dir / f).is_file()]
    if missing_picks:
        raise CatalogError(f"--pick apunta a archivos que no existen: {', '.join(sorted(missing_picks))}")

    consumed: dict[str, str] = {}
    for p in cat["pieces"]:
        slug = p["slug"]
        target = output_path(p, fase, repo_root, raw_root)
        if p.get("done") and not force:
            rep["skipped"].append(slug)
            continue
        chosen = picks.get(slug)
        cands = matches.get(slug, [])
        if not chosen:
            if len(cands) == 1:
                chosen = cands[0]
            elif cands:
                rep["ambiguous"].append(slug)
                continue
            else:
                rep["missing"].append(slug)
                continue
        if chosen in consumed:
            rep["duplicates"].append((slug, chosen, consumed[chosen]))
        try:
            src = Image.open(raw_dir / chosen).convert("RGBA")
            cut = remover(src)
            out = trim_square_resize(cut, p["size"])
            target.parent.mkdir(parents=True, exist_ok=True)
            out.save(target, optimize=True)
        except Exception as exc:
            rep["failed"].append((slug, f"{type(exc).__name__}: {exc}"))
            continue
        consumed[chosen] = slug
        grosor = halo_thickness_px(out)
        if grosor > HALO_THRESHOLD:
            rep["halo"].append((slug, grosor))
        p["done"] = True
        p["source_file"] = chosen
        rep["done"].append(slug)
        save_catalog(cat, catalog_path)
    return rep


def render_report(rep: dict) -> str:
    def section(title, items):
        return [f"## {title} ({len(items)})", *[f"- {i}" for i in items], ""]
    lines = [f"# {rep['fase']} — REPORT", ""]
    lines += section("Hechas", rep["done"])
    lines += section("Ya existían (saltadas)", rep["skipped"])
    lines += section("Ambiguas: usa --pick slug=archivo", rep["ambiguous"])
    lines += section("Faltan", rep["missing"])
    lines += section("Falló el procesado", [f"{s}: {e}" for s, e in rep["failed"]])
    lines += section("Mismo archivo usado por dos piezas", [f"{s} y {otro} -> {f}" for s, f, otro in rep["duplicates"]])
    lines += section("Alerta de halo: banda gruesa, regenerar o retocar", [f"{s} ({r:.2f} px)" for s, r in rep["halo"]])
    return "\n".join(lines)
