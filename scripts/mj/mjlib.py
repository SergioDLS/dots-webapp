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
    slugs, prefixes = set(), set()
    for p in cat["pieces"]:
        slug = p.get("slug")
        if not slug or slug in slugs:
            raise CatalogError(f"duplicate or missing slug: {slug!r}")
        slugs.add(slug)
        prefix = p.get("prefix")
        if not prefix or prefix in prefixes:
            raise CatalogError(f"duplicate or missing prefix for {slug!r}: {prefix!r}")
        prefixes.add(prefix)
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
