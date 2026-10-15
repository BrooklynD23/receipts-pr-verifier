import { describe, expect, it } from "vitest";

import type { FixturePr, ReviewResult } from "../schemas";
import type { ReviewFn, ReviewInput } from "./replay";
import { replayReview } from "./replay";

function makeReview(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return {
    rows: [],
    flags: [],
    verdict: "approve",
    arm: "A",
    model: "hand-authored",
    source: "authored",
    ...overrides,
  };
}

function makePr(overrides: Partial<FixturePr> = {}): FixturePr {
  return {
    id: "pr-1",
    title: "fixture",
    issue: "issue text",
    diff: "diff text",
    bundle: null,
    groundTruth: {
      pr_id: "pr-1",
      expected_badge: "clean",
      faults: [],
      expected_findings: [],
    },
    reviews: {},
    ...overrides,
  };
}

function inputFor(
  pr: FixturePr,
  overrides: Partial<ReviewInput> = {},
): ReviewInput {
  return { pr, arm: "A", sabotaged: false, findings: [], ...overrides };
}

describe("replayReview", () => {
  it("returns the stored review for the requested arm", async () => {
    const a = makeReview({ arm: "A", verdict: "approve" });
    const b = makeReview({ arm: "B", verdict: "request_changes" });
    const pr = makePr({ reviews: { A: a, B: b } });

    const result = await replayReview(inputFor(pr, { arm: "B" }));

    expect(result).toEqual(b);
  });

  it("picks sabotage.reviews[arm] when sabotaged", async () => {
    const normal = makeReview({ arm: "A", verdict: "approve" });
    const sabotaged = makeReview({
      arm: "A",
      verdict: "request_changes",
      source: "recorded",
    });
    const pr = makePr({
      reviews: { A: normal },
      sabotage: { patch: "patch", reviews: { A: sabotaged } },
    });

    const result = await replayReview(inputFor(pr, { sabotaged: true }));

    expect(result).toEqual(sabotaged);
  });

  it("keeps source as stored", async () => {
    const stored = makeReview({ arm: "C", source: "fallback" });
    const pr = makePr({ reviews: { C: stored } });

    const result = await replayReview(inputFor(pr, { arm: "C" }));

    expect(result.source).toBe("fallback");
  });

  it("returns a new object, not the stored reference", async () => {
    const stored = makeReview();
    const pr = makePr({ reviews: { A: stored } });

    const result = await replayReview(inputFor(pr));

    expect(result).not.toBe(stored);
    expect(result).toEqual(stored);
  });

  it("throws when the arm has no recorded review", async () => {
    const pr = makePr({ reviews: { A: makeReview() } });

    await expect(replayReview(inputFor(pr, { arm: "D" }))).rejects.toThrow(
      "no recorded review for pr-1/D",
    );
  });

  it("throws when sabotaged but the PR has no sabotage block", async () => {
    const pr = makePr({ id: "pr-2", reviews: { A: makeReview() } });

    await expect(
      replayReview(inputFor(pr, { sabotaged: true })),
    ).rejects.toThrow("no recorded review for pr-2/A");
  });

  it("throws when the sabotaged arm is missing even though the normal arm exists", async () => {
    const pr = makePr({
      reviews: { B: makeReview({ arm: "B" }) },
      sabotage: { patch: "patch", reviews: {} },
    });

    await expect(
      replayReview(inputFor(pr, { arm: "B", sabotaged: true })),
    ).rejects.toThrow("no recorded review for pr-1/B");
  });

  it("conforms to ReviewFn", () => {
    const fn: ReviewFn = replayReview;
    expect(fn).toBe(replayReview);
  });
});
