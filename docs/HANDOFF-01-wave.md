# HANDOFF — WAVE-01 → WAVE-02

## What exists (`src/lib/`)
- `schemas.ts` — all 14 zod schemas verbatim from PLAN-01 §2 + inferred types + `Source`/`SourceLabel` + `labelFor` → "LIVE" | "RECORDED" | "SAMPLE — hand-authored" | "FALLBACK — recorded" (em dashes). `ReviewRequest` strict + sabotage→pr-1 refine; `Path` blocks `..`; `ReviewOutput` free of .int/.min/.regex/refine (structured-output safe).
- `diff.ts` — `DiffLine/Hunk/DiffFile` types, `parseDiff` (~40 lines, ponytail comment), `addedLines` → Map<path, Set<newLine>>. Handles new/deleted/binary/CRLF/no-newline marker/repeat blocks.
- `rate-limit.ts` — `createRateLimiter({limit, windowMs, now})` → `{check, size}`; fixed-window Map, evict-expired when >10k; `clientIp` first XFF else "unknown"; ponytail comment re Vercel WAF.

## Deviations
- `size()` on limiter return — test aid, superset of spec.
- Malformed `@@` header attaches following lines to previous hunk (spec's ponytail upgrade: parse-diff 0.12.0).

## Warnings
- `export PATH=/home/danny/.nvm/versions/node/v24.22.0/bin:$PATH` before node/npm. Coverage 100% stmts — keep it ≥80.
- Gate runs `npm run format` — `npx prettier --write` your files before finishing.

## For WAVE-02 (fixtures + checker)
- Fixture diffs must parse through `parseDiff` and `addedLines` — test through them, not around them. Checker consumes `schemas.ts` types directly (GroundTruth, FindingRule enums, ReviewRequest.sabotaged).
