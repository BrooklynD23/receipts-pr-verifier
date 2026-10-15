# WAVE-05 — Pages (list, PR workspace, results), eval and recording scripts
Depends on: WAVE-04
Human prerequisites: none

## Tasks
### T05.1 — PR list page (screen 1)
- Files: src/app/page.tsx, src/app/layout.tsx, src/app/globals.css, e2e/smoke.spec.ts
- Do:
  0. Context for every task in this wave: Pages are server components that load fixtures with `listDemoPrs` / `loadDemoPr` and are statically generated at build. `PrWorkspace` is the only client component.
  1. `page.tsx`: `<h1>Receipts PR Verifier</h1>`, one-line explainer, `PrList` with badge computed by `badgeFor(check(diff, bundle))` per PR (server-side), link to `/results`. Mode banner: "Replay mode — reviewer outputs are recorded" unless live is enabled (`readEnv().mode`).
  2. `layout.tsx`: skip link to `#main`, `<main id="main">`, header nav (Home, Results), visible focus ring utility in `globals.css` (`:focus-visible` outline 2px), `prefers-reduced-motion` respected.
  3. `e2e/smoke.spec.ts`: extend — 3 PR links visible; badges read Clean, Flags, Missing evidence for pr-1, pr-2, pr-3.
- Tests: `e2e/smoke.spec.ts` (updated). Page logic stays in already-tested lib functions.
- Acceptance: `npx eslint src/app/page.tsx src/app/layout.tsx e2e/smoke.spec.ts`
### T05.2 — PR workspace page (screens 2 + 3): matrix, diff, arm toggle, sabotage, live call
- Files: src/app/pr/[id]/page.tsx, src/components/PrWorkspace.tsx, src/components/PrWorkspace.test.tsx
- Do:
  1. `page.tsx`: `generateStaticParams` from `PR_IDS`; `const { id } = await params` (Next 16: `params` is a Promise and must be awaited), `PrId.safeParse(id)` else `notFound()`; load fixture; pass `pr` and `liveEnabled = readEnv().mode === "live"` (boolean only) to `PrWorkspace`.
  2. `PrWorkspace.tsx` (`"use client"`): `useReducer(reduce, initState(pr))`. Header: title, `Badge`. Arm control: `<fieldset><legend>Reviewer arm</legend>` radio group A–D, labels "A · diff only · P0", "B · diff only · P1", "C · diff + bundle · P0", "D · diff + bundle · P1". Sabotage button (only when `pr.sabotage`): text "Sabotage: silence a test" / "Undo sabotage", `aria-pressed`.
  3. Replay: review comes from state instantly. Live (`liveEnabled`): on arm/sabotage change `fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prId, arm, sabotaged }) })`, `AbortController` 45 s, parse with `ReviewResponse`; on any failure keep the recorded review labelled `FALLBACK — recorded`. Show `aria-busy` on the reviewer column while pending.
  4. One visually-hidden `role="status"` region announcing "Checker: N findings, badge <text>" after each change (not per keystroke).
  5. Render `Matrix` then `DiffView` (sections with headings "Requirement → evidence" and "Diff"). Clicking a finding link scrolls to the anchored diff line.
- Tests: `PrWorkspace.test.tsx` — static render of pr-1: radio group with 4 labelled options, sabotage button with `aria-pressed="false"`, status region present, `RECORDED`/`SAMPLE — hand-authored` label shown; pr-2 has no sabotage button.
- Acceptance: `npx vitest run src/components/PrWorkspace.test.tsx`, `npx eslint "src/app/pr" src/components/PrWorkspace.tsx`
### T05.3 — Eval scoring, results JSON, results page
- Files: src/lib/eval.ts, src/lib/eval.test.ts, scripts/eval.ts, scripts/eval.test.ts, fixtures/eval/results.json, src/app/results/page.tsx
- Do:
  1. `src/lib/eval.ts`: `scoreReview(groundTruth faults, review): { detected: FaultType[]; missed: FaultType[]; falseFlags: number }`. A fault counts as detected when a review flag of the mapped type (`silenced_test`→`silenced_test`, `scope_creep`→`scope`, `unstated_assumption`→`assumption`, `unmapped_requirement`→`unmapped_requirement` or row `unmet`/`unclear` for that `req_id`, `injection`→`injection`) matches file and line within ±3 (line 0 = file-level match). Flags on a PR with no faults count as false flags. `aggregate(cases)` → table `{ faultType → { arm → { detected, total } } }` + `falseFlagRate` per arm.
  2. `scripts/eval.ts`: `npx tsx scripts/eval.ts [--dir fixtures/prs] [--out fixtures/eval/results.json]`; loads each PR via `loadPr`, scores every recorded arm (plus sabotaged variant when present), writes `{ generated_at, dir, cases: number (count of scored PR variants),  sources: {authored, recorded, live}, table, falseFlagRate }`. Validate args with zod. Export `run(args)` for tests.
  3. Generate and commit `fixtures/eval/results.json` from the demo fixtures.
  4. `results/page.tsx`: reads `fixtures/eval/results.json` at build with `fs` (missing file → "No results yet", so parallel builds never break); `<table>` fault type × arm with `detected/total`; caption states case count and source mix, e.g. "Demo set: 4 cases, hand-authored samples — not a benchmark".
- Tests: `eval.test.ts` (each mapping; ±3 tolerance; file-level match; false flags on clean; aggregate totals), `scripts/eval.test.ts` (run on `fixtures/prs` into a temp file; output has all 4 arms; bad `--dir` exits non-zero).
- Acceptance: `npx vitest run src/lib/eval.test.ts scripts/eval.test.ts`, `npx tsx scripts/eval.ts --out /tmp/results-check.json`, `npx eslint src/lib/eval.ts scripts/eval.ts src/app/results`
### T05.4 — Record real reviewer outputs (keyed, run by a human)
- Files: scripts/record-reviews.ts, scripts/record-reviews.test.ts
- Do:
  1. `npx tsx scripts/record-reviews.ts [--dir fixtures/prs] [--pr <id>] [--arm A|B|C|D] [--dry-run]`. For each PR × arm (and sabotaged variant if `sabotage.patch` exists): compute findings, call `liveReview` (from `src/lib/reviewer/index.ts`), write `reviews/<arm>.json` or `reviews-sabotaged/<arm>.json` with `source: "recorded"`, `model`, `recorded_at`.
  2. Exit 2 with a clear message if `ANTHROPIC_API_KEY` is unset (unless `--dry-run`, which prints the planned calls and token-free cost estimate and exits 0).
  3. Sequential calls, stop on first error, never overwrite a file with an invalid result. Export `run(args, deps)` with injectable review function.
- Tests: `scripts/record-reviews.test.ts` — with a fake review fn writes 4 + 4 files into a temp copy of pr-1 with `source: "recorded"`; missing key → exit code 2; `--dry-run` writes nothing; failure leaves existing files unchanged.
- Acceptance: `npx vitest run scripts/record-reviews.test.ts`, `npx tsx scripts/record-reviews.ts --dry-run`, `npx eslint scripts/record-reviews.ts`

## Wave gate
- Commands: `npm run lint && npm run typecheck && npm run test:coverage && npm run build && npx playwright test e2e/smoke.spec.ts && npm run format`
- Review focus: hosted pages work with no env vars; only a boolean `liveEnabled` reaches the client; recorded/authored/fallback labels always visible; keyboard path through list → radio group → sabotage → finding link → diff line; results caption honest about case count and source; record script cannot run without a key and never writes invalid JSON.
