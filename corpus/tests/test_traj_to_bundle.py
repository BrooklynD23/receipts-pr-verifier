"""Tests for traj_to_bundle.

UNVERIFIED shape — replace with a real dump (HUMAN-05 step 4).
sample.traj.json is hand-written from RESEARCH-03, not a real mini-swe-agent file.
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import traj_to_bundle as t  # noqa: E402

DATA = Path(__file__).resolve().parent / "data"
SCRIPT = ROOT / "traj_to_bundle.py"


def load_traj():
    return json.loads((DATA / "sample.traj.json").read_text())


def test_command_pairing():
    cmds = t.commands_from_traj(load_traj())
    assert [c["exit"] for c in cmds] == [0, 1]
    assert cmds[0]["cmd"] == "python -m pytest tests/test_utils.py -q"
    assert "2 passed" in cmds[0]["stdout_tail"]


def test_stdout_tail_capped():
    traj = load_traj()
    traj["messages"][3]["content"] = "x" * 5000
    assert len(t.commands_from_traj(traj)[0]["stdout_tail"]) == 2000


def test_junit_counts():
    assert t.tests_from_junit(DATA / "sample.junit.xml") == {
        "collected": 5, "ran": 4, "skipped": 1, "passed": 3, "failed": 1,
    }


def test_junit_rejects_doctype(tmp_path):
    p = tmp_path / "x.xml"
    p.write_text('<!DOCTYPE a [<!ENTITY e "x">]><testsuite tests="0"/>')
    with pytest.raises(ValueError):
        t.tests_from_junit(p)


def test_junit_rejects_big(tmp_path):
    p = tmp_path / "x.xml"
    p.write_text("<testsuite tests='0'>" + " " * (5 * 1024 * 1024 + 1) + "</testsuite>")
    with pytest.raises(ValueError):
        t.tests_from_junit(p)


def test_files_touched():
    assert t.files_touched((DATA / "sample.patch").read_text()) == [
        "src/packaging/utils.py", "tests/test_utils.py",
    ]


def test_claims_absent_empty():
    b = t.build_bundle(DATA / "sample.traj.json", DATA / "sample.junit.xml",
                       DATA / "sample.patch", DATA / "sample.issue.json", None)
    assert b["assumptions"] == []
    assert all(r["diff_lines"] == {} for r in b["requirements"])
    assert b["agent"] == {"model": "sample-model", "provider": "unknown"}


def test_claims_present():
    b = t.build_bundle(DATA / "sample.traj.json", DATA / "sample.junit.xml",
                       DATA / "sample.patch", DATA / "sample.issue.json", DATA / "sample.claims.json")
    assert b["assumptions"] == ["sys import is harmless"]
    assert b["requirements"][0]["diff_lines"] == {"src/packaging/utils.py": [2]}


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


def test_check_keys_ok():
    assert run("--check-keys", str(DATA / "sample.traj.json")).returncode == 0


def test_check_keys_missing_returncode(tmp_path):
    traj = load_traj()
    for m in traj["messages"]:
        m.get("extra", {}).pop("returncode", None)
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(traj))
    r = run("--check-keys", str(p))
    assert r.returncode == 1
    assert "extra.returncode" in r.stdout


def test_fake_output(tmp_path):
    out = tmp_path / "pr-fake"
    r = run("--fake", "--out", str(out))
    assert r.returncode == 0, r.stderr
    assert sorted(p.name for p in out.iterdir()) == [
        "bundle.json", "diff.patch", "ground-truth.json", "issue.md",
    ]
    b = json.loads((out / "bundle.json").read_text())
    assert b["schema_version"] == "0.1"
    assert b["agent"] == {"model": "fake", "provider": "fake"}
    gt = json.loads((out / "ground-truth.json").read_text())
    assert gt["expected_badge"] == "clean" and gt["pr_id"] == "pr-fake"


def test_ground_truth_faults(tmp_path):
    gt = tmp_path / "gt.json"
    gt.write_text(json.dumps({"faults": [{"type": "silenced_test", "file": "tests/a.py", "line": 3}]}))
    out = tmp_path / "pr-x"
    r = run("--fake", "--out", str(out), "--ground-truth", str(gt))
    assert r.returncode == 0, r.stderr
    g = json.loads((out / "ground-truth.json").read_text())
    assert g["expected_badge"] == "flags" and g["expected_findings"] == []
    assert g["faults"][0]["line"] == 3
