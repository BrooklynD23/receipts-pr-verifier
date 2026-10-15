# HUMAN-02 — Vercel account, import, hosted smoke check

| Field | Value |
|---|---|
| Needed before | Hosted smoke check after WAVE-08. Not a prerequisite of any code wave |
| Depends on | HUMAN-01 (GitHub repo) |
| Time | 20 min |
| Cost | $0 on Hobby (non-commercial use only; Pro is $20/seat/month if this ever becomes commercial) ([Hobby plan](https://vercel.com/docs/plans/hobby)) |
| Env vars | none for the hosted demo (replay mode is the default). Live mode: see HUMAN-03 + HUMAN-04 first |

## Steps

1. Sign up with GitHub at https://vercel.com/signup.
2. Import the repo: https://vercel.com/new → pick `receipts-pr-verifier` ([Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)). Framework preset: Next.js (auto). Build command and output: defaults.
3. Settings → General → Node.js Version: `24.x`.
4. Do **not** set `ANTHROPIC_API_KEY` or `REVIEWER_MODE` now. The demo must work without them.
5. Deploy. Copy the production URL (e.g. `https://receipts-pr-verifier.vercel.app`).
6. Replace the `https://<TBD>.vercel.app` placeholder in `README.md` with the URL; commit and push.
7. Limits to know: 300 s max function duration, 100 GB transfer, 1M invocations per month ([limits](https://vercel.com/docs/limits)).

## Verification

```bash
DEMO_URL=https://<your-app>.vercel.app npm run smoke
```

All lines must print `PASS`. Then click through the demo script in [PLAN-00 §3](PLAN-00-overview.md#3-audience-demo-script-300) once in a private browser window.
