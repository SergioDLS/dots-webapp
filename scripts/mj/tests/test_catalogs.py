import sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCH = Path(__file__).resolve().parents[1] / "batches" / "fase-1.json"
EXPECTED = {"expressions": 15, "poses": 16, "states": 6, "celebrations": 6, "accessories": 16,
            "themed": 6, "icons": 6, "stickers": 10, "games": 12, "characters": 3, "app-icon": 1}
GAMES = {"wordle", "crossword", "dot-match", "true-false", "memory", "audio-blitz", "word-tower",
         "sentence-builder", "ghost-race", "dotaxi", "dont-pop", "dot-bombs"}

def test_fase1_counts_and_rules():
    cat = mjlib.load_catalog(BATCH)
    counts = Counter(p["group"] for p in cat["pieces"])
    assert dict(counts) == EXPECTED and len(cat["pieces"]) == 97
    for p in cat["pieces"]:
        expect_oref = p["group"] not in ("icons", "games")
        assert p["oref"] is expect_oref, p["slug"]
        assert p["size"] == (512 if p["group"] in ("icons", "games") else 1024), p["slug"]
        assert "," not in p["prefix"], p["slug"]
        assert "glasses" not in p["prompt"].lower() or p["slug"] in ("lentes", "doty-scientist"), p["slug"]
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "games"} == GAMES
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "characters"} == {"doty-fem", "doty-sailor", "doty-scientist"}
    assert any(p["slug"] == "hablando" and p["group"] == "poses" for p in cat["pieces"])
    assert len({p["prefix"] for p in cat["pieces"]}) == 97

def test_solo_lentes_y_scientist_llevan_glasses():
    cat = mjlib.load_catalog(BATCH)
    con_glasses = {p["slug"] for p in cat["pieces"] if p.get("glasses")}
    assert con_glasses == {"lentes", "doty-scientist"}
