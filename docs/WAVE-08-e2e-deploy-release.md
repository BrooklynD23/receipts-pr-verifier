# WAVE-08 — E2E demo flow, security headers, hosted smoke script, release review
Depends on: WAVE-05
Human prerequisites: none

## Tasks
### T08.1 — Playwright E2E on the 3-minute demo flow + axe
- Files: e2e/demo.spec.ts, e2e/a11y.spec.ts
- Do:
  0. Context for every task in this wave: E2E runs against local `next start` in replay mode (Playwright `webServer` from WAVE-00), so this wave passes with no accounts or keys. The hosted URL check is the verification step of [HUMAN-02](HUMAN-02-vercel-deploy.md): `DEMO_URL=https://<app>.vercel.app npm run smoke`.
  1. `demo.spec.ts` follows [PLAN-00 §3](PLAN-00-overview.md#3-audience-demo-script-300) beats: list shows 3 badges (Clean/Flags/Missing evidence) → open pr-1, matrix rows all met, label `SAMPLE — hand-authored` or `RECORDED` visible → click "Sabotage: silence a test", measure click→visible flag `new_skip_marker` with `tests/test_specifiers.py` and `88`; assert < 1,000 ms; badge becomes Flags → click the finding link, URL hash is the line anchor and the row is visible → select arm A: no `silenced_test` reviewer flag, verdict approve; select arm D: flag present → open pr-2: checker shows `injection_text`; arm D reviewer flag `injection`, verdict request changes → open pr-3: "Missing evidence" for R2 and an `out_of_scope` finding → `/results` table visible with caption.
  2. Keyboard-only variant: Tab to sabotage button, Space activates, Tab to arm radios, arrow keys switch arm.
  3. `a11y.spec.ts`: `AxeBuilder` on `/`, `/pr/pr-1` (before and after sabotage), `/results`; assert zero violations with impact `serious` or `critical`.
- Tests: the two spec files themselves.
- Acceptance: `npx playwright test --list e2e/demo.spec.ts e2e/a11y.spec.ts`, `npx eslint e2e`
### T08.2 — Hosted smoke script
- Files: scripts/smoke.ts, scripts/smoke.test.ts
- Do:
  1. `npm run smoke` reads `DEMO_URL` (zod: `https://` URL, or `http://localhost:<port>` for local runs). Missing → exit 2 with "set DEMO_URL".
  2. Checks with `fetch` (10 s timeout each): `GET /` 200 and HTML contains `Receipts PR Verifier` and `pr-1`; `GET /pr/pr-1` 200; `GET /results` 200; `POST /api/review` with `{"prId":"pr-1","arm":"D","sabotaged":false}` → 200 and body validates with `ReviewResponse` (replay or fallback both fine); `POST` with `{"prId":"../etc"}` → 400.
  3. Print one line per check (`PASS`/`FAIL`), exit 1 on any failure. Export `run(env, fetchImpl)`.
- Tests: `smoke.test.ts` with a fake fetch — all pass → 0; one 500 → 1; missing URL → 2; non-https remote URL rejected.
- Acceptance: `npx vitest run scripts/smoke.test.ts`, `npx eslint scripts/smoke.ts`
### T08.3 — Security headers
- Files: next.config.ts, src/lib/security-headers.ts, src/lib/security-headers.test.ts
- Do:
  1. `securityHeaders(isProd: boolean)` → array of `{ key, value }`: `Content-Security-Policy` (prod: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`; dev adds `'unsafe-eval'` to script-src), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  2. `next.config.ts`: keep `outputFileTracingIncludes`; add `async headers()` returning the list for `source: "/(.*)"`; `poweredByHeader: false`.
  3. Comment: `// ponytail: 'unsafe-inline' scripts for Next hydration; move to nonce-based CSP if a third-party script is ever added`.
- Tests: `security-headers.test.ts` — prod CSP has no `unsafe-eval`, has `frame-ancestors 'none'`; dev has `unsafe-eval`; all 4 headers present.
- Acceptance: `npx vitest run src/lib/security-headers.test.ts`, `npx eslint next.config.ts src/lib/security-headers.ts`

## Wave gate
- Commands: `npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run e2e && npm run format && DEMO_URL=http://localhost:3000 sh -c 'npm run start & pid=$!; sleep 8; npm run smoke; code=$?; kill $pid; exit $code'`
- Review focus (release): hosted demo needs zero keys (all beats pass in replay); live mode documented in HUMAN-03/04 and falls back with a label; no secrets in repo (`git grep -nE "sk-ant-|ghp_|github_pat_"` returns nothing); every public endpoint validated + rate limited; CSP and headers present on responses; coverage ≥ 80%; axe clean; README demo link placeholder points to HUMAN-02; STATUS.md updated.
