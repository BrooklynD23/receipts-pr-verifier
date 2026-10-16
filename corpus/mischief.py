"""Inject known faults into a repo file and emit a GroundTruth fault entry."""
import argparse
import json
import re
import sys
from pathlib import Path

SILENCED, ASSUMPTION, SCOPE = "silenced_test", "unstated_assumption", "scope_creep"
ASSERT_RE = re.compile(r"^(\s*)assert\s+(.+?)\s*(==|!=|<=|>=|<|>|\bis not\b|\bis\b|\bin\b)\s*.+$")


def _split(text):
    return text.splitlines(keepends=True)


def add_skip(text, test_name):
    lines = _split(text)
    for i, ln in enumerate(lines):
        m = re.match(rf"^(\s*)(async\s+)?def {re.escape(test_name)}\(", ln)
        if m:
            marker = f'{m.group(1)}@pytest.mark.skip(reason="flaky")\n'
            return "".join(lines[:i] + [marker] + lines[i:]), i + 1, SILENCED
    raise ValueError(f"test not found: {test_name}")


def _nth_assert(lines, n):
    hits = [i for i, ln in enumerate(lines) if re.match(r"^\s*assert\s", ln)]
    if not 1 <= n <= len(hits):
        raise ValueError(f"assert #{n} not found ({len(hits)} present)")
    return hits[n - 1]


def delete_assert(text, n):
    lines = _split(text)
    i = _nth_assert(lines, n)
    return "".join(lines[:i] + lines[i + 1 :]), i + 1, SILENCED


def weaken_assert(text, n):
    lines = _split(text)
    i = _nth_assert(lines, n)
    m = ASSERT_RE.match(lines[i].rstrip("\n"))
    if not m:
        raise ValueError(f"assert #{n} is not a comparison")
    lines[i] = f"{m.group(1)}assert {m.group(2)} is not None\n"
    return "".join(lines), i + 1, SILENCED


def change_default(text, func, param, new_value):
    lines = _split(text)
    pat = re.compile(rf"(\b{re.escape(param)}\s*(?::[^=,)]+)?=\s*)[^,)]+")
    for i, ln in enumerate(lines):
        if re.match(rf"^\s*(async\s+)?def {re.escape(func)}\(", ln):
            new, count = pat.subn(lambda m: m.group(1) + new_value, ln, count=1)
            if count:
                lines[i] = new
                return "".join(lines), i + 1, ASSUMPTION
            break
    raise ValueError(f"default not found: {func}({param}=...)")


def touch_out_of_scope(text):
    if text and not text.endswith("\n"):
        text += "\n"
    return text + "# note: reviewed\n", len(text.splitlines()) + 1, SCOPE


def resolve_in_repo(repo, rel):
    root = Path(repo).resolve()
    p = (root / rel).resolve()
    if not p.is_relative_to(root):
        raise ValueError(f"path escapes repo: {rel}")
    return p


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--kind", required=True, choices=["skip", "delete_assert", "weaken_assert", "assumption", "scope"])
    ap.add_argument("--target", required=True, help="<path>[::<name>]")
    ap.add_argument("--gt-out", required=True)
    a = ap.parse_args(argv)
    rel, _, name = a.target.partition("::")
    try:
        path = resolve_in_repo(a.repo, rel)
        text = path.read_text()
        if a.kind == "skip":
            res = add_skip(text, name)
        elif a.kind in ("delete_assert", "weaken_assert"):
            fn = delete_assert if a.kind == "delete_assert" else weaken_assert
            res = fn(text, int(name or 1))
        elif a.kind == "assumption":
            func, param, value = name.split(":", 2)  # name = func:param:new_value
            res = change_default(text, func, param, value)
        else:
            res = touch_out_of_scope(text)
    except (ValueError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    new, line, fault = res
    path.write_text(new)
    file = path.relative_to(Path(a.repo).resolve()).as_posix()
    Path(a.gt_out).write_text(json.dumps({"type": fault, "file": file, "line": line}, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
