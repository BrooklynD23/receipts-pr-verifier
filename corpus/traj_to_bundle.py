#!/usr/bin/env python3
"""mini-swe-agent trajectory + JUnit + diff + issue -> PR dir in fixture format.

Trajectory keys are UNVERIFIED against a real file; use --check-keys to verify.
Stdlib only.
"""
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

DATA = Path(__file__).resolve().parent / "tests" / "data"
MAX_XML = 5 * 1024 * 1024
TAIL = 2000


def _extra(msg: dict) -> dict:
    e = msg.get("extra")
    return e if isinstance(e, dict) else {}


def commands_from_traj(traj: dict) -> list[dict]:
    """Pair each assistant action with the next observation carrying a returncode."""
    out: list[dict] = []
    pending: list[str] = []
    for m in traj.get("messages", []):
        e = _extra(m)
        actions = e.get("actions")
        if isinstance(actions, list) and actions:
            pending = [a.get("command", "") for a in actions if isinstance(a, dict)]
        elif "returncode" in e and pending:
            content = m.get("content", "")
            out.append({
                "cmd": pending.pop(0),
                "exit": int(e["returncode"]),
                "stdout_tail": (content if isinstance(content, str) else str(content))[-TAIL:],
            })
    return out


def tests_from_junit(path: Path) -> dict:
    path = Path(path)
    if path.stat().st_size > MAX_XML:
        raise ValueError("JUnit file larger than 5 MB")
    data = path.read_bytes()
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("JUnit file must not contain DOCTYPE or entities")
    root = ET.fromstring(data)
    suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
    tests = sum(int(s.get("tests", 0)) for s in suites)
    skipped = sum(int(s.get("skipped", 0)) for s in suites)
    failed = sum(int(s.get("failures", 0)) + int(s.get("errors", 0)) for s in suites)
    ran = tests - skipped
    return {"collected": tests, "ran": ran, "skipped": skipped, "passed": ran - failed, "failed": failed}


def files_touched(diff: str) -> list[str]:
    return re.findall(r"^\+\+\+ b/(.+)$", diff, flags=re.M)


def _load(path: Path):
    return json.loads(Path(path).read_text())


def build_bundle(traj, junit, diff, issue, claims, model="unknown", provider="unknown") -> dict:
    t = _load(traj)
    iss = _load(issue)
    cl = _load(claims) if claims else {}
    name = (((t.get("info") or {}).get("config") or {}).get("model") or {}).get("model_name")
    lines = cl.get("diff_lines", {})
    return {
        "schema_version": "0.1",
        "agent": {"model": name or model, "provider": provider},
        "commands": commands_from_traj(t),
        "tests": tests_from_junit(junit),
        "files_touched": files_touched(Path(diff).read_text()),
        "declared_scope": list(iss.get("declared_scope", [])),
        "assumptions": list(cl.get("assumptions", [])),
        "requirements": [
            {"id": r["id"], "text": r["text"], "diff_lines": lines.get(r["id"], {})}
            for r in iss.get("requirements", [])
        ],
    }


def ground_truth(pr_id: str, path: Path | None) -> dict:
    gt = {"pr_id": pr_id, "expected_badge": "clean", "faults": [], "expected_findings": []}
    if path is None:
        return gt
    raw = _load(path)
    faults = raw.get("faults", [raw]) if isinstance(raw, dict) else raw
    return {**gt, "expected_badge": "flags", "faults": faults}


def check_keys(path: Path) -> list[str]:
    t = _load(path)
    missing = [k for k in ("info", "messages", "trajectory_format") if k not in t]
    msgs = [m for m in t.get("messages", []) if isinstance(m, dict)]
    if not any(_extra(m).get("actions") for m in msgs):
        missing.append("messages[].extra.actions")
    if not any("returncode" in _extra(m) for m in msgs):
        missing.append("messages[].extra.returncode")
    return missing


def write_pr_dir(out: Path, bundle: dict, issue: Path, diff: Path, gt: dict) -> None:
    iss = _load(issue)
    out.mkdir(parents=True, exist_ok=True)
    (out / "issue.md").write_text(f"# {iss['title']}\n\n{iss.get('body', '')}\n")
    (out / "diff.patch").write_text(Path(diff).read_text())
    (out / "bundle.json").write_text(json.dumps(bundle, indent=2) + "\n")
    (out / "ground-truth.json").write_text(json.dumps(gt, indent=2) + "\n")


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--traj", type=Path)
    p.add_argument("--junit", type=Path)
    p.add_argument("--diff", type=Path)
    p.add_argument("--issue", type=Path)
    p.add_argument("--claims", type=Path)
    p.add_argument("--out", type=Path)
    p.add_argument("--ground-truth", type=Path)
    p.add_argument("--model", default="unknown")
    p.add_argument("--provider", default="unknown")
    p.add_argument("--fake", action="store_true")
    p.add_argument("--check-keys", type=Path, metavar="FILE")
    a = p.parse_args(argv)

    if a.check_keys:
        missing = check_keys(a.check_keys)
        for k in missing:
            print(f"missing: {k}")
        return 1 if missing else 0
    if not a.out:
        p.error("--out is required")
    if a.fake:
        a.traj, a.junit, a.diff = DATA / "sample.traj.json", DATA / "sample.junit.xml", DATA / "sample.patch"
        a.issue, a.claims = DATA / "sample.issue.json", DATA / "sample.claims.json"
        a.model = a.provider = "fake"
    elif not (a.traj and a.junit and a.diff and a.issue):
        p.error("--traj --junit --diff --issue are required (or use --fake)")

    bundle = build_bundle(a.traj, a.junit, a.diff, a.issue, a.claims, a.model, a.provider)
    if a.fake:  # sample traj names a model; fake mode always reports fake
        bundle["agent"] = {"model": "fake", "provider": "fake"}
    write_pr_dir(a.out, bundle, a.issue, a.diff, ground_truth(a.out.name, a.ground_truth))
    return 0


if __name__ == "__main__":
    sys.exit(main())
