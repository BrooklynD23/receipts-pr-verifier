# HUMAN-03 — Anthropic API key, dedicated workspace, spend cap, real recordings

| Field | Value |
|---|---|
| Needed before | Live mode (local or hosted), `scripts/record-reviews.ts`, HUMAN-05. Not needed by any code wave or the hosted replay demo |
| Time | 30 min + ~10 min recording |
| Cost | Pay-as-you-go. Sonnet 5.5 $2 / $10 per MTok in/out; Haiku 5.5 $0.10 / $0.50 (≤100k prompt) ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)). One review ≈ $0.022. Re-recording 3 PRs × 4 arms + 4 sabotaged ≈ 16 calls ≈ $0.40. Set cap: **$10/month** |
| Env vars | `ANTHROPIC_API_KEY`, `REVIEWER_MODE=live` |

## Steps

1. Sign in at https://platform.claude.com/.
2. Create a dedicated workspace (limits cannot be set on the Default Workspace): https://platform.claude.com/settings/workspaces → Create → name `receipts-demo` ([workspaces docs](https://platform.claude.com/docs/en/manage-claude/workspaces)).
3. Set the spend limit: open the workspace → Limits → Change Limit → `$10` monthly; add an email alert at 50% ([help center](https://support.claude.com/en/articles/9796807-creating-and-managing-workspaces)).
4. Create a key inside that workspace: https://platform.claude.com/settings/keys → Create Key → workspace `receipts-demo`.
5. Store it locally in `.env.local` (git-ignored): `ANTHROPIC_API_KEY=sk-ant-...`. Never commit it, paste it in chat, or put it in a `NEXT_PUBLIC_` variable.
6. Re-record real reviewer outputs to replace the hand-authored samples:
   ```bash
   set -a; . ./.env.local; set +a
   npx tsx scripts/record-reviews.ts --dry-run
   npx tsx scripts/record-reviews.ts
   npm run eval
   npx tsx scripts/validate-fixtures.ts && npm test
   npm run format:write
   git add fixtures && git commit -m "chore: record reviewer outputs"
   ```
   Check that the UI label changes from `SAMPLE — hand-authored` to `RECORDED`.
7. Optional hosted live mode: complete HUMAN-04 first, then Vercel → Project → Settings → Environment Variables ([docs](https://vercel.com/docs/environment-variables)) → add `ANTHROPIC_API_KEY` (Production, Sensitive) and `REVIEWER_MODE=live` → redeploy.
8. Rotate the key after the demo (delete it at step 4's page).

## Verification

```bash
curl -s https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" | grep -q claude-sonnet-5-5 && echo OK
```
