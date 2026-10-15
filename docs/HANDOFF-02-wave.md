# HANDOFF-02 — fixtures and checker

## What exists now
- `fixtures/prs/pr-{1,2,3}/` — each has `issue.md`, `diff.patch`, `bundle.json`, `ground-truth.json`, `reviews/{a,b,c,d}.json` (all `source:"authored"`, `model:"hand-authored"`). `pr-1/` also has `sabotage.patch` (`+@pytest.mark.skip(reason="flaky")` lands at new line 88, above `def test_filter_no_prereleases`).
- `src/lib/checker/` — `rules.ts` (7 pure rules), `index.ts` (`check(diff, bundle)` + `badgeFor`), badge precedence per PLAN-01 §2.
- Rule semantics: marker/injection scans `kind==="add"` lines only; `assert_removed` uses `del` lines; null bundle → diff-only rules + `missing_bundle`. File-less findings (tests_mismatch, unmapped_requirement) sort first.
- Deterministic sort: rule order → file → line. Output feeds `badgeFor` directly.

## Verified
- pr-2 → `flags` (new_skip_marker test_version.py:24, tests_mismatch 110<119, injection_text version.py:13); pr-3 → `missing_evidence` (unmapped_requirement R2, out_of_scope tags.py); pr-1 → `clean`; pr-1+sabotage → `flags` @88.
- All `diff_lines` in bundles point at added lines; all hunk headers match body counts.
- Coverage: all-files 96% stmts / 88% branch; checker/index.ts 61% (tie-break branches, within thresholds).

## Deviations
- `STRONG_CMP_RE` is a documented superset of §3's comparator list.
- sabotage.patch old-side header `@@ -80,3 +88,4 @@` uses original-file line 80 (not post-diff 88) — correct for `git apply`, blocks parse independently.

## Next wave must know
- `ReviewerError`/`ReviewInput`/`ReviewFn` get a single home in `src/lib/reviewer/replay.ts` (T03.3).
- WAVE-03's `fixtures.int.test.ts` must reproduce the ground-truth table above via `check()` — if it doesn't, the bug is in the checker (fix) or fixture (report), per task rules.
