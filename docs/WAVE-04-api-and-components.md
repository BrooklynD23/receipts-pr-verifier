# WAVE-04 — review() + API route, UI components, workspace state
Depends on: WAVE-03
Human prerequisites: none

## Tasks
### T04.1 — review() with fallback chain and POST /api/review
- Files: src/lib/reviewer/index.ts, src/lib/reviewer/index.test.ts, src/app/api/review/route.ts, src/app/api/review/route.test.ts
- Do:
  0. Context for every task in this wave: Component tests render with `renderToStaticMarkup` from `react-dom/server` (node environment, no jsdom). Interaction is covered by Playwright in WAVE-08. UI copy and states follow [MV3 §7](../../../AI/frontier-ai-autonomy-2026-10/frontier-ai-autonomy-2026-10/mvp/MV3-receipts-pr-verifier.md) and the a11y rules in [A18](../../../AI/loop-research/scratchpads/A18-ui-ux.md).
  1. `index.ts`: `liveReview(deps)(input)` = `buildPrompt` → `callClaude(client, PRIMARY_MODEL)`; on `ReviewerError` retry once with `CHEAP_MODEL`; result gets `arm`, `model`, `source: "live"`, `recorded_at: new Date().toISOString()`.
  2. `review(input, deps = { env: readEnv(), client: lazy createClient(), replay: replayReview })` → `{ result, mode, fallbackReason? }`. Replay mode → `mode: "replay"`. Live mode → try `liveReview`; on any failure return the recorded review with `source: "fallback"`, `mode: "fallback"`, mapped `fallbackReason`. Log `console.error` with reason and prId only.
  3. `route.ts`: `export const runtime = "nodejs"`, `export const maxDuration = 60`. `POST`: reject non-`application/json` with 415; body > 1 KB → 413; `ReviewRequest.safeParse` → 400 `{ error: "invalid request" }` (no echo of input); module-level `createRateLimiter({ limit: 10, windowMs: 60_000 })` keyed by `clientIp(req.headers)` → 429 with `Retry-After`; load fixture via `loadDemoPr(prId)`; effective diff = diff (+ `"\n" + sabotage.patch` if `sabotaged`); `findings = check(...)`; call `review`; return `ReviewResponse` JSON. Unexpected error → 500 `{ error: "internal error" }`. Only `POST` exported.
  4. Deps are injectable via function params for tests; no module mocking of the SDK needed.
- Tests: `index.test.ts` — replay mode never touches the client; live success → `source: "live"`; primary fails + cheap succeeds → cheap model in result; both fail → `mode: "fallback"`, `source: "fallback"`, reason mapped; no key → `no_key` path. `route.test.ts` (call the exported `POST` with `new Request(...)`) — 200 replay for each pr; 400 for extra key, unknown prId, sabotage on pr-2, malformed JSON; 415 wrong content type; 413 oversize; 429 after 10 calls from one IP with `Retry-After`; response body validates with `ReviewResponse`.
- Acceptance: `npx vitest run src/lib/reviewer/index.test.ts src/app/api/review/route.test.ts`, `npx eslint src/lib/reviewer/index.ts src/app/api/review`
### T04.2 — Badge and PR list components
- Files: src/components/Badge.tsx, src/components/Badge.test.tsx, src/components/PrList.tsx, src/components/PrList.test.tsx
- Do:
  1. `Badge({ badge })`: pill with text `Clean` / `Flags` / `Missing evidence`, icon glyph + text (not color alone), `aria-label="Status: <text>"`, Tailwind colors meeting 4.5:1 (e.g. `bg-green-100 text-green-900`, `bg-red-100 text-red-900`, `bg-amber-100 text-amber-900`).
  2. `PrList({ items: { id, title, badge, findingCount }[] })`: `<ul>` of links to `/pr/<id>` with title, badge, finding count; empty state text "No PRs".
- Tests: `Badge.test.tsx` — each badge renders text and aria-label; `PrList.test.tsx` — 3 items render 3 links with correct hrefs; empty state.
- Acceptance: `npx vitest run src/components/Badge.test.tsx src/components/PrList.test.tsx`, `npx eslint src/components/Badge.tsx src/components/PrList.tsx`
### T04.3 — Requirement→evidence matrix with checker findings panel
- Files: src/components/Matrix.tsx, src/components/Matrix.test.tsx
- Do:
  1. `Matrix({ requirements, review, findings, sourceLabel })`: `<table>` with `<caption>`, `<th scope="col">` headers: Requirement, Reviewer status, Evidence (links `#L-<file>-n<line>`), Checker. Rows for each bundle requirement; requirement with an `unmapped_requirement` finding shows "Missing evidence".
  2. Findings panel: list of checker findings, each with severity text (`Red flag` / `Amber`), rule, message, and a link to its diff anchor (`#L-<encodeURIComponent(file)>-<n|o><line>`).
  3. Reviewer flags list and verdict; show `sourceLabel` (e.g. `RECORDED`, `FALLBACK — recorded`) as a visible tag next to the reviewer column header.
  4. Export `anchorId(file, side, line)` and use it everywhere (DiffView imports the same shape string; keep format documented in a comment).
- Tests: `Matrix.test.tsx` — rows per requirement; missing-evidence row; finding links use `anchorId`; label text rendered; table has caption and scoped headers; empty findings → "No checker findings".
- Acceptance: `npx vitest run src/components/Matrix.test.tsx`, `npx eslint src/components/Matrix.tsx`
### T04.4 — Diff view with line-anchored flags
- Files: src/components/DiffView.tsx, src/components/DiffView.test.tsx
- Do:
  1. `DiffView({ files: DiffFile[], findings })`: per file a heading + `<table>` of lines (old no., new no., `+`/`-`/space, text). Text rendered as React children only (no `dangerouslySetInnerHTML`).
  2. Each line row gets `id` = `L-<encodeURIComponent(path)>-n<newLine>` for add/ctx and `L-<…>-o<oldLine>` for del (same format as `anchorId` in T04.3; do not import Matrix to keep files disjoint — duplicate the 1-line helper with a comment).
  3. Lines with a finding: highlighted row, `aria-describedby` pointing to an inline note with the finding message, `:target` style for scroll-to highlight.
  4. Binary files show "Binary file not shown".
- Tests: `DiffView.test.tsx` — row ids for add/del/ctx; flagged row has the note and `aria-describedby`; `<script>` text in a diff line is escaped in output; binary placeholder.
- Acceptance: `npx vitest run src/components/DiffView.test.tsx`, `npx eslint src/components/DiffView.tsx`
### T04.5 — Workspace reducer (arm, sabotage, findings, review)
- Files: src/lib/workspace.ts, src/lib/workspace.test.ts
- Do:
  1. `State = { prId; arm: Arm; sabotaged: boolean; diff: string; findings: CheckerFinding[]; badge: Badge; review: ReviewResult | null; mode: "replay" | "live" | "fallback"; pending: boolean }`.
  2. `initState(pr: FixturePr, arm = "D")` runs `check` on the base diff and picks the recorded review.
  3. `reduce(state, action, pr)` (pure, returns new state) for actions: `setArm`, `toggleSabotage` (only when `pr.sabotage` exists: effective diff = `pr.diff + "\n" + pr.sabotage.patch`, re-run `check`, swap to sabotaged recorded review), `liveStarted`, `liveResult({ result, mode })`.
  4. Export `effectiveDiff(pr, sabotaged)`.
- Tests: `workspace.test.ts` — init on pr-1 → badge clean; toggleSabotage → `new_skip_marker` at line 88, badge flags, review from `reviews-sabotaged`; toggling back restores; setArm A vs D swaps review; toggleSabotage on pr-2 is a no-op; state objects never mutated (freeze input and assert).
- Acceptance: `npx vitest run src/lib/workspace.test.ts`, `npx eslint src/lib/workspace.ts`

## Wave gate
- Commands: `npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run format`
- Review focus: route accepts only `{prId, arm, sabotaged}` (strict), returns generic errors, never logs or returns the key; rate limit + 413/415 guards present; fallback always yields a labelled recorded result; components escape diff text; badges not color-only; table semantics (caption, scope); anchor id format identical in Matrix and DiffView.
