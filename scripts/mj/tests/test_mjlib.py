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


STYLE = {"model": "7", "oref_file": "ref-hero.png", "ow": 300, "sref": "", "sw": 200, "stylize": 50,
         "aspect": "1:1", "negative": ["text", "shadow"],
         "character": "Doty the mascot: round pink ball", "style_block": "flat vector, white background",
         "icon_block": "flat icon, brand palette"}

def test_build_prompt_with_oref():
    out = mjlib.build_prompt(piece(), STYLE)
    assert out.startswith("Doty beaming with joy, Doty the mascot: round pink ball, big smile, flat vector, white background")
    assert "--ar 1:1 --stylize 50 --oref ref-hero.png --ow 300" in out
    assert out.endswith("--no text, shadow")
    assert "--sref" not in out

def test_build_prompt_icon_without_oref():
    out = mjlib.build_prompt(piece(group="icons", slug="correcto", oref=False, prompt="green check mark"), STYLE)
    assert out.startswith("Doty beaming with joy, green check mark, flat icon, brand palette")
    assert "--oref" not in out and "Doty the mascot" not in out

def test_build_prompt_sref_and_overrides():
    style = dict(STYLE, sref="abc123")
    out = mjlib.build_prompt(piece(ow=100, model="7"), style)
    assert "--sref abc123 --sw 200" in out and "--ow 100" in out and "--v 7" in out

def test_build_prompt_sref_only_uses_character_block():
    out = mjlib.build_prompt(piece(oref=False, sref_only=True), dict(STYLE, sref="abc123"))
    assert "Doty the mascot" in out and "--oref" not in out and "--sref abc123" in out

def test_emit_prompts_is_numbered_markdown():
    cat = {"fase": "fase-1", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad", fallback="05")]}
    md = mjlib.emit_prompts(cat, STYLE)
    assert md.splitlines()[0] == "# fase-1 — prompts"
    assert "1. `feliz` → `expressions/feliz.png`" in md and "2. `triste`" in md
    assert md.count("```") == 4  # un bloque de código por prompt

def test_registry_src_uses_fallback_until_done():
    assert mjlib.registry_src(piece()) == "/images/Doty/DOTTY-POSES-02.png"
    assert mjlib.registry_src(piece(done=True)) == "/images/Doty/expressions/feliz.png"

def test_emit_registry_shape():
    cat = {"fase": "fase-1", "pieces": [
        piece(done=True),
        piece(group="stickers", slug="good-job", prefix="Doty thumbs up wink", fallback="02"),
        piece(group="games", slug="wordle", prefix="Green letter tiles", oref=False, fallback=None),
    ]}
    ts = mjlib.emit_registry(cat)
    assert ts.startswith("// GENERADO por scripts/mj/process.py --emit-registry")
    assert '  feliz: { src: "/images/Doty/expressions/feliz.png", group: "expressions" },' in ts
    assert '  "sticker-good-job": { src: "/images/Doty/DOTTY-POSES-02.png", group: "stickers" },' in ts
    assert "wordle" not in ts
    assert 'export const FALLBACK_POSE: DotyPose = "feliz";' in ts
    assert "export function toDotyPose(" in ts

def test_emit_registry_requires_feliz():
    with pytest.raises(mjlib.CatalogError, match="feliz"):
        mjlib.emit_registry({"fase": "x", "pieces": [piece(slug="triste", prefix="Doty sad", fallback="05")]})
