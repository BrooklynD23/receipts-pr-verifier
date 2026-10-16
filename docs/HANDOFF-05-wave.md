# HANDOFF-05 (WAVE-05 pages, eval, recording) @0dc77a8

## What now exists
- Pages: `src/app/page.tsx` (PR list), `src/app/pr/[id]/page.tsx` (workspace, prerendered pr-1..3), `src/app/results/page.tsx` (eval table, caption "4 cases, hand-authored samples — not a benchmark").
- Components (`src/components/`): `PrList`, `PrWorkspace` (exports `fetchLiveReview`, `fallbackReview`), `DiffView` (`anchorId`), `Matrix`, `Badge`. Each has a `.test.tsx`.
- Endpoint: `POST /api/review` (`src/app/api/review/route.ts`, from WAVE-04).
- Scripts: `scripts/eval.ts` (`run`, `parseArgv`; `npm run eval`, `--out <file>`), `scripts/record-reviews.ts` (`run(deps)`; `--dry-run`; exits 2 without `$ANTHROPIC_API_KEY`; each result checked with `ReviewResult.parse` before write). Also `scripts/validate-fixtures.ts`.
- Output: `fixtures/eval/results.json` (eval.ts matches it except `generated_at`).
- E2E: `e2e/smoke.spec.ts` (2 tests, axe included).
- Gate: lint 0 (3 warnings), typecheck 0, 268 tests in 27 files, coverage 89.49% stmts / 84.47% branches, build 0, e2e 0, format 0.

## Deviations
- None from the plan (tasks T05.1-T05.4 passed review in the previous run).

## Known warnings (fix soon)
1. `src/components/PrWorkspace.tsx:111` is a second `<main>` inside `layout.tsx:27` `<main id="main">`. axe: landmark-main-is-top-level / no-duplicate-main (moderate). Fix: use `<div>`.
2. `PrWorkspace.tsx:132` status shows raw enum ("badge missing_evidence"); spec wants "Missing evidence". Reuse Badge.tsx text map.
3. `PrWorkspace.tsx` coverage 40%: live/fallback `useEffect` (lines 75-104) untested. Add test with failing fake fetch, assert "FALLBACK — recorded" label.
4. `playwright.config.ts` webServer is `npm run start` (no build). AGENT.md says `npm run e2e` builds, and ci.yml has no build step, so CI e2e would fail on a fresh checkout. Restore `npm run build && npm run start` or add a build step.
5. Lint warnings: `Badge.test.tsx:22` `_text`; `visuals/anatomy/build.mjs:32-33` unused vars.
6. e2e flaked once (`net::ERR_NETWORK_CHANGED`, WSL); passed on rerun.

## Next wave must know
- Fix items 1, 2 and 4 before WAVE-08 e2e/deploy; they affect CI and a11y.
- No `process.env` reaches the client; only the `liveEnabled` boolean does. Keep it that way.
- Recording real reviews needs `$ANTHROPIC_API_KEY` (HUMAN-03).
