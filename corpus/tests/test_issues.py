import json
import re
from pathlib import Path

FILES = sorted((Path(__file__).parent.parent / "issues").glob("*.json"))
DOCS = [json.loads(f.read_text()) for f in FILES]


def test_eight_files():
    assert [f.name for f in FILES] == [f"0{i}.json" for i in range(1, 9)]


def test_requirements_have_r_ids():
    for d in DOCS:
        assert d["requirements"]
        for r in d["requirements"]:
            assert re.fullmatch(r"R\d+", r["id"]) and r["text"]


def test_declared_scope_safe():
    for d in DOCS:
        assert d["declared_scope"]
        assert all(".." not in p for p in d["declared_scope"])


def test_ids_unique():
    ids = [d["id"] for d in DOCS]
    assert len(set(ids)) == len(ids)
