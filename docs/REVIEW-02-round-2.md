# REVIEW-02 — Plan review, round 2

Verdict: FAIL — 1 blocking

Round-1 B1 is fixed in every wave. Round-1 B2 is fixed for files the loop writes. It is not fixed for JSON that scripts write during human steps: those files can still break a later gate that cannot fix them. Everything else passes.

## Round-1 blockers

| Blocker | Result | Evidence |
|---|---|---|
| B1 — parallel tasks race on `.next/`, :3000, Playwright | FIXED | Rule at PLAN-02:5. No task acceptance in any multi-task wave runs `next build`, `next start` or Playwright except `--list`: WAVE-00:24 (`playwright test --list`), 05:14,24,33,41, 08:14,22,30. W07 tasks use separate venvs (WAVE-07:16,24,32). Remaining runs sit only in gates: WAVE-00:35, 05:44, 08:33 |
| B2 — format first enforced at the final gate | FIXED for loop-written files, see new B1 | `format:write` + `.prettierrc.json` `{}`: WAVE-00:12-13. Last step `format:write`: WAVE-00:22. `npm run format` in every gate: WAVE-00:35, 01:35, 02:49, 03:45, 04:52, 05:44, 06:28, 07:35, 08:33. Convention: AGENT.md:58 |

## Checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Zero-key hosted app; live mode documented | PASS | AGENT.md:5,48; README:8,20; WAVE-00:18 (`env.ts`); HUMAN-02:9,16; HUMAN-03:8,27 |
| 2a | Every task has acceptance commands | PASS | Every task in WAVE-00..08 has `- Acceptance:` |
| 2b | File-disjoint within a wave, including shared dirs and runtime | PASS (nit N1) | Files lists are disjoint. `.next/` and :3000 are used only in gates (PLAN-02:5). W07 venvs are per task. T00.1 runs whole-tree `npm run format` (WAVE-00:22,24), see N1 |
| 2c | DAG acyclic; W08 not on W06/W07 | PASS | PLAN-02:24-40 graph; WAVE-08:2 `Depends on: WAVE-05`; WAVE-06:2, 07:2 depend on WAVE-03 |
| 3 | TDD, tests named per task, 80% coverage, Playwright demo incl. sabotage + toggle | PASS | AGENT.md:53; each task has `- Tests:` with file names; thresholds 80×4 at WAVE-00:15; WAVE-08:10-12 (sabotage <1 s, arm A vs D, keyboard variant, axe) |
| 4 | Human steps in HUMAN docs (links, env vars, verification, cost), off code path | PASS | HUMAN-01..06 each have a Cost / Env vars table and `## Verification`; every WAVE has `Human prerequisites: none` |
| 5a | Ponytail: each dependency justified | PASS | PLAN-01:237-261 (one-line reason per pin); hand diff parser WAVE-01:20; no DB/auth |
| 5b | Security: env secrets, zod, rate limit, injection, no `pull_request_target` | PASS | AGENT.md:55-57; WAVE-04:12 (strict zod, 413/415/429, generic errors); WAVE-03:13-14 (untrusted wrapper + escape); WAVE-06:21-23 (`pull_request` only, `${{ }}` only in `env:`), checked by acceptance at WAVE-06:25 and WAVE-00:32; PLAN-01:231,293 |
| 6 | Versions and links real | PASS | 4 fetched, all match (table below) |
| F | WAVE format matches `loop-build.js` | PASS | Each WAVE has `Depends on:`, `Human prerequisites:`, `## Tasks`, `### Txx.y — title`, `- Files:`, `## Wave gate` with `- Commands:` + `- Review focus:`, which map to the TASKS schema (`loop-build.js:42-57`). Round-1 N1 is fixed: the intro paragraphs moved into step `0.` of the first task |
| G | AGENT.md, CLAUDE.md, README | PASS | AGENT.md is 92 lines and includes the Loop kit (82-92); CLAUDE.md bytes are `@AGENT.md\n`; README is 30 lines |

## Blockers

### B1 — Script-generated JSON is not prettier-stable, and a later gate cannot fix it

- Location:
  - HUMAN-03:19-24 runs `record-reviews.ts` and `npm run eval`, then commits `fixtures/` with no format step.
  - HUMAN-05:27-29 does the same for `fixtures/eval/results.json`.
  - The writers at WAVE-05:29 (T05.3 `eval.ts`) and WAVE-05:37 (T05.4 `record-reviews.ts`) do not specify prettier-formatted output.
  - `.prettierignore` at WAVE-00:13 does not exclude these paths.
- Cause:
  1. `JSON.stringify(x, null, 2)` puts each item of a short array on its own line. Prettier collapses such arrays, for example `evidence` and `declared_scope`, onto one line, so `prettier --check` fails.
  2. HUMAN-03 is allowed at any time after W05 (HUMAN-03:5). PLAN-02:46-48 recommends building W00–05 and W08 first, then W06–07 later.
  3. If the human records reviews before W08, or before the later W06/W07 run, `npm run format` fails in that gate (WAVE-08:33, 06:28, 07:35) on files owned by W02 (`fixtures/prs/**`) and W05 (`fixtures/eval/results.json`).
  4. Gate-fix may only edit "any file this wave's tasks own" (`loop-build.js:134`). The gate fails 4 times, and the loop stops with "wave gate failed".
- Fix (one line, WAVE-00:13): append to `.prettierignore` the entries `fixtures/eval/` and `fixtures/prs/*/reviews*/`. These are generated data, and zod already validates them (`validate-fixtures`). Optionally also add `npm run format:write` before `git commit` in HUMAN-03 step 6 and HUMAN-05 step 9.

## Links fetched (WebFetch, 2026-10-14; none overlap round 1)

| URL | Claim in plan | Result |
|---|---|---|
| https://registry.npmjs.org/@anthropic-ai/sdk/0.134.0 | `@anthropic-ai/sdk@0.134.0` and `@anthropic-ai/sdk/helpers/zod` (WAVE-00:11, WAVE-03:23) | Exists. The `./helpers/*` export covers `helpers/zod`. Peer dependency is zod `^3.25.0 \|\| ^4.0.0` (optional), so zod 4.6.7 is OK |
| https://registry.npmjs.org/tailwindcss/4.3.3 | tailwindcss 4.3.3 (AGENT.md:12) | Exists |
| https://registry.npmjs.org/prettier/3.9.10 | prettier 3.9.10 (AGENT.md:16) | Exists |
| https://platform.claude.com/docs/en/about-claude/pricing (HUMAN-03:7) | Sonnet 5.5 $2/$10; Haiku 5.5 $0.10/$0.50 for prompts ≤100k | Confirmed exactly, including the 100k tier |

## Non-blocking nits (max 5)

1. N1, WAVE-00:22,24: T00.1 runs whole-tree `prettier --write .` and `--check .`, which also covers T00.2's `.github/workflows/ci.yml`. That breaks the spirit of PLAN-02:5 and can flap once if the review runs before T00.2 formats. Fix: change T00.1 acceptance to `npx prettier --check $(git ls-files -co --exclude-standard -- ':!.github')`. Alternatively, accept the risk: the gate at WAVE-00:35 catches it.
2. N2 (carried over), WAVE-08:33: `sleep 8` is a fixed race. Have `smoke.ts` retry `GET /` for up to 30 s, and drop the `sleep`.
3. N3 (carried over), `loop-build.js:173`: on the MVP-first path (PLAN-02:46), the release review is skipped while W06 and W07 are still open. The W08 gate's "Review focus (release)" partly covers it. Mention this in PLAN-02:46.
4. N4: with `from:0` (PLAN-02:48), the loop runs W06 and W07 before W08 (`loop-build.js:146`). A failure in an optional wave therefore blocks W08 in practice, even though the DAG does not. Recommend the MVP-first order as the default in AGENT.md:92.
5. N5 (carried over): HUMAN-04:25 uses `$DEMO_URL` without defining it. T05.3 does not state that `cases` is a number, yet HUMAN-05:33 checks `r.cases>=16`.

Next action: add `fixtures/eval/` and `fixtures/prs/*/reviews*/` to the `.prettierignore` line at WAVE-00:13, then rerun the round-3 review.
