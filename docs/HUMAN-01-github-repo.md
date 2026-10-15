# HUMAN-01 — GitHub repository

| Field | Value |
|---|---|
| Needed before | HUMAN-02 (Vercel import) and real runs of WAVE-06 Action. Not needed by any code wave |
| Time | 15 min |
| Cost | $0 (public repo; Actions free on standard runners for public repos, [billing docs](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)) |
| Env vars / secrets | none. The PR Action uses the built-in `GITHUB_TOKEN` only |

## Steps

1. Sign in at https://github.com. Install the GitHub CLI if missing: https://cli.github.com.
2. From the project root (after WAVE-00 created `.git`): `gh auth login`.
3. Create and push: `gh repo create receipts-pr-verifier --public --source . --remote origin --push`.
4. Open `https://github.com/<user>/receipts-pr-verifier/actions` and confirm the `ci` workflow ran on `main`.
5. Leave Settings → Actions → General → Workflow permissions at the default (read). `receipts-check.yml` requests `pull-requests: write` itself ([GITHUB_TOKEN permissions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)).
6. Do not add repository secrets. Do not enable any `pull_request_target` workflow.

## Playwright system libraries (once per machine, before WAVE-00)

Loop agents cannot use sudo. On Linux/WSL run once:

```bash
sudo npx playwright install-deps chromium
```

Docs: https://playwright.dev/docs/browsers#install-system-dependencies

## Verification

```bash
git ls-remote origin HEAD && gh run list --limit 1 --json conclusion -q '.[0].conclusion' | grep -q success
```
