# HUMAN-05 — Corpus run: fork, mini-swe-agent, mischief, 16-PR eval

| Field | Value |
|---|---|
| Needed before | Replacing the demo-set results table with the 16-PR corpus table. After WAVE-07 and HUMAN-03. Never blocks the hosted MVP |
| Time | ~6 h (8 agent runs < 10 min each + review) |
| Cost | Coder: `mini -l 1` caps each run at $1 → ≤ $8. Reviewer: 16 PRs × 4 arms = 64 calls × ~$0.022 ≈ $1.40. Total < $10, within the HUMAN-03 cap and MV3's < $20 budget |
| Env vars | `ANTHROPIC_API_KEY` (reviewer, and coder if using Claude). Optional `OPENAI_API_KEY` for a different-family coder (MV3 §4); second bill and second key to rotate ([RESEARCH-02 §6](RESEARCH-02-github-corpus-and-human-setup.md)) |

Coder model choice: MV3 wants the coder from a different family than the reviewer. With only an Anthropic key, use `claude-haiku-5-5` as coder and note "same-family coder" in the results caption.

## Steps

1. Fork https://github.com/pypa/packaging (Apache-2.0 OR BSD-2-Clause, [PyPI](https://pypi.org/project/packaging/)) → Fork → Create fork ([fork docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)). Clone it next to this repo: `git clone https://github.com/<user>/packaging ../packaging-fork`.
2. Python env (3.12): `python3.12 -m venv .venv && .venv/bin/pip install -r corpus/requirements.txt` (mini-swe-agent 2.4.6, pytest 9.1.1; [PyPI](https://pypi.org/project/mini-swe-agent/)). In the fork: `../packaging-fork$ ../P2-receipts-pr-verifier/.venv/bin/pip install -e .`, then check the test command: `pytest --collect-only -q | tail -1` (test deps unverified, install what pytest reports missing).
3. Set `RP=$(pwd)` in this repo, then `cd ../packaging-fork`. For each issue `NN`: `git switch -c agent/NN main`, then run (flags per [mini usage](https://mini-swe-agent.com/latest/usage/mini/)):
   ```bash
   TASK="$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d["title"]+"\n\n"+d["body"]+"\n\nWhen done, write .receipts/claims.json with assumptions and a requirement -> file:line map.")' "$RP/corpus/issues/NN.json")"
   "$RP/.venv/bin/mini" -t "$TASK" -m anthropic/claude-haiku-5-5 -y -l 1 --exit-immediately --environment-class local -o "$RP/corpus/out-raw/NN.traj.json"
   ```
   Model string format is LiteLLM's (`anthropic/<model-id>`) — confirm on the first run.
4. **Verify trajectory keys** on the first real file: `python3 corpus/traj_to_bundle.py --check-keys corpus/out-raw/01.traj.json`. If it fails, update `corpus/tests/data/sample.traj.json` and the parser to the real keys, run `.venv/bin/python -m pytest corpus/tests -q` and `npm run format:write`, then commit.
5. Per run, in the fork: `pytest -q --junit-xml="$RP/corpus/out-raw/NN.junit.xml"` and `git diff main -- . ':!.receipts' > "$RP/corpus/out-raw/NN.patch"`. Then in this repo build the clean PR dir:
   `python3 corpus/traj_to_bundle.py --traj corpus/out-raw/NN.traj.json --junit corpus/out-raw/NN.junit.xml --diff corpus/out-raw/NN.patch --issue corpus/issues/NN.json --claims ../packaging-fork/.receipts/claims.json --out corpus/out/pr-NN-clean`
6. Mischief variants (target: 4 clean, 4 silenced test, 4 scope creep, 4 unstated assumption = 16): on a copy branch `agent/NN-<kind>` run `python3 corpus/mischief.py --repo ../packaging-fork --kind <kind> --target <path>[::<test>] --gt-out corpus/out-raw/NN-<kind>.gt.json`, re-run step 5 with `--ground-truth` and `--out corpus/out/pr-NN-<kind>`.
7. Validate: `npx tsx scripts/validate-fixtures.ts corpus/out`.
8. Record reviews and score: `npx tsx scripts/record-reviews.ts --dir corpus/out` then `npx tsx scripts/eval.ts --dir corpus/out --out fixtures/eval/results.json`.
9. Run `npm run format:write`, then commit `fixtures/eval/results.json` only (`corpus/out*/` is git-ignored). Check `/results` caption says "16 cases, recorded".

## Verification

```bash
ls -d corpus/out/pr-* | wc -l | grep -qx 16 && npx tsx scripts/validate-fixtures.ts corpus/out && node -e "const r=require('./fixtures/eval/results.json');process.exit(r.cases>=16?0:1)"
```
