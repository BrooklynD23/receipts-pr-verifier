# STATUS

| Wave | Status | Last gate result |
|---|---|---|
| WAVE-00 bootstrap | passed | gate ok 2026-10-14 @04995e2 (r2, playwright baseURL fix) |
| WAVE-01 contracts | passed | gate ok 2026-10-14 @ea28bd7 |
| WAVE-02 fixtures-and-checker | passed | gate ok 2026-10-14 @7d24fde |
| WAVE-03 reviewer-and-loader | passed | gate ok 2026-10-14 @96a7640 |
| WAVE-04 api-and-components | passed | gate ok 2026-10-15 @3464e78 (r2) |
| WAVE-05 pages-and-eval | passed | gate ok 2026-10-15 @0dc77a8 |
| WAVE-06 github-action (optional) | passed | gate ok 2026-10-15 @2318731 |
| WAVE-07 corpus-pipeline (optional) | todo | — |
| WAVE-08 e2e-deploy-release | passed | gate ok 2026-10-15 @6485254 |

| Human task | Status |
|---|---|
| HUMAN-01 github-repo | todo |
| HUMAN-02 vercel-deploy | todo |
| HUMAN-03 anthropic-key-and-spend-cap | todo |
| HUMAN-04 vercel-waf-rate-limit | todo |
| HUMAN-05 corpus-run | todo |
| HUMAN-06 demo-video-and-rehearsal | todo |

## Blockers
| 2026-10-15 | WAVE-05-pages-and-eval.md | blocked-gate | npm run lint -> 0 (0 errors, 3 pre-existing warnings: Badge.test.tsx:22, visuals/anatomy/build.mjs:32-33); npm run typecheck -> 0; npm run test:coverage -> 0 (27 files, 268 tests; lines 90.66%, branches 84.47%, funcs 89.14%, stmts 89.49%); npm run build -> 0 (/, /pr/pr-1..3, /results static); npx playwright test e2e/smoke.spec.ts -> 0 (2 passed, ran against the build from the previous gate step); npm run format -> 0; extra: record-reviews --dry-run -> 0; with no key -> 2; eval.ts --out /tmp/results-check.json -> 0, output matches the committed fixtures/eval/results.json apart from generated_at; secret scan (tracked + untracked) -> no real values (only docs $ANTHROPIC_API_KEY ref, max_tokens, js-tokens). 1. playwright.config.ts:8: webServer changed from `npm run build && npm run start` to `npm run start`. .github/workflows/ci.yml has no build step (npm ci -> lint -> typecheck -> test:coverage -> playwright install -> npm run e2e), so on a fresh checkout `next start` finds no .next build and CI e2e fails. This also breaks AGENT.md ('npm run e2e builds, runs next start'), and the file is not owned by any WAVE-05 task. Fix: restore `command: "npm run build && npm run start"`, or add `- run: npm run build` before `npm run e2e` in ci.yml and in the e2e npm script. 2. src/components/PrWorkspace.tsx:74-106: new logic with no test. This is the live/fallback useEffect: skip on first render, stale-guard, 45 s abort, FALLBACK relabel, and the setArm path when no recorded review exists. File coverage is 40% lines and 42.85% branches (uncovered 67, 75-104, 127-138). The review focus says 'fallback labels always visible', and nothing checks that. Fix: add a PrWorkspace.test.tsx case that renders with liveEnabled=true and a stubbed global fetch that rejects or returns 500, clicks arm B, and asserts the 'FALLBACK — recorded' label and aria-busy=false; add one case where fetch resolves OK. 3. src/components/PrWorkspace.tsx:146: the status region reads `badge {badge}`, which renders the raw enum (`missing_evidence`). The WAVE-05 T05.2 step 4 contract is 'badge <text>' (Clean / Flags / Missing evidence). Fix: export the text map from src/components/Badge.tsx (e.g. `BADGE_TEXT`), use `BADGE_TEXT[badge]` here, and assert it in PrWorkspace.test.tsx. 4. src/components/PrWorkspace.tsx:110: PrWorkspace renders `<main>` inside layout.tsx's `<main id="main">`, so /pr/* has a nested, duplicate main landmark. That is invalid HTML and will fail the axe scan the quality bar requires (landmark-no-duplicate-main / landmark-main-is-top-level). Fix: change the wrapper to `<div className="mx-auto max-w-5xl p-4">`. |

## Cross-review 2026-10-14
- WAVE-00 T00.1 step 13: dropped `--with-deps` (needs sudo); human step added to HUMAN-01.

## WAVE-04 notes 2026-10-15
- T04.1: dropped `export const runtime = "nodejs"`. Node is the default runtime with cacheComponents: true; PLAN-01 has no runtime contract.
- visuals/ (1.3 MB, untracked before) was swept into the wave commit by `git add -A`. Remove from git or ignore it.
