import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Bundle, CheckerFinding, ReviewResult } from "../lib/schemas";
import { anchorId, Matrix } from "./Matrix";

const requirements: Bundle["requirements"] = [
  {
    id: "R1",
    text: "adds export button",
    diff_lines: { "src/ui.ts": [12] },
  },
  {
    id: "R2",
    text: "hides button for anonymous users",
    diff_lines: { "src/ui.ts": [30] },
  },
];

const review: ReviewResult = {
  arm: "C",
  model: "claude-test",
  source: "recorded",
  verdict: "request_changes",
  rows: [
    {
      req_id: "R1",
      status: "met",
      evidence: [{ file: "src/ui.ts", line_start: 12, line_end: 14 }],
      note: "button wired up",
    },
    {
      req_id: "R2",
      status: "unmet",
      evidence: [],
      note: "no code found",
    },
  ],
  flags: [
    {
      type: "unmapped_requirement",
      file: "src/ui.ts",
      line: 0,
      reason: "R2 is not implemented",
    },
  ],
};

const findings: CheckerFinding[] = [
  {
    rule: "unmapped_requirement",
    severity: "amber",
    req_id: "R2",
    message: "R2 maps to no added diff line",
  },
  {
    rule: "new_skip_marker",
    severity: "red",
    file: "tests/test_ui.py",
    line: 8,
    side: "new",
    message: "new skip marker in test file; no assumption mentions it",
  },
];

const html = (props: Partial<Parameters<typeof Matrix>[0]> = {}): string =>
  renderToStaticMarkup(
    <Matrix
      requirements={requirements}
      review={review}
      findings={findings}
      sourceLabel="RECORDED"
      {...props}
    />,
  );

describe("anchorId", () => {
  it("formats L-<enc(file)>-<n|o><line>", () => {
    expect(anchorId("src/ui.ts", "new", 12)).toBe("L-src%2Fui.ts-n12");
    expect(anchorId("src/ui.ts", "old", 4)).toBe("L-src%2Fui.ts-o4");
  });
});

describe("Matrix", () => {
  it("renders a table with a caption and scoped column headers", () => {
    const out = html();
    expect(out).toMatch(/<caption[\s>]/);
    expect(out.match(/scope="col"/g)).toHaveLength(4);
    for (const h of ["Requirement", "Reviewer status", "Evidence", "Checker"]) {
      expect(out).toContain(h);
    }
  });

  it("renders a row per requirement with reviewer status", () => {
    const out = html();
    for (const r of requirements) {
      expect(out).toContain(r.id);
      expect(out).toContain(r.text);
    }
    expect(out).toContain("met");
    expect(out).toContain("unmet");
  });

  it("links reviewer evidence to its diff anchor", () => {
    const out = html();
    expect(out).toContain(`href="#${anchorId("src/ui.ts", "new", 12)}"`);
    expect(out).toContain("src/ui.ts:12");
  });

  it("marks a requirement with an unmapped_requirement finding as Missing evidence", () => {
    const out = html();
    expect(out).toContain("Missing evidence");
  });

  it("renders the findings panel with severity text, rule, message and anchor link", () => {
    const out = html();
    expect(out).toContain("Red flag");
    expect(out).toContain("Amber");
    expect(out).toContain("new_skip_marker");
    expect(out).toContain("unmapped_requirement");
    expect(out).toContain(
      "new skip marker in test file; no assumption mentions it",
    );
    expect(out).toContain(`href="#${anchorId("tests/test_ui.py", "new", 8)}"`);
  });

  it("shows 'No checker findings' when the list is empty", () => {
    const out = html({ findings: [] });
    expect(out).toContain("No checker findings");
  });

  it("renders the sourceLabel tag, verdict and reviewer flags", () => {
    const out = html();
    expect(out).toContain("RECORDED");
    expect(out).toContain("request_changes");
    expect(out).toContain("R2 is not implemented");
  });

  it("links old-side findings with the 'o' anchor", () => {
    const old: CheckerFinding[] = [
      {
        rule: "assert_removed",
        severity: "red",
        file: "tests/test_ui.py",
        line: 20,
        side: "old",
        message: "assert removed from test file",
      },
    ];
    const out = html({ findings: old });
    expect(out).toContain(`href="#${anchorId("tests/test_ui.py", "old", 20)}"`);
    expect(out).toContain("-o20");
  });
});
