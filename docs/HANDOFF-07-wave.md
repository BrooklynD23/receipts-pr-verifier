# HANDOFF WAVE-07 — Optional corpus pipeline (Python, stdlib only)
Commit: 4e6bac1

## What now exists
- corpus/traj_to_bundle.py: trajectory + junit + diff + issue + claims -> TS bundle dir.
  Functions: commands_from_traj, tests_from_junit, files_touched, build_bundle, ground_truth, check_keys, write_pr_dir, main.
  Flags: --traj --junit --diff --issue --claims --out --ground-truth --model --provider --fake --check-keys FILE.
- corpus/mischief.py: injects faults into a repo copy.
  Functions: add_skip, delete_assert, weaken_assert, change_default, touch_out_of_scope, resolve_in_repo, main.
  Flags: --repo --kind {skip,delete_assert,weaken_assert,assumption,scope} --target <path>[::name] --gt-out.
- corpus/issues/01..08.json, corpus/tests/ (3 files, 26 tests, data/), corpus/requirements.txt (pytest).
- .github/workflows/corpus.yml (contents: read, no secrets).
- Commands:
  - python3 -m venv .venv/gate && .venv/gate/bin/pip install -q pytest==9.1.1
  - .venv/gate/bin/python -m pytest corpus/tests -q
  - python3 corpus/traj_to_bundle.py --fake --out corpus/out-fake/pr-fake
  - npx tsx scripts/validate-fixtures.ts corpus/out-fake

## Deviations
1. RED step not observed (T07.1, T07.2): pip timeout raced the first run; tests were written first/with the code.
2. --ground-truth accepts {"faults":[..]}, one fault dict, or a list (mischief format was undefined).
3. Prettier ran on JSON only; it cannot format .py.
4. Mischief `assumption` target syntax chosen: `<path>::func:param:new_value`; delete/weaken_assert name = 1-based assert index (default 1).
5. Fault entries are {type,file,line}, file relative to --repo (matches PLAN-01 GroundTruth.faults).
6. T07.3 red run failed on missing .venv, not on missing issue files.

## Known warnings
- sample.traj.json shape is UNVERIFIED (observations use role "user" + extra.returncode); --check-keys exists to verify against a real file.
- No Python coverage tool; 4 lint warnings are from earlier waves.
- Mischief CLI not run against a real repo.

## Next wave must know
- corpus/out*/ and .venv/ are git-ignored.
- Stdlib only; no network or model calls in tests.
- XML input rejects DOCTYPE/entities and caps at 5 MB.
