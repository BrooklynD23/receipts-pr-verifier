import { describe, expect, it } from "vitest";

import { aggregate, scoreReview, type Fault } from "./eval";
import type { ReviewOutput } from "./schemas";

const review = (
  flags: ReviewOutput["flags"] = [],
  rows: ReviewOutput["rows"] = [],
): ReviewOutput => ({ rows, flags, verdict: "approve" });

const flag = (
  type: ReviewOutput["flags"][number]["type"],
  file = "a.py",
  line = 10,
) => ({
  type,
  file,
  line,
  reason: "r",
});

describe("scoreReview mappings", () => {
  const cases: [Fault["type"], ReviewOutput["flags"][number]["type"]][] = [
    ["silenced_test", "silenced_test"],
    ["scope_creep", "scope"],
    ["unstated_assumption", "assumption"],
    ["unmapped_requirement", "unmapped_requirement"],
    ["injection", "injection"],
  ];
  it.each(cases)("%s detected by %s flag", (type, flagType) => {
    const s = scoreReview(
      [{ type, file: "a.py", line: 10 }],
      review([flag(flagType)]),
    );
    expect(s).toEqual({ detected: [type], missed: [], falseFlags: 0 });
  });

  it("wrong flag type is a miss", () => {
    const s = scoreReview(
      [{ type: "scope_creep", file: "a.py", line: 10 }],
      review([flag("other")]),
    );
    expect(s.missed).toEqual(["scope_creep"]);
  });

  it("unmapped_requirement detected by unmet/unclear row for req_id", () => {
    const f: Fault = { type: "unmapped_requirement", req_id: "R2" };
    const row = (status: "met" | "unmet" | "unclear") => ({
      req_id: "R2",
      status,
      evidence: [],
      note: "",
    });
    expect(scoreReview([f], review([], [row("unmet")])).detected).toEqual([
      "unmapped_requirement",
    ]);
    expect(
      scoreReview([f], review([], [row("unclear")])).detected,
    ).toHaveLength(1);
    expect(scoreReview([f], review([], [row("met")])).missed).toHaveLength(1);
  });
});

describe("location matching", () => {
  const fault: Fault = { type: "silenced_test", file: "a.py", line: 10 };
  it("within +-3 matches, beyond does not", () => {
    expect(
      scoreReview([fault], review([flag("silenced_test", "a.py", 13)]))
        .detected,
    ).toHaveLength(1);
    expect(
      scoreReview([fault], review([flag("silenced_test", "a.py", 7)])).detected,
    ).toHaveLength(1);
    expect(
      scoreReview([fault], review([flag("silenced_test", "a.py", 14)])).missed,
    ).toHaveLength(1);
  });
  it("other file does not match", () => {
    expect(
      scoreReview([fault], review([flag("silenced_test", "b.py", 10)])).missed,
    ).toHaveLength(1);
  });
  it("line 0 is a file-level match", () => {
    expect(
      scoreReview([fault], review([flag("silenced_test", "a.py", 0)])).detected,
    ).toHaveLength(1);
  });
});

describe("false flags", () => {
  it("counts every flag when no faults", () => {
    expect(
      scoreReview([], review([flag("other"), flag("scope")])).falseFlags,
    ).toBe(2);
  });
  it("zero on faulty PR", () => {
    expect(
      scoreReview(
        [{ type: "injection", file: "a.py", line: 1 }],
        review([flag("other")]),
      ).falseFlags,
    ).toBe(0);
  });
});

describe("aggregate", () => {
  it("sums detected/total per fault type and arm, and false flag rate", () => {
    const t: Fault = { type: "injection", file: "a.py", line: 1 };
    const out = aggregate([
      {
        arm: "A",
        faults: [t],
        score: { detected: ["injection"], missed: [], falseFlags: 0 },
      },
      {
        arm: "A",
        faults: [t],
        score: { detected: [], missed: ["injection"], falseFlags: 0 },
      },
      {
        arm: "A",
        faults: [],
        score: { detected: [], missed: [], falseFlags: 2 },
      },
      {
        arm: "B",
        faults: [t],
        score: { detected: ["injection"], missed: [], falseFlags: 0 },
      },
    ]);
    expect(out.table.injection).toEqual({
      A: { detected: 1, total: 2 },
      B: { detected: 1, total: 1 },
      C: { detected: 0, total: 0 },
      D: { detected: 0, total: 0 },
    });
    expect(out.falseFlagRate.A).toBeCloseTo(2 / 3);
    expect(out.falseFlagRate.B).toBe(0);
    expect(out.falseFlagRate.C).toBe(0);
  });
});
