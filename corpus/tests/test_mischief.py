import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mischief as m

SRC = """import x

def helper(a, b=1):
    return a + b

def test_one():
    assert helper(1) == 2
    assert helper(2) == 3

class T:
    def test_two(self):
        assert helper(3) == 4
"""
SCRIPT = Path(__file__).resolve().parents[1] / "mischief.py"


def test_add_skip():
    new, line, fault = m.add_skip(SRC, "test_two")
    assert fault == "silenced_test"
    assert line == 11
    lines = new.splitlines()
    assert lines[10] == '    @pytest.mark.skip(reason="flaky")'
    assert lines[11] == "    def test_two(self):"


def test_add_skip_missing():
    with pytest.raises(ValueError):
        m.add_skip(SRC, "nope")


def test_delete_assert():
    new, line, fault = m.delete_assert(SRC, 2)
    assert (line, fault) == (8, "silenced_test")
    assert "helper(2) == 3" not in new
    assert new.count("assert") == 2


def test_weaken_assert_changes_one():
    new, line, fault = m.weaken_assert(SRC, 1)
    assert (line, fault) == (7, "silenced_test")
    assert "    assert helper(1) is not None" in new
    assert new.count("assert") == 3
    assert sum(a != b for a, b in zip(new.splitlines(), SRC.splitlines())) == 1


def test_assert_out_of_range():
    with pytest.raises(ValueError):
        m.delete_assert(SRC, 9)


def test_change_default():
    new, line, fault = m.change_default(SRC, "helper", "b", "5")
    assert (line, fault) == (3, "unstated_assumption")
    assert "def helper(a, b=5):" in new


def test_touch_out_of_scope():
    new, line, fault = m.touch_out_of_scope(SRC)
    assert fault == "scope_creep"
    assert line == len(SRC.splitlines()) + 1
    assert new.splitlines()[-1].startswith("#")


def test_path_traversal_refused(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (tmp_path / "evil.py").write_text(SRC)
    with pytest.raises(ValueError):
        m.resolve_in_repo(repo, "../evil.py")


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


def test_cli_writes_gt(tmp_path):
    repo = tmp_path / "repo"
    (repo / "tests").mkdir(parents=True)
    f = repo / "tests" / "test_a.py"
    f.write_text(SRC)
    gt = tmp_path / "gt.json"
    r = run("--repo", str(repo), "--kind", "skip", "--target", "tests/test_a.py::test_one", "--gt-out", str(gt))
    assert r.returncode == 0, r.stderr
    d = json.loads(gt.read_text())
    assert d == {"type": "silenced_test", "file": "tests/test_a.py", "line": 6}
    assert "pytest.mark.skip" in f.read_text()


def test_cli_refuses_outside(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (tmp_path / "e.py").write_text(SRC)
    r = run("--repo", str(repo), "--kind", "scope", "--target", "../e.py", "--gt-out", str(tmp_path / "g.json"))
    assert r.returncode != 0
    assert not (tmp_path / "g.json").exists()
