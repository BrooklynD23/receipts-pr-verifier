# REVIEW-03 — Plan review, round 3 (final)

Verdict: PASS — 0 blocking

The round-2 blocker is fixed, and none of the nit fixes introduced a new blocker. The plan is ready for `loop-build`.

## Round-2 blocker

| Blocker | Result | Evidence |
|---|---|---|
| B1 — script-generated JSON breaks `npm run format` in later gates | FIXED | `.prettierignore` at WAVE-00:13 now lists `fixtures/eval/` and `fixtures/prs/*/reviews*/`. The second pattern uses gitignore syntax, so it is anchored and matches both `reviews/` and `reviews-sabotaged/`, which are the dirs written at WAVE-05:37. HUMAN-03:24 and HUMAN-05:63 (step 9) run `npm run format:write` before commit. HUMAN-05:62 writes record-reviews output to `corpus/out`, which is git-ignored (`corpus/out*/`, WAVE-00:13), and prettier 3 respects `.gitignore` |

## Nit fixes checked for regressions

| Fix | Result | Evidence |
|---|---|---|
| T00.1 prettier scope | OK | WAVE-00:22 `--write` and WAVE-00:24 `--check` use the same explicit list of T00.1's own files. Neither touches `.github/`. Non-parseable files (`.gitignore`, `.nvmrc`) are not listed, so prettier raises no "no parser" error. The gate still runs the whole tree (WAVE-00:35) |
| Recommended run order | OK | PLAN-02:48 and AGENT.md:92 both give `{from:0,to:5}` then `{from:8,to:8}`. `loop-build.js:16,146` honours `to`. STATUS marks W00–05 done, so the second run builds only W08. The release review is skipped until `{from:6,to:7}` completes (`loop-build.js:173-174`), which is the settled N3 |
| DEMO_URL | OK | HUMAN-04 Verification defines `DEMO_URL=https://<your-app>.vercel.app` before the loop |
| `cases` is a number | OK | WAVE-05:29 has `cases: number (count of scored PR variants)`, which matches `r.cases>=16` in HUMAN-05 Verification |

## Checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Zero-key hosted app; live mode documented | PASS | WAVE-00:18 (`readEnv`: live only with both vars, key never returned); WAVE-05:10,18 (replay banner; only a boolean `liveEnabled` reaches the client); HUMAN-03:7-8,28 (live mode, cap, env vars) |
| 2a | Acceptance commands on every task | PASS | Tasks/Acceptance per wave: 2/2, 3/3, 4/4, 4/4, 5/5, 4/4, 2/2, 3/3, 3/3 (WAVE-00..08) |
| 2b | Tasks file-disjoint; no shared runtime | PASS | Rule at PLAN-02:5. Build, start and Playwright run only in gates (WAVE-00:35, 05:44, 08:33). W07 uses per-task venvs (WAVE-07:32,35) |
| 2c | DAG acyclic; final wave independent of optional waves | PASS | PLAN-02:26-42. WAVE-08:2 depends only on WAVE-05. WAVE-06:2 and 07:2 depend on WAVE-03. The run order at PLAN-02:48 keeps W06/07 off W08's path |
| 3 | TDD, 80% coverage, Playwright E2E on the demo flow | PASS | `- Tests:` count equals task count in every wave; thresholds 80×4 at WAVE-00:15; `test:coverage` runs in every gate; Playwright demo + axe in WAVE-08 (T08.1), gate `npm run e2e` at WAVE-08:33 |
| 4 | HUMAN docs complete, off the critical path | PASS | Every WAVE has `Human prerequisites: none` (line 3 of each). HUMAN-03 and 05 each have Cost, Env vars, Steps and Verification. HUMAN-03:5 and HUMAN-05:40 say they never block the hosted MVP |
| 5 | Ponytail + security | PASS | No DB/auth; one install point (WAVE-00:11, PLAN-02:3). Key stays in `.env.local`, never `NEXT_PUBLIC_` (HUMAN-03:16); `.env*` is git-ignored (WAVE-00:13); CI has no secrets and no `pull_request_target` (WAVE-00:30,32). The new `.prettierignore` entries cover data that zod validates (`validate-fixtures`, WAVE-03:45) |
| 6 | Versions and links real | PASS | 3 new links fetched, all match (table below) |
| F | WAVE format parses with `loop-build.js` | PASS | Unchanged from round 2: `Depends on`, `Human prerequisites`, `### Txx.y`, `- Files:`, `## Wave gate` with `- Commands:` + `- Review focus:` map to TASKS (`loop-build.js:42-57`) |

## Blockers

None.

## Links fetched (WebFetch, 2026-10-14; none fetched in rounds 1–2)

| URL | Claim in plan | Result |
|---|---|---|
| https://github.com/actions/upload-artifact/releases/latest | `actions/upload-artifact@v7` (WAVE-00:29) | Latest is v7.0.2, released 07 Oct |
| https://pypi.org/pypi/mini-swe-agent/2.4.6/json | mini-swe-agent 2.4.6 on Python 3.12 (HUMAN-05:50) | Exists; `requires_python >=3.10` |
| https://registry.npmjs.org/vitest/5.0.4 | vitest 5.0.4 with Node 24 (WAVE-00:11-12) | Exists; engines `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`, so OK |

## Non-blocking nits (max 5)

1. HUMAN-05:57 (step 4) edits and commits `corpus/tests/data/sample.traj.json` without a format step. Only a re-run of the W07 gate would catch it. Fix: add `npm run format:write` before that commit.
2. WAVE-05:29 has a stray double space before `sources:` (cosmetic).
3. Carried over: `sleep 8` in the WAVE-08:33 smoke race. Settled; no action needed.

Next action: run `Workflow({name:'loop-build', args:{from:0, to:5}})`.
