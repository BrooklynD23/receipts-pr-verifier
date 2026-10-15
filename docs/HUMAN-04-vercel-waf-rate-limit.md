# HUMAN-04 — Vercel WAF rate-limit rule on `/api/review`

| Field | Value |
|---|---|
| Needed before | Setting `REVIEWER_MODE=live` on the hosted deployment (HUMAN-03 step 7). Not needed for the replay demo or any code wave |
| Depends on | HUMAN-02 |
| Time | 10 min |
| Cost | $0. Hobby includes 1 rate-limit rule per project and 1,000,000 allowed requests ([WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Hobby plan](https://vercel.com/docs/plans/hobby)) |
| Env vars | none |

Why: the in-app limiter is per instance and resets on cold start (`ponytail:` note in `src/lib/rate-limit.ts`). The WAF rule is enforced at the edge across instances.

## Steps

1. Open the project at https://vercel.com/dashboard → `receipts-pr-verifier` → Firewall.
2. Configure → New Rule. Name: `review-rate-limit`.
3. If: Request Path `equals` `/api/review` AND Method `equals` `POST`.
4. Then: Rate Limit → Fixed window `60 s`, limit `10` requests (same as the in-app limit; the WAF covers all instances), key `IP`, action `Deny` (429).
5. Save and Publish.
6. Optional second custom rule (Hobby allows up to 3): deny `GET`/`PUT`/`DELETE` on `/api/review` (the route only exports `POST`; this just keeps noise out of logs).

## Verification

```bash
DEMO_URL=https://<your-app>.vercel.app   # production URL from HUMAN-02
for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code}\n" -X POST "$DEMO_URL/api/review" -H 'content-type: application/json' -d '{"prId":"pr-1","arm":"A","sabotaged":false}'; done | sort | uniq -c
```

Expect at most 10 `200` lines, the rest `429`. Confirm the WAF rule fired under Firewall → Overview (the in-app limiter may also answer 429; both layers are intended).
