# HANDOFF — WAVE-00 → WAVE-01

## What exists
- Next.js 16.4.1 app (App Router, src dir): `src/app/{layout,page}.tsx`, `globals.css`, placeholder h1 "Receipts PR Verifier". `next.config.ts` has `outputFileTracingIncludes` for `/api/review` fixtures.
- `src/lib/env.ts`: `readEnv(env?) -> {mode: "replay"|"live", hasKey}` — live only when `REVIEWER_MODE==="live"` AND `ANTHROPIC_API_KEY` non-empty; never returns the key.
- Tooling: typescript 6.0.3 (NOT 7.x), vitest 5.0.4 + coverage thresholds 80 (src/lib, src/components, src/app/api, scripts), eslint flat (next core-web-vitals + typescript), prettier, playwright (chromium, webServer `npm run build && npm run start` on :3000, REVIEWER_MODE=replay).
- `e2e/smoke.spec.ts` + `use.baseURL` set (added at gate fix — keep it).
- `.github/workflows/ci.yml`: web job (checkout@v7, setup-node@v7 + .nvmrc + npm cache, ci→lint→typecheck→coverage→playwright install --with-deps→e2e, upload-artifact on failure). `permissions: contents: read`, no secrets.
- `git` initialized; first commit `04995e2`.

## Deviations
- `env.ts` param is `Record<string, string | undefined>` (not ProcessEnv — @types/node@24 makes NODE_ENV required, breaking `{}` test literals).
- vitest uses `oxc.jsx.runtime:"automatic"` (vitest 5 transforms via oxc, ignores esbuild options).
- Tailwind wired via `postcss.config.mjs` + `@tailwindcss/postcss` (spec pin); CNA's turbopack CSS rule/dep dropped. CNA `cacheComponents`/`partialPrefetching` flags kept.
- `.gitignore` keeps `next-env.d.ts` entry (Next regenerates it; file exists on disk).

## Warnings
- Default `node` is v26 / `npm` v11 under it — WRONG. Always `export PATH=/home/danny/.nvm/versions/node/v24.22.0/bin:$PATH` first (node v24.22.0, npm 11.19.1).
- /mnt/c very slow: `npm ci` ~13-32 min cold; playwright build+start inside e2e takes minutes — never kill, wait.
- npm blocked `esbuild`/`unrs-resolver` postinstall scripts (allowScripts); everything verified working; if binary resolution breaks later → `npm install-scripts approve`.
- `npm audit`: 5 high transitive vulns via eslint-config-next chain — pinned toolchain, accepted.
- A sibling project's agent pkilled `next build` once; if artifacts look stale, rebuild.

## For WAVE-01 (contracts)
- zod schemas live in `src/lib/schemas.ts` — every boundary input parses through them (HTTP body, fixtures, LLM output, CLI args). `npx prettier --write <files>` before finishing; wave gate runs `npm run format`.
