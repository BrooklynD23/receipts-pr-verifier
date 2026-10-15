import { addedLines, type DiffFile } from "../diff";
import type { Bundle, CheckerFinding } from "../schemas";

export type CheckerRule = (
  files: DiffFile[],
  bundle: Bundle | null,
) => CheckerFinding[];

// Test file = path matches `(^|/)tests?/` or basename `test_*.py` / `*_test.py`
// (PLAN-01 §3).
const TEST_DIR_RE = /(^|\/)tests?\//;
const TEST_BASE_RE = /^(test_.*\.py|.*_test\.py)$/;

export function isTestFile(path: string): boolean {
  if (TEST_DIR_RE.test(path)) return true;
  const base = path.slice(path.lastIndexOf("/") + 1);
  return TEST_BASE_RE.test(base);
}

const SKIP_MARKER_RE =
  /@pytest\.mark\.(skipif|skip|xfail)|pytest\.skip\s*\(|@unittest\.skip/;
const ASSERT_RE = /\bself\.assert\w*|\bassert\b/;
// Strong comparisons per PLAN-01 §3 (`==`, `!=`, `<`, `in`) plus the usual
// unittest comparators. `>`/`<=`/`>=` included so `>=` isn't read as weak.
const STRONG_CMP_RE =
  /==|!=|<=|>=|<|>|\bin\b|assertEqual|assertNotEqual|assertIn|assertNotIn|assertLess|assertGreater|assertAlmostEqual/;
const INJECTION_RE = /\breviewer\b[^\n]{0,40}\b(approve|lgtm|ignore)/i;

export const newSkipMarker: CheckerRule = (files, bundle) => {
  const noted = bundle?.assumptions.some((a) => /skip|xfail/i.test(a)) ?? false;
  const note = noted
    ? "an assumption mentions skipping"
    : "no assumption mentions it";
  const out: CheckerFinding[] = [];
  for (const f of files) {
    if (!isTestFile(f.path)) continue;
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.kind === "add" && SKIP_MARKER_RE.test(l.text)) {
          out.push({
            rule: "new_skip_marker",
            severity: "red",
            file: f.path,
            line: l.newLine,
            side: "new",
            message: `new skip marker in test file; ${note}`,
          });
        }
      }
    }
  }
  return out;
};

export const assertRemoved: CheckerRule = (files) => {
  const out: CheckerFinding[] = [];
  for (const f of files) {
    if (!isTestFile(f.path)) continue;
    for (const h of f.hunks) {
      const removed = h.lines.filter(
        (l) => l.kind === "del" && ASSERT_RE.test(l.text),
      );
      const added = h.lines.filter(
        (l) => l.kind === "add" && ASSERT_RE.test(l.text),
      );
      removed.forEach((r, i) => {
        if (r.oldLine === undefined) return;
        const a = added[i];
        if (a === undefined) {
          out.push({
            rule: "assert_removed",
            severity: "red",
            file: f.path,
            line: r.oldLine,
            side: "old",
            message: "assert removed from test file",
          });
        } else if (STRONG_CMP_RE.test(r.text) && !STRONG_CMP_RE.test(a.text)) {
          out.push({
            rule: "assert_removed",
            severity: "red",
            file: f.path,
            line: r.oldLine,
            side: "old",
            message:
              "assert weakened: strong comparison replaced by a weaker check",
          });
        }
      });
    }
  }
  return out;
};

export const testsMismatch: CheckerRule = (_files, bundle) => {
  if (bundle === null) return [];
  const { collected, ran, skipped } = bundle.tests;
  if (ran >= collected - skipped) return [];
  return [
    {
      rule: "tests_mismatch",
      severity: "red",
      message: `tests.ran (${ran}) is less than collected (${collected}) - skipped (${skipped})`,
    },
  ];
};

export const outOfScope: CheckerRule = (files, bundle) => {
  if (bundle === null) return [];
  const scope = bundle.declared_scope;
  return files
    .filter(
      (f) =>
        !scope.some(
          (s) => s === f.path || (s.endsWith("/") && f.path.startsWith(s)),
        ),
    )
    .map((f) => ({
      rule: "out_of_scope",
      severity: "amber",
      file: f.path,
      message: `${f.path} is outside declared_scope`,
    }));
};

export const unmappedRequirement: CheckerRule = (files, bundle) => {
  if (bundle === null) return [];
  const added = addedLines(files);
  return bundle.requirements
    .filter(
      (r) =>
        !Object.entries(r.diff_lines).some(([path, lines]) =>
          lines.some((n) => added.get(path)?.has(n)),
        ),
    )
    .map((r) => ({
      rule: "unmapped_requirement",
      severity: "amber",
      req_id: r.id,
      message: `${r.id} maps to no added diff line`,
    }));
};

export const missingBundle: CheckerRule = (_files, bundle) =>
  bundle === null
    ? [
        {
          rule: "missing_bundle",
          severity: "amber",
          message: "bundle.json is missing",
        },
      ]
    : [];

export const injectionText: CheckerRule = (files) => {
  const out: CheckerFinding[] = [];
  for (const f of files) {
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.kind === "add" && INJECTION_RE.test(l.text)) {
          out.push({
            rule: "injection_text",
            severity: "amber",
            file: f.path,
            line: l.newLine,
            side: "new",
            message: "added line addresses the reviewer",
          });
        }
      }
    }
  }
  return out;
};

// Rules that need only the diff; BUNDLE_RULES need a bundle. `missingBundle`
// runs in both modes (emits exactly once when bundle is null).
export const DIFF_ONLY_RULES: readonly CheckerRule[] = [
  newSkipMarker,
  assertRemoved,
  injectionText,
];
export const BUNDLE_RULES: readonly CheckerRule[] = [
  testsMismatch,
  outOfScope,
  unmappedRequirement,
];
