# HANDOFF-04 (WAVE-04 api-and-components, @3464e78)

## What now exists
- `src/lib/reviewer/index.ts`: `review(...)`, `liveReview(deps)`, type `FallbackReason`, `ReviewDeps`.
- `src/app/api/review/route.ts`: `POST /api/review` (dynamic), `maxDuration = 60`.
  Strict ReviewRequest parse (static 400, no echo); 415/413/429 + Retry-After.
  Fallback is always source/mode "fallback" with a mapped reason.
- `src/lib/workspace.ts`: `Mode`, `State`, `Action`, `effectiveDiff`, `initState`, `reduce`.
- `src/components/`: `Badge`, `DiffView`, `Matrix` (+ `anchorId`, `MatrixProps`), `PrList` (+ `PrListItem`), each with tests.
- Commands: `npm run lint|typecheck|test:coverage|build|format` all exit 0.
  239/239 tests, 23 files; lines 96.79%, branches 86.91%.

## Deviations from the plan
- T04.1: `runtime = "nodejs"` dropped (default with cacheComponents: true).
- T04.2-T04.4: red phase not re-run; code existed from an interrupted run. T04.4 added a table caption (gate focus).
- T04.5: tests and impl written together (no red run). `State.prId` is string (FixturePr.id is string).
  `setArm` and `liveResult` reset mode to replay; `setArm` also discards the live result.
  Added `Mode` and `Action` type aliases.

## Known warnings (lint, 0 errors, 3 warnings)
- src/components/Badge.test.tsx:22 unused `_text`.
- visuals/anatomy/build.mjs:32-33 unused SLIP_W/SLIP_D.
- route.ts:16 per-instance rate limiter is a deliberate shortcut; missing `ponytail:` tag (AGENT.md convention 7).
- route.ts:58 and liveReview (reviewer/index.ts:38) both compute effectiveDiff. Harmless.

## Next wave must know
- visuals/ (1.3 MB, outside WAVE-04 scope) got committed in 3464e78. Untrack it or add to .gitignore and eslint ignores.
- Anchor id `L-<encodeURIComponent(file)>-<n|o><line>` is duplicated by design in Matrix.tsx:18 and DiffView.tsx:182. Change both together.
- Diff text is rendered as React children (escaped); keep it that way.
- Logs carry only err.name or reason+prId, never the key.
