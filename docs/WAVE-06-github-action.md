# WAVE-06 — Optional GitHub Action: run the checker on real PRs
Depends on: WAVE-03
Human prerequisites: none

## Tasks
### T06.1 — check-pr CLI (diff + bundle → findings → comment or job summary)
- Files: scripts/check-pr.ts, scripts/check-pr.test.ts, scripts/__fixtures__/check-pr/**
- Do:
  0. Context for every task in this wave: Optional. Not on the hosted-demo critical path. Running it on a real PR needs the GitHub repo from [HUMAN-01](HUMAN-01-github-repo.md), but the code and tests here run locally without it.
  1. `npx tsx scripts/check-pr.ts --base <sha> --head <sha> [--bundle .receipts/bundle.json] [--fail-on red|amber|none]` (default `red`). Validate args with zod; SHAs must match `/^[0-9a-f]{7,40}$/`.
  2. Diff via `execFileSync("git", ["diff", `${base}...${head}`])` (no shell). Bundle read from the working tree path; missing → `null`; invalid JSON or schema → `missing_bundle`-style finding with the zod message.
  3. `check()` + `badgeFor()` → markdown: badge line, findings table (rule, severity, `file:line`, message). Escape `|` and backticks in file paths/messages; truncate to 60 KB.
  4. If `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `PR_NUMBER` are set: `fetch` `POST https://api.github.com/repos/${repo}/issues/${n}/comments` with `Authorization: Bearer`, `Accept: application/vnd.github+json`. On 403/404 (fork PR read-only token) or when env is absent, append markdown to `$GITHUB_STEP_SUMMARY` if set, else stdout. Never print the token.
  5. Exit 1 when a finding at or above `--fail-on` exists.
  6. Export `run(args, deps)` with injectable `git`, `fetch`, `env`, `writeSummary`.
- Tests: `scripts/check-pr.test.ts` — uses `scripts/__fixtures__/check-pr/{clean,silenced}.patch` + bundle via injected `git`; markdown contains rule names and `file:line`; posts comment with correct URL/headers (fake fetch); 403 → writes summary; no env → stdout; bad SHA rejected; exit codes for `red`/`amber`/`none`; token absent from all output.
- Acceptance: `npx vitest run scripts/check-pr.test.ts`, `npx eslint scripts/check-pr.ts`
### T06.2 — receipts-check workflow
- Files: .github/workflows/receipts-check.yml
- Do:
  1. `on: pull_request` only. `permissions: { contents: read, pull-requests: write }`.
  2. Steps: `actions/checkout@v7` with `fetch-depth: 0`; `actions/setup-node@v7` with `node-version-file: .nvmrc`, `cache: npm`; `npm ci`; run `npx tsx scripts/check-pr.ts --base "$BASE_SHA" --head "$HEAD_SHA"` with `env: BASE_SHA: ${{ github.event.pull_request.base.sha }}`, `HEAD_SHA: ${{ github.event.pull_request.head.sha }}`, `PR_NUMBER: ${{ github.event.pull_request.number }}`, `GITHUB_TOKEN: ${{ github.token }}` — never interpolate `${{ }}` inside `run:`.
  3. Header comment: why not `pull_request_target` ([hardening guide](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
- Tests: none (config); checked by acceptance.
- Acceptance: `node -e "const s=require('fs').readFileSync('.github/workflows/receipts-check.yml','utf8');if(s.includes('pull_request_target'))process.exit(1);for(const k of ['pull_request','actions/checkout@v7','scripts/check-pr.ts','BASE_SHA'])if(!s.includes(k))process.exit(1);if(/run:[^\n]*\\$\\{\\{/.test(s))process.exit(1)"`

## Wave gate
- Commands: `npm run lint && npm run typecheck && npm run test:coverage && npm run build && npx tsx scripts/check-pr.ts --base $(git rev-parse HEAD~1) --head $(git rev-parse HEAD) --fail-on none && npm run format`
- Review focus: no `pull_request_target`; no secrets beyond `GITHUB_TOKEN`; `${{ }}` only in `env:`; `execFileSync` without shell; markdown escaping; token never logged; fork PRs degrade to job summary.
