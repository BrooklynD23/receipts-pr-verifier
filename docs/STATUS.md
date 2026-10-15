# STATUS

| Wave | Status | Last gate result |
|---|---|---|
| WAVE-00 bootstrap | passed | gate ok 2026-10-14 @04995e2 (r2, playwright baseURL fix) |
| WAVE-01 contracts | passed | gate ok 2026-10-14 @ea28bd7 |
| WAVE-02 fixtures-and-checker | passed | gate ok 2026-10-14 @7d24fde |
| WAVE-03 reviewer-and-loader | passed | gate ok 2026-10-14 @96a7640 |
| WAVE-04 api-and-components | passed | gate ok 2026-10-15 @3464e78 (r2) |
| WAVE-05 pages-and-eval | todo | — |
| WAVE-06 github-action (optional) | todo | — |
| WAVE-07 corpus-pipeline (optional) | todo | — |
| WAVE-08 e2e-deploy-release | todo | — |

| Human task | Status |
|---|---|
| HUMAN-01 github-repo | todo |
| HUMAN-02 vercel-deploy | todo |
| HUMAN-03 anthropic-key-and-spend-cap | todo |
| HUMAN-04 vercel-waf-rate-limit | todo |
| HUMAN-05 corpus-run | todo |
| HUMAN-06 demo-video-and-rehearsal | todo |

## Cross-review 2026-10-14
- WAVE-00 T00.1 step 13: dropped `--with-deps` (needs sudo); human step added to HUMAN-01.

## WAVE-04 notes 2026-10-15
- T04.1: dropped `export const runtime = "nodejs"`. Node is the default runtime with cacheComponents: true; PLAN-01 has no runtime contract.
- visuals/ (1.3 MB, untracked before) was swept into the wave commit by `git add -A`. Remove from git or ignore it.
