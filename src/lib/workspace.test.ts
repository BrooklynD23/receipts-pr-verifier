import { describe, expect, it } from "vitest";
import { loadDemoPr } from "./fixtures";
import type { FixturePr, ReviewResult } from "./schemas";
import { effectiveDiff, initState, reduce, type State } from "./workspace";

const freeze = <T extends object>(o: T): T => {
  Object.freeze(o);
  return o;
};

describe("workspace reducer", () => {
  it("init pr-1 is clean with recorded arm D review", async () => {
    const pr = await loadDemoPr("pr-1");
    const s = initState(pr);
    expect(s).toMatchObject({
      prId: "pr-1",
      arm: "D",
      sabotaged: false,
      badge: "clean",
      mode: "replay",
      pending: false,
    });
    expect(s.review).toEqual(pr.reviews.D);
    expect(s.diff).toBe(pr.diff);
  });

  it("toggleSabotage flags new_skip_marker at line 88 and swaps review; toggling back restores", async () => {
    const pr = await loadDemoPr("pr-1");
    const s0 = freeze(initState(pr));
    const s1 = reduce(s0, { type: "toggleSabotage" }, pr);
    expect(s1.sabotaged).toBe(true);
    expect(s1.badge).toBe("flags");
    expect(
      s1.findings.some((f) => f.rule === "new_skip_marker" && f.line === 88),
    ).toBe(true);
    expect(s1.review).toEqual(pr.sabotage?.reviews.D);
    expect(s1.diff).toBe(effectiveDiff(pr, true));
    const s2 = reduce(s1, { type: "toggleSabotage" }, pr);
    expect(s2).toEqual(s0);
  });

  it("setArm A vs D swaps review", async () => {
    const pr = await loadDemoPr("pr-1");
    const sD = initState(pr);
    const sA = reduce(freeze(sD), { type: "setArm", arm: "A" }, pr);
    expect(sA.arm).toBe("A");
    expect(sA.review).toEqual(pr.reviews.A);
    expect(sA.review).not.toEqual(sD.review);
  });

  it("toggleSabotage on pr-2 is a no-op", async () => {
    const pr = await loadDemoPr("pr-2");
    const s = freeze(initState(pr));
    expect(reduce(s, { type: "toggleSabotage" }, pr)).toBe(s);
    expect(effectiveDiff(pr, true)).toBe(pr.diff);
  });

  it("liveStarted / liveResult", async () => {
    const pr = await loadDemoPr("pr-1");
    const s0 = freeze(initState(pr));
    const s1 = reduce(s0, { type: "liveStarted" }, pr);
    expect(s1.pending).toBe(true);
    const result: ReviewResult = {
      ...(pr.reviews.D as ReviewResult),
      source: "live",
    };
    const s2 = reduce(
      freeze(s1),
      { type: "liveResult", result, mode: "live" },
      pr,
    );
    expect(s2).toMatchObject({ pending: false, mode: "live", review: result });
    // arm change returns to replay mode
    const s3 = reduce(s2, { type: "setArm", arm: "B" }, pr);
    expect(s3.mode).toBe("replay");
  });

  it("missing recorded review yields null review", async () => {
    const pr = await loadDemoPr("pr-1");
    const bare: FixturePr = { ...pr, reviews: {} };
    const s: State = initState(bare);
    expect(s.review).toBeNull();
  });
});
