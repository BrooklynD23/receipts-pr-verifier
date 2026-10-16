# HANDOFF WAVE-08 (E2E demo, security headers, smoke, release review)
Commit: 6485254

## What now exists
- `src/lib/security-headers.ts`: `securityHeaders(isProd): Header[]` (CSP + headers); test in `security-headers.test.ts`.
- `next.config.ts`: `headers()` on `/(.*)` using securityHeaders, `poweredByHeader: false`, keeps `outputFileTracingIncludes` for `/api/review`.
- `scripts/smoke.ts`: `run(...)` hosted smoke, 5 checks; reuses `ReviewResponse` from `src/lib/schemas.ts`. Test: `scripts/smoke.test.ts` (60s timeout).
- `e2e/demo.spec.ts`, `e2e/a11y.spec.ts` (3 axe specs), `e2e/smoke.spec.ts`: 7 Playwright specs total.
- Commands: `npm run smoke` (set `DEMO_URL`), `npm run e2e`, `npm run test:coverage`, `npm run build`, `npm run start`.
- Gate: ci/lint/typecheck/coverage (89.1 stmts, 84.39 branches, 88.48 funcs, 90.61 lines)/build/e2e 7 of 7/format/smoke 5 of 5, all exit 0.

## Deviations
- T08.2: new CLI test timeout raised 30s -> 60s. Cold `npx tsx` on WSL took ~40s; first run failed at 30s, second passed warm. Timeout as cause not re-verified by rerunning the failing case.
- T08.3: none.

## Known warnings
1. No test checks CSP/headers on live responses. Later: add `res.headers.get('content-security-policy')` to smoke GET / check.
2. `e2e/demo.spec.ts:88` calls `.focus()` on checked radio before Tab, so it does not prove Tab reaches sabotage from page top.
3. Release secret grep `sk-ant-|ghp_|github_pat_` is not empty: placeholders (README.md:20, docs/HUMAN-03:16) and test fakes (env.test.ts, reviewer/anthropic.test.ts:112, reviewer/index.test.ts:278). Nothing real.

## Next wave must know
- README.md:7 demo placeholder links to HUMAN-02 (required, human fills it).
- Smoke needs a running server: start with `npm run start`, then `DEMO_URL=http://localhost:3000 npm run smoke`.
- Cold tsx on WSL is slow; keep generous timeouts on CLI tests.
