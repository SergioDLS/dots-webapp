import json
from pathlib import Path
import pytest
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

def piece(**over):
    base = {"slug": "feliz", "group": "expressions", "prefix": "Doty beaming with joy",
            "prompt": "big smile", "size": 1024, "oref": True, "fallback": "02", "done": False}
    base.update(over)
    return base

def write(tmp_path, name, data):
    p = tmp_path / name
    p.write_text(json.dumps(data), encoding="utf-8")
    return p

def test_load_catalog_ok(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "fase-1", "pieces": [piece()]})
    cat = mjlib.load_catalog(p)
    assert cat["pieces"][0]["slug"] == "feliz"

def test_duplicate_slug_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(), piece(prefix="Other words")]})
    with pytest.raises(mjlib.CatalogError, match="slug"):
        mjlib.load_catalog(p)

def test_duplicate_prefix_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(), piece(slug="otro")]})
    with pytest.raises(mjlib.CatalogError, match="prefix"):
        mjlib.load_catalog(p)

def test_bad_group_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(group="nope")]})
    with pytest.raises(mjlib.CatalogError, match="group"):
        mjlib.load_catalog(p)

def test_registry_piece_needs_fallback_until_done(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(fallback=None)]})
    with pytest.raises(mjlib.CatalogError, match="fallback"):
        mjlib.load_catalog(p)
    p2 = write(tmp_path, "d.json", {"fase": "x", "pieces": [piece(fallback=None, done=True)]})
    mjlib.load_catalog(p2)  # no raise

def test_extra_group_needs_no_fallback(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(group="games", slug="wordle", oref=False, fallback=None)]})
    mjlib.load_catalog(p)

def test_registry_key_prefixes_stickers():
    assert mjlib.registry_key(piece(group="stickers", slug="good-job")) == "sticker-good-job"
    assert mjlib.registry_key(piece()) == "feliz"

def test_output_path_per_group(tmp_path):
    repo, raw = tmp_path / "repo", tmp_path / "raw"
    assert mjlib.output_path(piece(), "fase-1", repo, raw) == repo / "public/images/Doty/expressions/feliz.png"
    assert mjlib.output_path(piece(group="games", slug="wordle"), "fase-1", repo, raw) == repo / "public/images/games/wordle.png"
    assert mjlib.output_path(piece(group="characters", slug="doty-fem"), "fase-1", repo, raw) == raw / "fase-1/out/characters/doty-fem.png"
    assert mjlib.output_path(piece(group="app-icon", slug="app-icon"), "fase-1", repo, raw) == raw / "fase-1/out/app-icon.png"
