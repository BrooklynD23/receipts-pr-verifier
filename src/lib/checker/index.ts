import { parseDiff } from "../diff";
import type { Bundle, CheckerFinding } from "../schemas";
import { BUNDLE_RULES, DIFF_ONLY_RULES, missingBundle } from "./rules";

// Deterministic total order: file (file-less findings first), then line,
// then rule, then message.
const byFileThenLine = (a: CheckerFinding, b: CheckerFinding): number => {
  const fa = a.file ?? "";
  const fb = b.file ?? "";
  if (fa !== fb) return fa < fb ? -1 : 1;
  const la = a.line ?? 0;
  const lb = b.line ?? 0;
  if (la !== lb) return la - lb;
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  if (a.message !== b.message) return a.message < b.message ? -1 : 1;
  return 0;
};

export function check(
  diffText: string,
  bundle: Bundle | null,
): CheckerFinding[] {
  const files = parseDiff(diffText);
  const rules =
    bundle === null
      ? [...DIFF_ONLY_RULES, missingBundle]
      : [...DIFF_ONLY_RULES, ...BUNDLE_RULES, missingBundle];
  return rules.flatMap((r) => r(files, bundle)).sort(byFileThenLine);
}
