# HANDOFF-03 — reviewer prompts, providers, loader

## What exists now
- `src/lib/reviewer/prompt.ts` — `buildPrompt({pr, arm, diff, findings})` pure; `PROMPT_VERSION="p1-v1"`. P0 (A/C): base rule + "Review this diff for problems." P1 (B/D): + strict-maintainer persona (system) + req→evidence rows + checker self-critique (user). C/D include bundle+findings inside the same `<untrusted_pr_data>` wrapper; inner `</untrusted_pr_data` → `&lt;/untrusted_pr_data`.
- `src/lib/reviewer/anthropic.ts` — `ParseClient` slice type, `createClient()` (`Anthropic({timeout:30_000, maxRetries:1})`, key from env by SDK), `callClaude` = `messages.parse` + `zodOutputFormat(ReviewOutput)` + `safeParse` recheck; `ReviewerError` reason `timeout|api_error|invalid_output`, static messages + `cause`.
- `src/lib/reviewer/replay.ts` — single home of `ReviewInput`/`ReviewFn`; `replayReview` picks `sabotage?.reviews[arm]` when sabotaged, throws `no recorded review for <id>/<arm>`, returns new object.
- `src/lib/fixtures.ts` — `loadPr(dir)` (title = first `# ` line; missing bundle/reviews/sabotage → null/omitted ENOENT-only), `loadDemoPr(id: PrId)` (enum-only → fs), `listDemoPrs()`.
- `scripts/validate-fixtures.ts` — `npx tsx` CLI, `OK <id>`/`FAIL` + exit 1; `validateDir` exported.
- `src/lib/checker/fixtures.int.test.ts` — check() set-equals ground truth for all 3 PRs incl. sabotaged pr-1.

## Deviations
- `PromptInput.pr` = `Pick<FixturePr,"issue"|"bundle">` (superset-compatible).
- `createClient` wraps SDK in a `ParseClient` adapter — strict-TS generic `parse` isn't assignable to the unknown-in/out slice; minimal cast.
- Int test asserts unordered set-equality (checker sorts file-less findings first; ground truth lists file order).

## Known warnings
- Arm B asks to "reconcile every verdict with each checker finding" while receiving none — spec-mandated wording.
- checker/index.ts tie-break branches at 61% stmt coverage (within global thresholds).

## Next wave must know
- `review(input, deps)` in T04.1 must import `ReviewInput`/`ReviewFn` from `./replay`, `buildPrompt` from `./prompt`, `callClaude`/`ReviewerError`/`createClient` from `./anthropic` — single-home rule.
- `anchorId` format is shared between Matrix (T04.3) and DiffView (T04.4): `L-<encodeURIComponent(file)>-<n|o><line>` — DiffView duplicates the 1-liner (files stay disjoint).
