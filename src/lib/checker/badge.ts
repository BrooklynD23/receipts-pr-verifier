import type { Badge, CheckerFinding } from "../schemas";

// PLAN-01 §2 precedence: any red → flags; else any unmapped_requirement or
// missing_bundle → missing_evidence; else any amber → flags; else clean.
export function badgeFor(findings: readonly CheckerFinding[]): Badge {
  if (findings.some((f) => f.severity === "red")) return "flags";
  if (
    findings.some(
      (f) => f.rule === "unmapped_requirement" || f.rule === "missing_bundle",
    )
  ) {
    return "missing_evidence";
  }
  if (findings.some((f) => f.severity === "amber")) return "flags";
  return "clean";
}
