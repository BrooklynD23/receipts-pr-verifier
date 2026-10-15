# Receipts PR Verifier

Review bots grade the diff. Receipts PR Verifier also checks the coding agent's evidence bundle (declared tests, scope, assumptions, requirement→line map) against the code, then shows a requirement→evidence matrix and line-anchored flags.

- Live demo: `https://<TBD>.vercel.app` (placeholder until [HUMAN-02](docs/HUMAN-02-vercel-deploy.md))
- Demo video: `<TBD>` (see [HUMAN-06](docs/HUMAN-06-demo-video-and-rehearsal.md))

The hosted demo runs on committed fixtures (replay mode). It needs no API key.

## Run locally

```bash
nvm use 24            # Node 24 LTS
npm ci
npm run dev           # http://localhost:3000, replay mode
npm test              # unit tests
npm run e2e           # Playwright demo flow
```

Live reviewer (optional): `REVIEWER_MODE=live ANTHROPIC_API_KEY=sk-ant-... npm run dev`. See [HUMAN-03](docs/HUMAN-03-anthropic-key-and-spend-cap.md).

## Docs

| Doc | What |
|---|---|
| [AGENT.md](AGENT.md) | Stack, commands, conventions |
| [PLAN-00](docs/PLAN-00-overview.md) | Problem, scope, demo script, risks |
| [PLAN-01](docs/PLAN-01-architecture.md) | Architecture and data contracts |
| [PLAN-02](docs/PLAN-02-waves.md) | Build waves |
| [STATUS](docs/STATUS.md) | Progress |
