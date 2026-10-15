# REVIEW-01 — Plan review, round 1

Verdict: FAIL

2 blocking issues. Both are wave-mechanics problems that would make `loop-build` fail or flap. Product, security and docs pass.

## Checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Web app reachable by URL; zero-key hosted demo; live mode documented | PASS | AGENT.md:5, PLAN-00:28,64, HUMAN-02:4,9, HUMAN-03:8,27, env.ts spec WAVE-00:18 |
| 2a | Every wave has acceptance commands, scripts exist in WAVE-00 package.json | PASS | WAVE-00:12 (dev/build/start/lint/typecheck/test/test:coverage/e2e/format/smoke/check-pr/eval); every task has `- Acceptance:` |
| 2b | Tasks file-disjoint within a wave | PASS (files) / FAIL (runtime) | Files are disjoint (only T00.1 owns package.json/lockfile, WAVE-00:7). Shared runtime artifacts (`.next/`, port 3000) are not, see B1 |
| 2c | DAG acyclic, final wave not on optional waves | PASS | PLAN-02:24-40; WAVE-08:2 depends on WAVE-05 only |
| 2d | Gate commands runnable | FAIL | WAVE-08:34 `npm run format` first appears at the last gate, see B2 |
| 3 | TDD tests per task; 80% vitest thresholds; Playwright demo E2E in final wave | PASS | WAVE-00:15 thresholds 80×4; WAVE-08:11-13 sabotage + arm toggle + injection + axe |
| 4 | Human steps in HUMAN docs with links, env vars, verification, cost; off code critical path | PASS | HUMAN-01..06 each have Cost/Env vars/Verification; all waves say `Human prerequisites: none` |
| 5a | Ponytail: no needless services/deps; one-line justification | PASS | PLAN-01:237-261 (each dep justified, rejected list), no DB/auth |
| 5b | Security: env secrets, zod on /api/review, allowlisted prId, rate limit, prompt injection, no `pull_request_target` | PASS | PLAN-01:29,137-138,229-231,287-298; WAVE-04:13; WAVE-03:13-14; WAVE-06:22-24; WAVE-00:29 |
| 6 | Versions/links real | PASS | 5 fetched, all match (table below) |
| F1 | WAVE format | PASS (minor drift) | All headers/sections present; WAVE-02/04/05/06/07/08 add an intro paragraph before `## Tasks` (nit N1) |
| F2 | AGENT.md ≤120 lines + Loop kit | PASS | 91 lines; AGENT.md:82-91 has the 4 agents with right models, `.claude/workflows/loop-build.js`, `Workflow({name:'loop-build', args:{from:1}})` |
| F3 | CLAUDE.md exactly `@AGENT.md` | PASS | bytes `@AGENT.md\n` |
| F4 | README ≤30 lines | PASS | 30 lines |
| F5 | Tasks ≤ ~4 h; 4 × 12 h/week estimates | PASS | PLAN-02:9-18 (8–16 h per wave / 2–5 tasks), PLAN-00:81-91 |

## Blocking issues

### B1 — Parallel tasks race on one `.next/` dir and port 3000

- Location: `.claude/workflows/loop-build.js:159` runs a wave's tasks concurrently in one working tree, with no worktree isolation. These acceptance lines collide:
  - WAVE-08:15 (T08.1: `npx playwright test ...`, whose webServer runs `npm run build && npm run start` on :3000)
  - WAVE-08:31 (T08.3: `npm run build`, while T08.3 is also editing `next.config.ts`)
  - WAVE-05:15 (T05.1: `npx playwright test e2e/smoke.spec.ts` builds every route while T05.2/T05.3 are still writing `src/app/pr/[id]/page.tsx` and `src/app/results/page.tsx`)
- Cause: two `next build` runs write the same `.next/`. A build also compiles sibling tasks' half-written pages. Task reviewers re-run these acceptance commands while other tasks are still in flight. The result is failures that come and go, which burn the `maxFix` rounds and the replan, then stop the loop with "tasks failed review".
- Exact fix:
  1. WAVE-08 T08.3 Acceptance: replace with `npx vitest run src/lib/security-headers.test.ts`, `npx eslint next.config.ts src/lib/security-headers.ts`. The gate at WAVE-08:34 already runs `npm run build`.
  2. WAVE-08 T08.1 Acceptance: replace with `npx playwright test --list e2e/demo.spec.ts e2e/a11y.spec.ts`, `npx eslint e2e`. The real run stays in the gate (`npm run e2e`).
  3. WAVE-05 T05.1 Acceptance: replace with `npx eslint src/app/page.tsx src/app/layout.tsx e2e/smoke.spec.ts`. The WAVE-05 gate already runs `npx playwright test e2e/smoke.spec.ts`.
  4. Add one rule to PLAN-02:3: "Task acceptance never runs `next build`, `next start` or Playwright when the wave has more than one task; those run only in the wave gate."

### B2 — `npm run format` is first enforced at the final gate, and gate-fix cannot touch earlier waves' files

- Location: WAVE-08:34 (`... && npm run format && ...`). No earlier gate runs it (WAVE-00:34, 01:35, 02:50, 03:45, 04:53, 05:45). `.prettierrc.json` content is unspecified (WAVE-00:7,13).
- Cause: `prettier --check .` runs over every TS, TSX, JSON and YAML file written across 6 waves, plus the create-next-app scaffold. Unformatted files are near-certain. The W08 gate-fix agent may only "edit any file this wave's tasks own" (`loop-build.js:134`). It cannot reformat W00–W05 files, so the final gate fails 4 times and the loop stops before release.
- Exact fix:
  1. WAVE-00 T00.1 step 4: add script `"format:write": "prettier --write ."` and define `.prettierrc.json` as `{}` (Prettier defaults).
  2. WAVE-00 T00.1 Do: add a last step, `npm run format:write`.
  3. Append `&& npm run format` to the gate Commands of WAVE-00, 01, 02, 03, 04, 05 (and 06, 07).
  4. AGENT.md Conventions: add "Run `npx prettier --write <owned files>` before finishing a task."

## Links and versions spot-checked (WebFetch, 2026-10-14)

| URL | Claim in plan | Result |
|---|---|---|
| https://registry.npmjs.org/next/16.4.1 | next 16.4.1 (AGENT.md:12) | Exists; engines `node >=20.9.0`, OK with Node 24 |
| https://github.com/actions/checkout/releases/latest | `actions/checkout@v7` (WAVE-00:28) | Latest v7.0.1, matches RESEARCH-02:75 |
| https://github.com/actions/setup-python/releases/latest | `actions/setup-python@v7` (WAVE-07:33) | Latest v7.0.0 |
| https://platform.claude.com/docs/en/build-with-claude/structured-outputs | `messages.parse` + `output_config.format: zodOutputFormat(...)` from `@anthropic-ai/sdk/helpers/zod` (PLAN-01:223-224) | Confirmed verbatim |
| https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting | Hobby: 1 rate-limit rule, fixed window 10 s–10 min, 1M requests, 3 custom rules (HUMAN-04:8, RESEARCH-01:138) | Confirmed |

## Non-blocking nits (max 5)

1. N1, format drift: WAVE-02:5, 04:5, 05:5, 06:5, 07:5-7, 08:5 put an intro paragraph between `Human prerequisites:` and `## Tasks`. The LLM parser tolerates it. Move each into the first task's Do, or keep it.
2. N2, smoke step at WAVE-08:34: `sleep 8` is a fixed race and may be blocked as a foreground sleep in agent shells. Have `scripts/smoke.ts` retry `GET /` for up to 30 s instead, and drop the `sleep`.
3. N3, WAVE-07 T07.1:14 does not list the required `Bundle.agent {model, provider}` field (PLAN-01:41). The `validate-fixtures` acceptance will catch it; add `agent` from `info.config` to the Do.
4. N4, WAVE-05 T05.2:19: in Next 16, `params` is a Promise. Write `const { id } = await params` before `PrId.safeParse(id)`.
5. N5: `loop-build.js:173` skips the release review when the PLAN-02:46 "MVP first" path leaves W06/W07 open. Also, HUMAN-05:33 reads `r.cases>=16`, but T05.3 does not say `cases` is a number (state it), and HUMAN-04:25 uses `$DEMO_URL` without defining it.

Next action: apply the B1 and B2 edits to WAVE-00, WAVE-05, WAVE-08 and PLAN-02, then rerun the round-2 review.
