# WAVE-01 — Shared contracts: zod schemas, diff parser, rate limiter
Depends on: WAVE-00
Human prerequisites: none

## Tasks
### T01.1 — Zod schemas for every data contract
- Files: src/lib/schemas.ts, src/lib/schemas.test.ts
- Do:
  1. Copy the schemas from [PLAN-01 §2](PLAN-01-architecture.md#2-data-contracts-srclibschemasts) verbatim into `src/lib/schemas.ts`; export each schema and its inferred type (`export type Bundle = z.infer<typeof Bundle>` etc.).
  2. Keep `ReviewOutput` free of `.int()`, `.min()`, `.regex()` and refinements so it converts cleanly to a structured-output JSON schema.
  3. Add `labelFor(source)` → `"LIVE" | "RECORDED" | "SAMPLE — hand-authored" | "FALLBACK — recorded"`.
- Tests: `src/lib/schemas.test.ts` — valid Bundle parses; Bundle with `../` path fails; `ReviewRequest` rejects extra keys, unknown `prId`, `sabotaged: true` with `pr-2`; `ReviewResult` rejects unknown `source`; `GroundTruth` with `sabotaged` block parses; `labelFor` covers all 4 sources.
- Acceptance: `npx vitest run src/lib/schemas.test.ts`, `npx eslint src/lib/schemas.ts src/lib/schemas.test.ts`
### T01.2 — Hand-written unified diff parser
- Files: src/lib/diff.ts, src/lib/diff.test.ts
- Do:
  1. Export types `DiffLine = { kind: "add" | "del" | "ctx"; text: string; oldLine?: number; newLine?: number }`, `Hunk = { oldStart: number; newStart: number; lines: DiffLine[] }`, `DiffFile = { path: string; oldPath: string | null; binary: boolean; hunks: Hunk[] }`.
  2. Export `parseDiff(text: string): DiffFile[]`. Handle: `diff --git a/x b/y`, `--- /dev/null` (new file, `oldPath: null`), `+++ /dev/null` (deleted file, path = old path), `@@ -a[,b] +c[,d] @@ ...`, `\ No newline at end of file` (skip), `Binary files ... differ` (`binary: true`), CRLF input, several `diff --git` blocks for the same path (keep as separate entries). Strip `a/` and `b/` prefixes.
  3. Export `addedLines(files): Map<string, Set<number>>` (path → new-file line numbers of `add` lines).
  4. Target ≤ 60 lines of logic. Add `// ponytail: hand parser; switch to parse-diff 0.12.0 if renames/combined diffs appear` above `parseDiff`.
  5. Pure: never mutate the input; return new arrays.
- Tests: `src/lib/diff.test.ts` — single hunk add/del line numbers; multi-hunk; new file; deleted file; binary; no-newline marker; CRLF; two blocks for one path; `addedLines` result; empty string → `[]`.
- Acceptance: `npx vitest run src/lib/diff.test.ts`, `npx eslint src/lib/diff.ts src/lib/diff.test.ts`
### T01.3 — In-memory per-IP rate limiter
- Files: src/lib/rate-limit.ts, src/lib/rate-limit.test.ts
- Do:
  1. Export `createRateLimiter({ limit, windowMs, now = Date.now })` → `{ check(key: string): { ok: true } | { ok: false; retryAfterSec: number } }`. Fixed window, `Map<string, { start: number; count: number }>`.
  2. Evict expired entries on each call when the map exceeds 10,000 keys (bounded memory).
  3. Export `clientIp(headers: Headers): string` → first comma-separated value of `x-forwarded-for`, trimmed, else `"unknown"`.
  4. Comment: `// ponytail: per-instance Map, resets on cold start; Vercel WAF rule (HUMAN-04) is the real limit`.
- Tests: `src/lib/rate-limit.test.ts` — allows `limit` calls then blocks; `retryAfterSec` > 0 and ≤ window; resets after window (fake `now`); keys independent; eviction keeps size bounded; `clientIp` parses `"1.2.3.4, 5.6.7.8"` and missing header.
- Acceptance: `npx vitest run src/lib/rate-limit.test.ts`, `npx eslint src/lib/rate-limit.ts src/lib/rate-limit.test.ts`

## Wave gate
- Commands: `npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run format`
- Review focus: schemas match PLAN-01 §2 exactly (names, enums, allowlist); `ReviewRequest` is `.strict()`; path schema blocks `..`; diff parser line numbers correct for multi-hunk and new files; no mutation; limiter memory bounded; coverage ≥ 80%.
