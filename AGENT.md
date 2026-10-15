# AGENT.md — Receipts PR Verifier

## Mission

Agent-written PRs can quietly skip tests, widen scope or leave requirements unproven. Receipts PR Verifier makes the coding agent ship an evidence bundle (commands, tests, declared scope, assumptions, requirement→diff-line map). A deterministic TypeScript checker cross-checks the bundle against the diff. An independent LLM reviewer then returns a requirement→evidence matrix. The hosted demo runs entirely on committed fixtures (replay mode, zero keys). Live mode calls Claude only when `REVIEWER_MODE=live` and `ANTHROPIC_API_KEY` are set.

## Stack (pinned; links and justifications in [PLAN-01 §6](docs/PLAN-01-architecture.md#6-pinned-stack))

| Area | Pin |
|---|---|
| Runtime | Node 24 LTS, npm (no pnpm) |
| App | next 16.4.1 (App Router), react / react-dom 19.3.1, tailwindcss 4.3.3 |
| Language | typescript 6.0.3 (not 7.x: see [PLAN-01 §6](docs/PLAN-01-architecture.md#6-pinned-stack)) |
| Validation / LLM | zod 4.6.7, @anthropic-ai/sdk 0.134.0 |
| Tests | vitest 5.0.4 + @vitest/coverage-v8 5.0.4, @playwright/test 1.64.1, @axe-core/playwright 4.13.0 |
| Lint / format | eslint 10.12.0, eslint-config-next 16.4.1, prettier 3.9.10 |
| Scripts | tsx 4.23.15 |
| Corpus (optional wave) | Python 3.12, mini-swe-agent 2.4.6, pytest 9.1.1, stdlib otherwise |

## Repo layout

```
src/app/            pages: / (PR list), /pr/[id] (matrix + diff), /results; api/review/route.ts
src/components/     Badge, PrList, Matrix, DiffView, PrWorkspace (only client component)
src/lib/            env, schemas (zod contracts), diff (hand parser), rate-limit, fixtures, workspace, eval
src/lib/checker/    deterministic rules + badge
src/lib/reviewer/   prompt, anthropic, replay, index (review())
fixtures/prs/<id>/  issue.md, diff.patch, bundle.json, ground-truth.json, reviews/<arm>.json
fixtures/eval/      results.json (detection table)
scripts/            check-pr, smoke, eval, record-reviews, validate-fixtures (run with tsx)
corpus/             Python corpus pipeline (optional, WAVE-07)
e2e/                Playwright specs
.github/workflows/  ci.yml, receipts-check.yml, corpus.yml
```

## Commands

| Task | Command |
|---|---|
| Install | `npm ci` then `npx playwright install --with-deps chromium` |
| Dev | `npm run dev` (replay mode by default) |
| Unit tests | `npm test` |
| Coverage (gate) | `npm run test:coverage` |
| Lint / types / format | `npm run lint` · `npm run typecheck` · `npm run format` (fix: `npm run format:write`) |
| Build | `npm run build` |
| E2E | `npm run e2e` (builds, runs `next start`, replay mode) |
| Hosted smoke | `DEMO_URL=https://<app>.vercel.app npm run smoke` |
| Live mode | `REVIEWER_MODE=live ANTHROPIC_API_KEY=... npm run dev` |
| Corpus tests | `.venv/bin/python -m pytest corpus/tests -q` |

## Conventions

1. TDD: write the failing test first, then code. Tests sit next to code as `*.test.ts(x)`.
2. Pure functions over plain data. Return new objects; never mutate inputs.
3. Every external input is parsed with a zod schema from `src/lib/schemas.ts` at the boundary (HTTP body, fixture files, LLM output, CLI args).
4. Secrets only from env (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`). Never log them. Never ship them to the client.
5. Diff, bundle, PR text and code comments are untrusted data. Render as text (no `dangerouslySetInnerHTML`). Wrap in `<untrusted_pr_data>` in prompts.
6. Before finishing a task run `npx prettier --write <owned files>`; every wave gate runs `npm run format`.
7. Deliberate shortcuts carry a `ponytail:` comment naming the ceiling and the upgrade path.
8. No new dependency without a one-line justification added to PLAN-01 §6.
9. Only the task that owns `package.json` in a wave may change it or the lockfile (WAVE-00 owns all deps).
10. Commits: conventional (`feat:`, `fix:`, `test:` ...).

## Quality bar

- Coverage ≥ 80% lines, functions, branches, statements; enforced by vitest `coverage.thresholds`.
- `npm run lint && npm run typecheck && npm run test:coverage && npm run build` exit 0 before any wave gate passes.
- Playwright E2E covers the demo flow (sabotage, arm toggle, injection, missing evidence) plus an axe scan with 0 serious/critical violations.
- Accessibility: keyboard-reachable controls, visible focus, 4.5:1 contrast, `aria-label` on badges, one `role="status"` region for results.

## Where to look

| Need | Doc |
|---|---|
| Problem, scope, demo script, risks, hours | [docs/PLAN-00-overview.md](docs/PLAN-00-overview.md) |
| Architecture, zod contracts, sequence, deps | [docs/PLAN-01-architecture.md](docs/PLAN-01-architecture.md) |
| Wave map and DAG | [docs/PLAN-02-waves.md](docs/PLAN-02-waves.md) |
| Per-wave tasks | `docs/WAVE-NN-*.md` |
| Human setup (accounts, keys, deploy, video) | `docs/HUMAN-NN-*.md` |
| Progress | [docs/STATUS.md](docs/STATUS.md) |
| Source research (versions, links) | `docs/RESEARCH-01..03-*.md` |

## Loop kit

| Agent (`.claude/agents/`) | Model | Role |
|---|---|---|
| loop-researcher | haiku | look-ups, version and link checks |
| loop-planner | opus | lists/parses waves, replans failed tasks |
| loop-implementer | sonnet | implements one task (TDD), fixes review findings, commits |
| loop-reviewer | opus | task review, wave gate review, release review |

Workflow: `.claude/workflows/loop-build.js`. Run it by asking Claude Code "run the loop-build workflow", or `Workflow({name:'loop-build', args:{from:0}})` (args: `from`, `to`, `maxFix`). Recommended order: `args:{from:0,to:5}` then `args:{from:8,to:8}`, so optional WAVE-06/07 cannot block the final wave; run `{from:6,to:7}` later. It builds each `docs/WAVE-NN-*.md` in order: parallel tasks → per-task review → wave gate → commit → mark `docs/STATUS.md`. It stops when a wave's HUMAN prerequisite fails its verification command.
