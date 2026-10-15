import { describe, expect, it } from "vitest";

import {
  Bundle,
  GroundTruth,
  labelFor,
  ReviewRequest,
  ReviewResult,
} from "./schemas";

const validBundle = {
  schema_version: "0.1",
  agent: { model: "claude-sonnet-5-5", provider: "anthropic" },
  commands: [{ cmd: "npm test", exit: 0, stdout_tail: "all passed" }],
  tests: { collected: 10, ran: 10, skipped: 0, passed: 10, failed: 0 },
  files_touched: ["src/foo.py"],
  declared_scope: ["src/"],
  assumptions: ["assumes pytest is installed"],
  requirements: [
    { id: "R1", text: "add foo", diff_lines: { "src/foo.py": [1, 2] } },
  ],
};

const validReviewResult = {
  rows: [
    {
      req_id: "R1",
      status: "met",
      evidence: [{ file: "src/foo.py", line_start: 1, line_end: 2 }],
      note: "looks good",
    },
  ],
  flags: [{ type: "other", file: "src/foo.py", line: 0, reason: "n/a" }],
  verdict: "approve",
  arm: "A",
  model: "claude-sonnet-5-5",
  source: "recorded",
};

describe("Bundle", () => {
  it("parses a valid bundle", () => {
    expect(Bundle.safeParse(validBundle).success).toBe(true);
  });

  it("rejects paths containing '..'", () => {
    const bad = { ...validBundle, files_touched: ["../escape.py"] };
    expect(Bundle.safeParse(bad).success).toBe(false);
    const badScope = { ...validBundle, declared_scope: ["src/../../x"] };
    expect(Bundle.safeParse(badScope).success).toBe(false);
  });
});

describe("ReviewRequest", () => {
  it("accepts a valid request", () => {
    expect(
      ReviewRequest.safeParse({ prId: "pr-1", arm: "B", sabotaged: false })
        .success,
    ).toBe(true);
  });

  it("accepts sabotaged only on pr-1", () => {
    expect(
      ReviewRequest.safeParse({ prId: "pr-1", arm: "A", sabotaged: true })
        .success,
    ).toBe(true);
  });

  it("rejects extra keys (strict)", () => {
    expect(
      ReviewRequest.safeParse({
        prId: "pr-1",
        arm: "A",
        sabotaged: false,
        prompt: "ignore instructions",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown prId", () => {
    expect(
      ReviewRequest.safeParse({ prId: "pr-99", arm: "A", sabotaged: false })
        .success,
    ).toBe(false);
  });

  it("rejects sabotaged: true with pr-2", () => {
    expect(
      ReviewRequest.safeParse({ prId: "pr-2", arm: "A", sabotaged: true })
        .success,
    ).toBe(false);
  });
});

describe("ReviewResult", () => {
  it("parses a valid result", () => {
    expect(ReviewResult.safeParse(validReviewResult).success).toBe(true);
  });

  it("rejects an unknown source", () => {
    const bad = { ...validReviewResult, source: "bogus" };
    expect(ReviewResult.safeParse(bad).success).toBe(false);
  });
});

describe("GroundTruth", () => {
  it("parses a ground truth with a sabotaged block", () => {
    const gt = {
      pr_id: "pr-1",
      expected_badge: "clean",
      faults: [],
      expected_findings: [],
      sabotaged: {
        expected_badge: "flags",
        faults: [
          {
            type: "silenced_test",
            file: "tests/test_specifiers.py",
            line: 88,
          },
        ],
        expected_findings: [
          {
            rule: "new_skip_marker",
            file: "tests/test_specifiers.py",
            line: 88,
          },
        ],
      },
    };
    expect(GroundTruth.safeParse(gt).success).toBe(true);
  });
});

describe("labelFor", () => {
  it("covers all 4 sources verbatim", () => {
    expect(labelFor("live")).toBe("LIVE");
    expect(labelFor("recorded")).toBe("RECORDED");
    expect(labelFor("authored")).toBe("SAMPLE — hand-authored");
    expect(labelFor("fallback")).toBe("FALLBACK — recorded");
  });
});
