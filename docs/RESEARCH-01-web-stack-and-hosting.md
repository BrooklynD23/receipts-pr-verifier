# RESEARCH-01: Web stack and hosting

Checked 2026-10-14. Every row links to its source. `[U]` = unverified.

## 1. Runtime

| Item | Version | Install / note | Source |
|---|---|---|---|
| Node.js Active LTS | v24.22.0 (LTS, support ends 20 Oct 2026 per endoflife) | Install Node 24 via nvm/fnm or nodejs.org. Use `"engines": {"node": ">=24"}` | [nodejs.org releases](https://nodejs.org/en/about/releases), [endoflife.date](https://endoflife.date/nodejs) |
| Node.js Current | v26.12.0, labelled Upcoming LTS by endoflife | Do not pin for MVP. Expect it to enter LTS later | [endoflife.date](https://endoflife.date/nodejs) |
| npm | Ships with Node 24. Exact version `[U]` | `npm -v` after install | [npm docs](https://docs.npmjs.com/) `[U]` |

Decision: pin Node 24 LTS. Do not use Node 22, which is in maintenance per endoflife (security support to 30 Apr 2027).

## 2. Framework

| Package | Latest stable | Install | Source |
|---|---|---|---|
| next (App Router) | 16.4.1 (MIT) | `npx create-next-app@latest receipts-pr-verifier --typescript --eslint --app` | [npm next](https://www.npmjs.com/package/next), [Tailwind Next guide](https://tailwindcss.com/docs/guides/nextjs) |
| react + react-dom | 19.3.1 (MIT) | Installed by create-next-app. Pin only if needed: `npm i react@19 react-dom@19` | [npm react](https://www.npmjs.com/package/react) |
| typescript | 7.0.2 (Apache-2.0) | `npm i -D typescript@7`. Confirm Next 16.4.1 supports TS 7 `[U]`. If not, use the TS version create-next-app installs | [npm typescript](https://www.npmjs.com/package/typescript) |

## 3. Tailwind CSS v4 with Next.js

Targets Tailwind v4.3 per the guide. npm `tailwindcss` latest is 4.3.3 (MIT).

| Step | Command or file | Source |
|---|---|---|
| 1. Install | `npm install tailwindcss @tailwindcss/postcss postcss` | [Tailwind Next guide](https://tailwindcss.com/docs/guides/nextjs) |
| 2. PostCSS config | `postcss.config.mjs`: `const config = { plugins: { "@tailwindcss/postcss": {} } }; export default config;` | [Tailwind Next guide](https://tailwindcss.com/docs/guides/nextjs) |
| 3. CSS entry | `app/globals.css`: `@import "tailwindcss";` | [Tailwind Next guide](https://tailwindcss.com/docs/guides/nextjs) |
| 4. Run | `npm run dev` | [Tailwind Next guide](https://tailwindcss.com/docs/guides/nextjs) |

No `tailwind.config.js` is needed for v4 defaults. npm: [tailwindcss](https://www.npmjs.com/package/tailwindcss).

## 4. Tests

| Package | Latest stable | Install | Source |
|---|---|---|---|
| vitest | 5.0.4 (MIT). Engines `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | `npm i -D vitest@5` | [npm vitest](https://www.npmjs.com/package/vitest) |
| @vitest/coverage-v8 | 5.0.4 (MIT) | `npm i -D @vitest/coverage-v8@5` | [npm @vitest/coverage-v8](https://www.npmjs.com/package/@vitest/coverage-v8) |
| @playwright/test | 1.64.1 (Apache-2.0) | `npm i -D @playwright/test@1.64.1` | [npm @playwright/test](https://www.npmjs.com/package/@playwright/test) |
| Playwright Chromium | n/a | `npx playwright install --with-deps chromium` | [Playwright browsers](https://playwright.dev/docs/browsers) |

Playwright docs do not state a Node version. Use Node 24 per section 1.

## 5. Lint and format

| Package | Latest stable | Install | Source |
|---|---|---|---|
| eslint | 10.12.0 (MIT). Engines `^20.19.0 \|\| ^22.13.0 \|\| >=24` | `npm i -D eslint@10` | [npm eslint](https://www.npmjs.com/package/eslint) |
| eslint-config-next | 16.4.1 (MIT). Peers: eslint >=9, typescript optional | `npm i -D eslint-config-next@16` | [npm eslint-config-next](https://www.npmjs.com/package/eslint-config-next) |
| prettier | 3.9.10 (MIT) | `npm i -D prettier@3` | [npm prettier](https://www.npmjs.com/package/prettier) |

Flat config: create `eslint.config.mjs` with `eslint-config-next` exports. Exact flat-config snippet `[U]`, check the eslint-config-next README.

## 6. Validation and Anthropic SDK

| Package | Latest stable | Install | Source |
|---|---|---|---|
| zod | 4.6.7 (MIT) | `npm i zod` | [npm zod](https://www.npmjs.com/package/zod) |
| @anthropic-ai/sdk | 0.134.0 (MIT). Supports Node 20 LTS+. Peer `zod ^3.25.0 \|\| ^4.0.0` (optional) | `npm i @anthropic-ai/sdk` | [npm @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk), [SDK docs](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript) |

Structured output, confirmed in docs:

```ts
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const response = await client.messages.parse({
  model: "claude-sonnet-5-5",          // or claude-haiku-5-5
  max_tokens: 1024,
  messages: [{ role: "user", content: "..." }],
  output_config: { format: zodOutputFormat(ReviewSchema) },
});
response.parsed_output;                // typed from the zod schema
```

Source: [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Docs name no minimum SDK or zod version `[U]`. Pin `@anthropic-ai/sdk@0.134.0` and test the helper once. The SDK page itself does not show `zodOutputFormat`.

## 7. Unified-diff parser

| Option | Version / license | Weekly downloads | Last publish | Source |
|---|---|---|---|---|
| parse-diff | 0.12.0 / MIT | ~1,555,000 | ~2026-04 (inferred from build metadata `[U]`) | [npm parse-diff](https://www.npmjs.com/package/parse-diff) |
| gitdiff-parser | 0.3.1 / MIT | ~349,000 | ~2023-03 (inferred `[U]`, looks stale) | [npm gitdiff-parser](https://www.npmjs.com/package/gitdiff-parser) |
| Hand parser | n/a | n/a | n/a | ~40 lines, no dep |

Decision: write the ~40-line hand parser with tests. It has zero dependencies and the checker needs only file path, added/removed lines, and hunk line numbers. Switch to `parse-diff` 0.12.0 if you hit rename, binary, or no-newline edge cases.

## 8. Anthropic models and pricing

Source for all rows: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) and [Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

| Model | API ID (confirmed) | Input $/MTok | Output $/MTok | Cache read $/MTok | Notes |
|---|---|---|---|---|---|
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2 | $10 | $0.10 | Default effort `high`. Retirement not sooner than 28 Sep 2027 |
| Claude Haiku 5.5 | `claude-haiku-5-5` | $0.10 (≤100k prompt tokens) / $0.50 (>100k) | $0.50 / $2.50 | $0.01 / $0.05 | Default effort `medium`. Retirement not sooner than 7 Oct 2027 |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 | $20 | $0.20 | Reference only |

Batch API is 50% off. Both IDs are confirmed, so no `[U]` needed for these.

## 9. Vercel Hobby

| Limit | Hobby value | Source |
|---|---|---|
| Function max duration | 300 s default and max | [Vercel limits](https://vercel.com/docs/limits) |
| Function memory / CPU | 2 GB / 1 vCPU | [Vercel limits](https://vercel.com/docs/limits) |
| Function invocations | 1,000,000 included | [Hobby plan](https://vercel.com/docs/plans/hobby) |
| Fast Data Transfer (bandwidth) | 100 GB included | [Hobby plan](https://vercel.com/docs/plans/hobby) |
| Fast Origin Transfer | 10 GB included | [Hobby plan](https://vercel.com/docs/plans/hobby) |
| Active CPU / Provisioned memory | 4 CPU-hrs / 360 GB-hrs | [Hobby plan](https://vercel.com/docs/plans/hobby) |
| Deployments per day | 100 | [Vercel limits](https://vercel.com/docs/limits) |
| Build time per deployment | 45 min | [Vercel limits](https://vercel.com/docs/limits) |
| Commercial use | Non-commercial, personal use only | [Hobby plan](https://vercel.com/docs/plans/hobby), [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage) |

Commercial rule: a public portfolio or demo MVP is fine. Commercial use requires Pro at $20 per developer seat per month, per [Hobby plan](https://vercel.com/docs/plans/hobby).

Env var setup: [Vercel environment variables](https://vercel.com/docs/environment-variables) `[U]`, not fetched. Use the Vercel dashboard Project → Settings → Environment Variables, or `vercel env add ANTHROPIC_API_KEY`.

## 10. Hosting alternatives

| Platform | Free-tier fit for this MVP | Source |
|---|---|---|
| Cloudflare Workers (free) | Next.js via OpenNext `[U]`. Limits: 100,000 requests/day, 10 ms CPU per request, 50 subrequests per invocation. Good fit for a small route handler plus static JSON | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Cloudflare Pages (free) | Static-first. Route handlers need Workers `[U]`. Allowances not verified | [Pages docs](https://developers.cloudflare.com/pages/) `[U]` |
| Netlify (free) | Next.js runtime supported. Free limits not verified `[U]` | [Netlify pricing](https://www.netlify.com/pricing/) `[U]` |
| GitHub Pages | Static only. No route handler, so the Anthropic call cannot run there | [GitHub Pages docs](https://docs.github.com/en/pages) `[U]` |
| Render (free web service) | Works for Node server, but spins down after 15 min idle, cold start about 1 min. 750 free instance hours per workspace per month | [Render free](https://render.com/docs/free) |

Pick: Vercel Hobby. It is the native Next.js host, and the MVP is non-commercial. Fall back to Cloudflare Workers if you need a stricter zero-cost ceiling.

## 11. Rate limiting one public POST endpoint

| Option | Adds a DB? | Works across instances? | Limits | Source |
|---|---|---|---|---|
| In-memory limiter per instance | No | No. Each Vercel instance has its own counter, reset on cold start | none | n/a |
| Vercel WAF Rate Limiting rule | No (no code) | Yes, enforced at the edge | Hobby: 1 rate-limit rule per project, fixed window, 10 s to 10 min window, 1,000,000 allowed requests included. Up to 3 custom firewall rules on Hobby | [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Hobby plan](https://vercel.com/docs/plans/hobby) |
| Upstash Ratelimit | Yes, needs Upstash Redis | Yes | Free: 500K commands/month, 250 MB storage (pricing table; FAQ conflicts on DB count). `@upstash/ratelimit` 2.2.0, MIT | [Upstash Redis pricing](https://upstash.com/pricing/redis), [npm @upstash/ratelimit](https://www.npmjs.com/package/@upstash/ratelimit) |

Decision: use the Vercel WAF rate-limit rule on the POST path. It costs no code and no DB. Add the in-memory guard only as a cheap second layer if you need one. Skip Upstash unless you need per-user limits, because it adds a DB.

Anthropic spend limits:

| Control | Where | Source |
|---|---|---|
| Workspace spend limit (monthly cap, alerts) | https://platform.claude.com/settings/workspaces, select workspace, Spend limits | [Workspaces docs](https://platform.claude.com/docs/en/manage-claude/workspaces) |
| Workspace rate limits | https://platform.claude.com/usage/limits | [Workspaces docs](https://platform.claude.com/docs/en/manage-claude/workspaces) |

Do this: create a dedicated workspace for this app's key. Limits cannot be set on the Default Workspace, per the same doc.

Next action: run `npx create-next-app@latest receipts-pr-verifier --typescript --eslint --app`, then apply section 3.
