import { describe, expect, it } from "vitest";

import { loadDemoPr } from "../fixtures";
import { PR_IDS, SABOTAGE_PR, type CheckerFinding } from "../schemas";
import { badgeFor } from "./badge";
import { check } from "./index";

// Ground truth stores only rule/file/line/req_id.
const project = (f: CheckerFinding) => ({
  rule: f.rule,
  file: f.file,
  line: f.line,
  req_id: f.req_id,
});

type Expected = { rule: string; file?: string; line?: number; req_id?: string };

const expectFindingsMatch = (
  findings: CheckerFinding[],
  expected: readonly Expected[],
) => {
  const actual = findings.map(project);
  expect(actual).toHaveLength(expected.length);
  for (const e of expected) {
    expect(actual).toContainEqual(e);
  }
};

describe("checker vs fixture ground truth", () => {
  it.each(PR_IDS)(
    "%s: check() findings and badgeFor match ground-truth.json",
    async (id) => {
      const pr = await loadDemoPr(id);
      const findings = check(pr.diff, pr.bundle);
      expectFindingsMatch(findings, pr.groundTruth.expected_findings);
      expect(badgeFor(findings)).toBe(pr.groundTruth.expected_badge);
    },
  );

  it("pr-1 sabotaged diff (diff + sabotage.patch) matches groundTruth.sabotaged", async () => {
    const pr = await loadDemoPr(SABOTAGE_PR);
    expect(pr.sabotage).toBeDefined();
    expect(pr.groundTruth.sabotaged).toBeDefined();
    if (!pr.sabotage || !pr.groundTruth.sabotaged) return;

    const findings = check(`${pr.diff}\n${pr.sabotage.patch}`, pr.bundle);
    expectFindingsMatch(findings, pr.groundTruth.sabotaged.expected_findings);
    expect(badgeFor(findings)).toBe(pr.groundTruth.sabotaged.expected_badge);
  });
});
