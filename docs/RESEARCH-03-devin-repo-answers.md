# RESEARCH-03 — Repo answers via Devin DeepWiki

Checked 2026-10-14 with `mcp__devin__ask_wiki_question` (DeepWiki). Answers are DeepWiki summaries of the repo source; confirm against the linked repo before relying on exact flags.

## mini-swe-agent ([repo](https://github.com/SWE-agent/mini-swe-agent), [DeepWiki search](https://app.devin.ai/search/api_9e184859-e381-4f17-a0ca-22ee65b8d23c))

| Item | Finding |
|---|---|
| Install | `pip install mini-swe-agent` |
| Python | 3.10+ |
| Where bash runs | `Environment.execute`, called from `DefaultAgent.execute_actions` (one call site → full command capture) |
| Non-interactive run | `mini -t "<task>" -m <litellm-model> -y -o traj.json --environment-class local` |
| Trajectory top-level keys | `info` (`model_stats`, `config`, `mini_version`, `exit_status`, `submission`), `messages`, `trajectory_format` (e.g. `mini-swe-agent-1.1`; field added in v2.0) |
| Per-message metadata | assistant: `extra.actions`, `extra.cost`, `extra.timestamp`; observation: `extra.returncode`, `extra.timestamp` |

Implication: the bundle builder reads `messages[].extra.actions` + `extra.returncode` from the trajectory file. No hook code needed.

## Anthropic TypeScript SDK ([repo](https://github.com/anthropics/anthropic-sdk-typescript), [DeepWiki search](https://app.devin.ai/search/api_36873950-49a3-497f-b242-5a642109feaa))

| Item | Finding |
|---|---|
| Structured output | `client.messages.parse({ model, max_tokens, messages, output_config: { format: zodOutputFormat(Schema) } })` → `message.parsed_output` |
| Import | `import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'` |
| Deprecated | `output_format` param (use `output_config.format`) |
| API key | reads `ANTHROPIC_API_KEY` env var by default |
| Timeout / retries | `new Anthropic({ timeout: 60000, maxRetries: 3 })` |

Implication: zod schema doubles as the reviewer contract and the runtime validator. No hand-written JSON parsing.
