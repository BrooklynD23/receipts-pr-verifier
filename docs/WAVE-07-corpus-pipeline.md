# WAVE-07 — Optional corpus pipeline (Python, keyless code)
Depends on: WAVE-03
Human prerequisites: none

## Tasks
### T07.1 — Trajectory → bundle → PR dir
- Files: corpus/traj_to_bundle.py, corpus/tests/test_traj_to_bundle.py, corpus/tests/data/sample.traj.json, corpus/tests/data/sample.junit.xml, corpus/tests/data/sample.patch, corpus/tests/data/sample.claims.json, corpus/tests/data/sample.issue.json
- Do:
  0. Context for every task in this wave: Optional. Builds the code that turns mini-swe-agent runs on a `pypa/packaging` fork into PR dirs in the fixture format. All code runs keyless on samples. The real run (needs a model key) is [HUMAN-05](HUMAN-05-corpus-run.md). Python 3.12, stdlib only, pytest 9.1.1 for tests. Each acceptance line creates `.venv` idempotently. Trajectory keys come from DeepWiki ([RESEARCH-03](RESEARCH-03-devin-repo-answers.md)) and are **unverified** against a real file ([RESEARCH-02 §1](RESEARCH-02-github-corpus-and-human-setup.md)). The `--check-keys` mode exists to verify them.
  1. `sample.traj.json`: hand-written in the shape from RESEARCH-03 — top-level `info` (`model_stats`, `config`, `mini_version`, `exit_status`, `submission`), `messages`, `trajectory_format`; assistant messages with `extra.actions` (list of `{command: str}`) and `extra.timestamp`; observation messages with `extra.returncode`. First line of the file's sibling note in the test docstring: "UNVERIFIED shape — replace with a real dump (HUMAN-05 step 4)".
  2. `traj_to_bundle.py` CLI: `--traj --junit --diff --issue --claims? --out DIR [--ground-truth FILE]` → writes `DIR/{issue.md,diff.patch,bundle.json,ground-truth.json}`. `commands` from paired action/observation (`stdout_tail` last 2,000 chars of observation content); `tests` from JUnit XML via `xml.etree.ElementTree` (`collected`=tests, `skipped`, `failed`=failures+errors, `ran`=tests−skipped, `passed`=ran−failed); `files_touched` from diff `+++ b/` headers; `declared_scope` + requirements text from issue JSON; `assumptions` + `diff_lines` from optional claims JSON (absent → empty lists/maps). `schema_version: "0.1"`. `agent` (required): `{ model, provider }` from `info.config.model.model_name` if present, else the `--model` / `--provider` CLI args (default `"unknown"`); `--fake` uses `{ model: "fake", provider: "fake" }`. Without `--ground-truth` write a clean GroundTruth (`expected_badge: "clean"`, empty `faults` and `expected_findings`); with it, read the fault entries written by `mischief.py`, set `expected_badge: "flags"`, `expected_findings: []` (corpus eval scores faults only).
  3. `--check-keys FILE`: assert required keys exist (`info`, `messages`, `trajectory_format`, at least one `extra.actions` and one `extra.returncode`); print the missing ones and exit 1.
  4. `--fake --out DIR`: build a PR dir from `corpus/tests/data/*` (keyless demo).
  5. JUnit parse: reject DOCTYPE/entities (stdlib `ElementTree` does not expand external entities; also refuse files > 5 MB).
- Tests: `test_traj_to_bundle.py` — command/returncode pairing; JUnit counts incl. skipped; files_touched from patch; claims absent → empty; `--check-keys` passes on sample, fails on a copy missing `extra.returncode`; `--fake` output dir has the 4 files and bundle has `schema_version` `0.1`.
- Acceptance: `python3 -m venv .venv/traj_to_bundle && .venv/traj_to_bundle/bin/pip install -q pytest==9.1.1 && .venv/traj_to_bundle/bin/python -m pytest corpus/tests/test_traj_to_bundle.py -q`, `python3 corpus/traj_to_bundle.py --fake --out corpus/out-fake/pr-fake && npx tsx scripts/validate-fixtures.ts corpus/out-fake`
### T07.2 — Mischief patches with ground truth
- Files: corpus/mischief.py, corpus/tests/test_mischief.py
- Do:
  1. Pure functions over file text, each returning `(new_text, line, fault)`: `add_skip(text, test_name)` (insert `@pytest.mark.skip(reason="flaky")` above `def test_name`), `delete_assert(text, n)`, `weaken_assert(text, n)` (`assert a == b` → `assert a is not None`), `change_default(text, func, param, new_value)` (unstated assumption), `touch_out_of_scope(text)` (append a harmless comment line).
  2. CLI: `python3 corpus/mischief.py --repo DIR --kind skip|delete_assert|weaken_assert|assumption|scope --target <path>[::<name>] --gt-out FILE` edits the file in place inside `--repo` (refuse paths outside it via `Path.resolve()` check) and writes a GroundTruth JSON fault entry.
  3. Map kinds → fault types: skip→`silenced_test`, delete/weaken→`silenced_test`, assumption→`unstated_assumption`, scope→`scope_creep`.
- Tests: `test_mischief.py` — each function on a small sample string returns the correct 1-based line; weaken changes exactly one assert; path traversal refused; CLI writes valid JSON with `type`, `file`, `line`.
- Acceptance: `python3 -m venv .venv/mischief && .venv/mischief/bin/pip install -q pytest==9.1.1 && .venv/mischief/bin/python -m pytest corpus/tests/test_mischief.py -q`
### T07.3 — Issue pool, Python pins, corpus CI job
- Files: corpus/issues/*.json, corpus/requirements.txt, corpus/tests/test_issues.py, .github/workflows/corpus.yml
- Do:
  1. 8 issue files `corpus/issues/01.json`…`08.json` for `pypa/packaging`, each `{ id, title, body, requirements: [{id, text}], declared_scope: [...] }`, sized for < 10 min agent runs ([A04 §a](../../../AI/loop-research/scratchpads/A04-receipts-pr-verifier.md)).
  2. `corpus/requirements.txt`: `mini-swe-agent==2.4.6` and `pytest==9.1.1`.
  3. `.github/workflows/corpus.yml`: on `pull_request` and `push` with `paths: ["corpus/**"]`; `permissions: contents: read`; `actions/checkout@v7`, `actions/setup-python@v7` (`python-version: "3.12"`, [releases](https://github.com/actions/setup-python/releases/latest)); `pip install pytest==9.1.1`; `python -m pytest corpus/tests -q`. No secrets.
- Tests: `test_issues.py` — 8 files; each has ≥ 1 requirement with id `R\d+`; `declared_scope` non-empty and no `..`; ids unique.
- Acceptance: `python3 -m venv .venv/issues && .venv/issues/bin/pip install -q pytest==9.1.1 && .venv/issues/bin/python -m pytest corpus/tests/test_issues.py -q`

## Wave gate
- Commands: `python3 -m venv .venv/gate && .venv/gate/bin/pip install -q pytest==9.1.1 && .venv/gate/bin/python -m pytest corpus/tests -q && python3 corpus/traj_to_bundle.py --fake --out corpus/out-fake/pr-fake && npx tsx scripts/validate-fixtures.ts corpus/out-fake && npm run lint && npm run test:coverage && npm run build && npm run format`
- Review focus: bundle JSON validates against the TS `Bundle` schema; unverified trajectory keys flagged and checkable; no network or model calls in tests; path traversal blocked in mischief CLI; XML size cap; corpus output dirs git-ignored.
