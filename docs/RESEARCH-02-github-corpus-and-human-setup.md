# RESEARCH-02: GitHub corpus and human setup

Checked 2026-10-14. Legend: [U] = unverified (not confirmed in fetched source; check before use).

## 1. mini-swe-agent

| Item | Value | Source |
|---|---|---|
| Latest PyPI version | 2.4.6 | [PyPI JSON](https://pypi.org/pypi/mini-swe-agent/json) |
| Python requirement | >=3.10 | [PyPI JSON](https://pypi.org/pypi/mini-swe-agent/json) |
| License | MIT | [PyPI JSON](https://pypi.org/pypi/mini-swe-agent/json), [repo](https://github.com/SWE-agent/mini-swe-agent) |
| Major version | v2 (repo says "mini-swe-agent v2"; v1 kept on a branch) | [repo](https://github.com/SWE-agent/mini-swe-agent) |
| Docs | [mini-swe-agent.com/latest](https://mini-swe-agent.com/latest/) | [PyPI JSON](https://pypi.org/pypi/mini-swe-agent/json) |

`mini` CLI flags (from the run script `main()` signature):

| Flag | Default | Purpose | Source |
|---|---|---|---|
| `-t`, `--task` | None (prompts if omitted) | Task statement | [reference](https://mini-swe-agent.com/latest/reference/run/mini/) |
| `-m`, `--model` | None (falls back to env `MSWEA_MODEL_NAME`) | Model | [usage](https://mini-swe-agent.com/latest/usage/mini/) |
| `-y`, `--yolo` | False | Run without confirmation | [usage](https://mini-swe-agent.com/latest/usage/mini/) |
| `-o`, `--output` | `<global config dir>/last_mini_run.traj.json` | Trajectory file path | [usage](https://mini-swe-agent.com/latest/usage/mini/) |
| `--environment-class` | None (advanced; example value `local`) | Environment class | [usage](https://mini-swe-agent.com/latest/usage/mini/) |
| `-l`, `--cost-limit` | None (config default 3) | Cost cap; 0 disables | [usage](https://mini-swe-agent.com/latest/usage/mini/) |
| `-c`, `--config` | built-in `mini.yaml` or env `MSWEA_MINI_CONFIG_PATH` | Config override | [usage](https://mini-swe-agent.com/latest/usage/mini/) |
| `--exit-immediately` | False | Skip exit confirmation | [usage](https://mini-swe-agent.com/latest/usage/mini/) |

Notes:
- Non-interactive run = `-t`, `-y`, `-o`, `--environment-class local`. Exact invocation [U] until tested.
- No `--confirm-exit` flag exists. Use `--exit-immediately`. ([usage](https://mini-swe-agent.com/latest/usage/mini/))

Trajectory JSON fields (`info`, `messages`, `trajectory_format`, `extra.actions`, `extra.returncode`):
- **Not confirmed.** Neither docs page lists them. Harbor's ATIF doc lists mini-swe-agent as an ATIF producer and says ATIF has optional extra fields at every level: [harborframework.com](https://harborframework.com/docs/trajectory-format) (search hit).
- Treat all five field names as [U]. Dump one real run with `-o` and read the keys.

## 2. Base corpus

| Repo | License | Latest version | Test command | Test count / runtime | Source |
|---|---|---|---|---|---|
| pypa/packaging | Apache-2.0 OR BSD-2-Clause | 26.3 (uploaded 2026-08-04) | [U] (repo has `noxfile.py` and `tests/`) | [U] | [PyPI JSON](https://pypi.org/pypi/packaging/json), [repo](https://github.com/pypa/packaging) |
| pallets/itsdangerous | **Conflict:** GitHub says BSD-3-Clause; PyPI says MIT | 2.2.0 (uploaded 2024-04-16) | [U] (has `tests/`, `.pre-commit-config.yaml`) | [U] | [repo](https://github.com/pallets/itsdangerous), [PyPI JSON](https://pypi.org/pypi/itsdangerous/json) |

- Pick **pypa/packaging** as base: active (2026 release), permissive license, small pure-Python.
- itsdangerous is the alt. Its license mismatch and stale 2024 release make it the weaker pick.
- Test count and runtime: run `pytest --collect-only -q | tail -1` and time `pytest -q` on the fork.

## 3. pytest machine-readable output

| Need | Flag | Status | Source |
|---|---|---|---|
| Skip reasons in summary | `-rs` (`-r` chars: `f` failed, `E` error, `s` skipped, `x`, `X`, `p`, `P`) | Documented | [output docs](https://docs.pytest.org/en/stable/how-to/output.html) |
| JUnit XML | `--junit-xml=path` (docs form). `--junitxml` alias | Docs show `--junit-xml`; `--junitxml` [U] | [output docs](https://docs.pytest.org/en/stable/how-to/output.html) |
| Collect only | `--collect-only -q` | Documented in usage page | [usage docs](https://docs.pytest.org/en/stable/how-to/usage.html) |
| Quiet | `-q` | Documented | [output docs](https://docs.pytest.org/en/stable/how-to/output.html) |

- No JSON reporter is built in. JUnit XML is the plugin-free machine format.
- Current pytest: **9.1.1** per PyPI. Source: [PyPI JSON](https://pypi.org/pypi/pytest/json).

## 4. aiir (agent_receipt v0.1)

| Item | Value | Source |
|---|---|---|
| License | Apache-2.0 (from search snippet) [U] | [GitLab](https://gitlab.com/invariant-systems/aiir) (search hit) |
| agent_receipt v0.1 field names | **Not verified** | GitHub URL 404; GitLab fetch 403 |

- Repo was described as "AI Integrity Receipts" with zero dependencies (search snippet only, [U]).
- Next step: `git clone` the GitLab repo into a scratch dir and grep for `agent_receipt`. Do not run its code.

## 5. GitHub Actions

| Item | Value | Source |
|---|---|---|
| Free minutes, public repos | Free with standard GitHub-hosted runners | [billing docs](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions) |
| Free plan, private repos | 2,000 min/month | [billing docs](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions) |
| `actions/checkout` | v7.0.1 (latest) | [releases](https://github.com/actions/checkout/releases/latest) |
| `actions/setup-node` | v7.1.0 (latest) | [releases](https://github.com/actions/setup-node/releases/latest) |

Minimal workflow (`pull_request`, read-only for fork PRs):

```yaml
name: receipts-check
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: node scripts/check-receipt.js
      - run: node scripts/post-comment.js
        env:
          GH_TOKEN: ${{ github.token }}
```

- `pull_request` from forks: `GITHUB_TOKEN` is read-only and secrets are withheld. Source: [events docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
- Comment posting from fork PRs will fail with read-only token. Fix: use `pull_request`, check for untrusted code, or a separate `workflow_run` step. Verify before shipping.
- `node-version: 22` is a placeholder [U].
- Security: `pull_request_target` runs with secrets and write token. Do not check out or run fork code in it. Docs: "Avoid using the `pull_request_target` and `workflow_run` workflow triggers with untrusted pull requests." Source: [hardening guide](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [events docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

## 6. Human setup steps

| # | Step | Exact URL / path | Source |
|---|---|---|---|
| 1 | Create Anthropic API key | Console: https://platform.claude.com/ → keys: https://platform.claude.com/settings/keys | [API overview](https://platform.claude.com/docs/en/api/overview) |
| 2 | Set workspace spend limit | Console → Workspaces → open workspace → "Limits" tab → "Change Limit" (must be below org limit). Org limit: Billing at https://platform.claude.com/settings/billing | [Help center](https://support.claude.com/en/articles/9796807-creating-and-managing-workspaces), [API overview](https://platform.claude.com/docs/en/api/overview) |
| 3 | Create Vercel account, import repo | Sign up at https://vercel.com/signup → New Project: https://vercel.com/new [U] → pick GitHub repo (must be owner or org member) | [Vercel GitHub docs](https://vercel.com/docs/git/vercel-for-github) |
| 4 | Add env vars in Vercel | Project → Settings → Environment Variables [U] (`https://vercel.com/<team>/<project>/settings/environment-variables` [U]) | [Vercel docs](https://vercel.com/docs/git/vercel-for-github) (no env-var page fetched) |
| 5 | Add GitHub Actions secret | Repo → Settings → Secrets and variables → Actions → New repository secret. URL: `https://github.com/<user>/<repo>/settings/secrets/actions` [U] | [GitHub docs](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) [U] (fetch 404) |
| 6 | Create fork | Open upstream repo → Fork (top right) → Create fork. Result: `https://github.com/<user>/<repo>` | [GitHub docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) |
| 7 (optional) | OpenAI key | https://platform.openai.com/api-keys (fetch 403, [U]). Pricing: https://openai.com/api/pricing [U] | Only if reviewer uses OpenAI |

Cost note: a reviewer on a second provider family adds a second bill and a second key to rotate. Cap it with a per-key budget. Default: reuse the Anthropic key family for the reviewer unless you need an independent family.

## 7. Demo recording

| Tool | Version | License | Source |
|---|---|---|---|
| OBS Studio | 32.2.2 (released Aug 14, year [U]) | GPLv2 [U] | [download page](https://obsproject.com/download) |

Next action: install OBS from https://obsproject.com/download, record one replay of a PR with a 1080p scene.
