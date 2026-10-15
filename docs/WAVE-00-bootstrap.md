# WAVE-00 — Bootstrap: repo, scaffold, all dependencies, CI
Depends on: none
Human prerequisites: none

## Tasks
### T00.1 — Scaffold Next.js app with every pinned dependency and tool config
- Files: package.json, package-lock.json, .gitignore, .nvmrc, .prettierrc.json, .prettierignore, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, vitest.config.ts, playwright.config.ts, next-env.d.ts, src/app/layout.tsx, src/app/globals.css, src/app/page.tsx, src/lib/env.ts, src/lib/env.test.ts, e2e/smoke.spec.ts
- Do:
  1. `git init -b main` in the project root if `.git` is absent. Do not touch `.claude/` or `docs/`.
  2. Scaffold in a temp dir with `npx create-next-app@16.4.1 tmp-app --typescript --eslint --app --src-dir --tailwind --use-npm --no-turbopack --import-alias "@/*" --yes`, then move its files into the project root (skip its README). If a flag is rejected, drop it and set the equivalent by hand.
  3. Pin exact versions (no `^`) and install: `npm i -E next@16.4.1 react@19.3.1 react-dom@19.3.1 zod@4.6.7 @anthropic-ai/sdk@0.134.0` and `npm i -D -E typescript@6.0.3 @types/node@24.19.2 @types/react@19.3.0 @types/react-dom@19.3.0 tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.30 vitest@5.0.4 @vitest/coverage-v8@5.0.4 @playwright/test@1.64.1 @axe-core/playwright@4.13.0 eslint@10.12.0 eslint-config-next@16.4.1 prettier@3.9.10 tsx@4.23.15`. Do not use typescript 7.x (see PLAN-01 §6).
  4. `package.json`: `"engines": {"node": ">=24"}`, `"private": true`, scripts: `dev`=`next dev`, `build`=`next build`, `start`=`next start`, `lint`=`eslint .`, `typecheck`=`tsc --noEmit`, `test`=`vitest run`, `test:coverage`=`vitest run --coverage`, `e2e`=`playwright test`, `format`=`prettier --check .`, `format:write`=`prettier --write .`, `smoke`=`tsx scripts/smoke.ts`, `check-pr`=`tsx scripts/check-pr.ts`, `eval`=`tsx scripts/eval.ts`.
  5. `.nvmrc` = `24`. `.gitignore` adds `.env*`, `.venv/`, `coverage/`, `playwright-report/`, `test-results/`, `__pycache__/`, `corpus/out*/`. `.prettierrc.json`: `{}`. `.prettierignore`: `docs/`, `.claude/`, `*.md`, `fixtures/**/*.patch`, `fixtures/eval/`, `fixtures/prs/*/reviews*/` (script-generated JSON), `.next/`, `coverage/`, `package-lock.json`.
  6. `eslint.config.mjs`: flat config spreading `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`; ignore `.next/`, `coverage/`, `.claude/`, `.venv/`. Confirm the export names against the eslint-config-next README ([npm](https://www.npmjs.com/package/eslint-config-next)).
  7. `vitest.config.ts`: environment `node`; include `src/**/*.test.{ts,tsx}`, `scripts/**/*.test.ts`, `fixtures/**/*.test.ts`; `@/` alias to `src/`; React automatic JSX runtime for `.tsx` tests; coverage provider `v8`, include `src/lib/**`, `src/components/**`, `src/app/api/**`, `scripts/**`, exclude `**/*.test.*`; `thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }`.
  8. `playwright.config.ts`: testDir `e2e`, chromium only, `webServer: { command: "npm run build && npm run start", url: "http://localhost:3000", env: { REVIEWER_MODE: "replay" }, timeout: 180_000, reuseExistingServer: !process.env.CI }`.
  9. `next.config.ts`: `outputFileTracingIncludes: { "/api/review": ["./fixtures/prs/**/*"] }` so the route can read fixtures on Vercel.
  10. `src/lib/env.ts`: `readEnv(env = process.env)` → `{ mode: "replay" | "live", hasKey: boolean }`; `mode` is `"live"` only when `REVIEWER_MODE === "live"` and `ANTHROPIC_API_KEY` is non-empty; unknown values → `"replay"`. Never return the key itself.
  11. `src/app/page.tsx`: placeholder `<main><h1>Receipts PR Verifier</h1></main>`. `layout.tsx`: `<html lang="en">`, title "Receipts PR Verifier".
  12. `e2e/smoke.spec.ts`: visits `/`, expects heading "Receipts PR Verifier".
  13. `npx playwright install chromium` (no `--with-deps`: it needs sudo. If browser system libs are missing, a human runs `sudo npx playwright install-deps chromium` once, see HUMAN-01).
  14. Last step: `npx prettier --write package.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts playwright.config.ts .prettierrc.json src e2e` (own files only; T00.2 formats its own file).
- Tests: `src/lib/env.test.ts` (replay default; live needs both vars; unknown mode → replay; empty key → replay; result has no key field); `e2e/smoke.spec.ts`.
- Acceptance: `npm ci`, `npx tsc --noEmit`, `npx vitest run src/lib/env.test.ts`, `npm run lint`, `npx playwright test --list e2e/smoke.spec.ts`, `npx prettier --check package.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts playwright.config.ts .prettierrc.json src e2e`, `node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};if(d.typescript!=='6.0.3'||d.next!=='16.4.1')process.exit(1)"`
### T00.2 — CI workflow
- Files: .github/workflows/ci.yml
- Do:
  1. Trigger on `push` to `main` and `pull_request`. `permissions: contents: read`.
  2. One job `web` on `ubuntu-latest`: `actions/checkout@v7`; `actions/setup-node@v7` with `node-version-file: .nvmrc` and `cache: npm`; `npm ci`; `npm run lint`; `npm run typecheck`; `npm run test:coverage`; `npx playwright install --with-deps chromium`; `npm run e2e`; upload `playwright-report/` with `actions/upload-artifact@v7` ([releases](https://github.com/actions/upload-artifact/releases/latest)) on failure.
  3. No secrets. No `pull_request_target`.
- Tests: none (config only); validated by the acceptance commands.
- Acceptance: `node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8');for(const k of ['actions/checkout@v7','actions/setup-node@v7','npm run test:coverage','npm run e2e','npm run lint','npm run typecheck'])if(!s.includes(k))process.exit(1);if(s.includes('pull_request_target'))process.exit(1)"`

## Wave gate
- Commands: `npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run e2e && npm run format`
- Review focus: exact pins match AGENT.md (no `^`, typescript 6.0.3); `npx tsc --noEmit` passes with Next 16; coverage thresholds set to 80 in vitest config; `.env*` ignored; `env.ts` never exposes the key; CI has no secrets and no `pull_request_target`; `.claude/` and `docs/` untouched.
