import { describe, expect, it, vi } from "vitest";
import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";

import type { EnvInfo } from "../env";
import type { FixturePr, ReviewOutput, ReviewResult } from "../schemas";
import {
  CHEAP_MODEL,
  PRIMARY_MODEL,
  ReviewerError,
  type ParseClient,
} from "./anthropic";
import { effectiveDiff } from "../workspace";
import { liveReview, review } from "./index";
import { replayReview, type ReviewInput } from "./replay";

const LIVE_ENV: EnvInfo = { mode: "live", hasKey: true };
const REPLAY_ENV: EnvInfo = { mode: "replay", hasKey: false };
const LIVE_NO_KEY: EnvInfo = { mode: "live", hasKey: false };

const VALID_OUTPUT: ReviewOutput = {
  rows: [
    {
      req_id: "R1",
      status: "met",
      evidence: [{ file: "src/a.ts", line_start: 1, line_end: 3 }],
      note: "covered",
    },
  ],
  flags: [],
  verdict: "approve",
};

type Step = { parsed_output: unknown } | { throw: unknown };

// Fake ParseClient that plays a sequence of outcomes (last one repeats) and
// records every request so tests can assert the model used per call.
function fakeClient(...steps: Step[]) {
  const calls: Record<string, unknown>[] = [];
  let i = 0;
  const client: ParseClient = {
    messages: {
      parse: async (args: unknown) => {
        const recorded = args as Record<string, unknown>;
        calls.push(recorded);
        const step = steps[Math.min(i, steps.length - 1)];
        i += 1;
        if ("throw" in step) throw step.throw;
        return { parsed_output: step.parsed_output };
      },
    },
  };
  return { client, calls };
}

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

describe("effectiveDiff", () => {
  it("returns the plain diff when not sabotaged", () => {
    const pr = makePr({ diff: "BASE" });
    expect(effectiveDiff(pr, false)).toBe("BASE");
  });

  it("joins the sabotage patch with a newline when sabotaged", () => {
    const pr = makePr({
      diff: "BASE",
      sabotage: { patch: "PATCH", reviews: {} },
    });
    expect(effectiveDiff(pr, true)).toBe("BASE\nPATCH");
  });

  it("ignores the sabotage patch when not sabotaged", () => {
    const pr = makePr({
      diff: "BASE",
      sabotage: { patch: "PATCH", reviews: {} },
    });
    expect(effectiveDiff(pr, false)).toBe("BASE");
  });

  it("returns the plain diff when sabotaged but no sabotage block exists", () => {
    const pr = makePr({ diff: "BASE" });
    expect(effectiveDiff(pr, true)).toBe("BASE");
  });
});

describe("liveReview", () => {
  it("returns the output stamped with arm, model, source live and recorded_at", async () => {
    const { client, calls } = fakeClient({ parsed_output: VALID_OUTPUT });
    const out = await liveReview({ client: () => client })(
      inputFor(makePr(), { arm: "C" }),
    );

    expect(out.source).toBe("live");
    expect(out.arm).toBe("C");
    expect(out.model).toBe(PRIMARY_MODEL);
    expect(out.rows).toEqual(VALID_OUTPUT.rows);
    expect(out.verdict).toBe("approve");
    expect(Date.parse(out.recorded_at ?? "")).not.toBeNaN();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.model).toBe(PRIMARY_MODEL);
  });

  it("retries once with the cheap model on ReviewerError", async () => {
    const { client, calls } = fakeClient(
      { throw: new APIConnectionTimeoutError() },
      { parsed_output: VALID_OUTPUT },
    );
    const out = await liveReview({ client: () => client })(inputFor(makePr()));

    expect(out.model).toBe(CHEAP_MODEL);
    expect(out.source).toBe("live");
    expect(calls.map((c) => c.model)).toEqual([PRIMARY_MODEL, CHEAP_MODEL]);
  });

  it("propagates the second ReviewerError when both models fail", async () => {
    const { client, calls } = fakeClient(
      { throw: new ReviewerError("api_error", "a") },
      { parsed_output: { bad: true } },
    );
    const err = await liveReview({ client: () => client })(
      inputFor(makePr()),
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ReviewerError);
    expect((err as ReviewerError).reason).toBe("invalid_output");
    expect(calls).toHaveLength(2);
  });

  it("does not retry on a non-ReviewerError", async () => {
    const client = vi.fn(() => {
      throw new Error("boom");
    });
    await expect(liveReview({ client })(inputFor(makePr()))).rejects.toThrow(
      "boom",
    );
    expect(client).toHaveBeenCalledTimes(1);
  });

  it("puts the effective diff in the prompt when sabotaged", async () => {
    const { client, calls } = fakeClient({ parsed_output: VALID_OUTPUT });
    const pr = makePr({
      diff: "BASE-DIFF",
      sabotage: { patch: "SABOTAGE-PATCH", reviews: {} },
    });
    await liveReview({ client: () => client })(
      inputFor(pr, { sabotaged: true }),
    );

    const messages = calls[0]?.messages as { content: string }[];
    expect(messages[0]?.content).toContain("BASE-DIFF\nSABOTAGE-PATCH");
  });
});

describe("review", () => {
  it("replay mode returns the recorded review and never touches the client", async () => {
    const stored = makeReview({ arm: "B", source: "recorded" });
    const pr = makePr({ reviews: { B: stored } });
    const client = vi.fn(() => {
      throw new Error("client must not be created in replay mode");
    });

    const out = await review(inputFor(pr, { arm: "B" }), {
      env: REPLAY_ENV,
      client,
      replay: replayReview,
    });

    expect(out.mode).toBe("replay");
    expect(out.result).toEqual(stored);
    expect(out.fallbackReason).toBeUndefined();
    expect(client).not.toHaveBeenCalled();
  });

  it("live success returns mode live with source live", async () => {
    const { client, calls } = fakeClient({ parsed_output: VALID_OUTPUT });
    const out = await review(inputFor(makePr()), {
      env: LIVE_ENV,
      client: () => client,
      replay: replayReview,
    });

    expect(out.mode).toBe("live");
    expect(out.result.source).toBe("live");
    expect(out.result.model).toBe(PRIMARY_MODEL);
    expect(out.fallbackReason).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it("live success via the cheap retry reports the cheap model", async () => {
    const { client } = fakeClient(
      { throw: new APIConnectionTimeoutError() },
      { parsed_output: VALID_OUTPUT },
    );
    const out = await review(inputFor(makePr()), {
      env: LIVE_ENV,
      client: () => client,
      replay: replayReview,
    });

    expect(out.mode).toBe("live");
    expect(out.result.model).toBe(CHEAP_MODEL);
    expect(out.result.source).toBe("live");
  });

  it("falls back to the recorded review when both models fail", async () => {
    const stored = makeReview({
      arm: "A",
      source: "recorded",
      model: "recorded-model",
    });
    const pr = makePr({ reviews: { A: stored } });
    const { client, calls } = fakeClient(
      { throw: new APIConnectionTimeoutError() },
      { throw: new APIConnectionTimeoutError() },
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const out = await review(inputFor(pr), {
        env: LIVE_ENV,
        client: () => client,
        replay: replayReview,
      });

      expect(out.mode).toBe("fallback");
      expect(out.fallbackReason).toBe("timeout");
      expect(out.result.source).toBe("fallback");
      expect(out.result.arm).toBe("A");
      expect(out.result.model).toBe("recorded-model");
      expect(calls).toHaveLength(2);

      expect(errSpy).toHaveBeenCalled();
      const logged = errSpy.mock.calls.flat().join(" ");
      expect(logged).toContain("pr-1");
      expect(logged).toContain("timeout");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("maps a non-ReviewerError to api_error without echoing it", async () => {
    const stored = makeReview({ arm: "A", source: "recorded" });
    const pr = makePr({ reviews: { A: stored } });
    const { client } = fakeClient({
      throw: new Error("boom for key sk-ant-secret"),
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const out = await review(inputFor(pr), {
        env: LIVE_ENV,
        client: () => client,
        replay: replayReview,
      });

      expect(out.mode).toBe("fallback");
      expect(out.fallbackReason).toBe("api_error");
      expect(out.result.source).toBe("fallback");

      const logged = errSpy.mock.calls.flat().join(" ");
      expect(logged).not.toContain("boom");
      expect(logged).not.toContain("sk-ant");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("maps invalid_output from both models to invalid_output", async () => {
    const stored = makeReview({ arm: "A", source: "recorded" });
    const pr = makePr({ reviews: { A: stored } });
    const { client } = fakeClient(
      { parsed_output: { bad: true } },
      { parsed_output: { bad: true } },
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const out = await review(inputFor(pr), {
        env: LIVE_ENV,
        client: () => client,
        replay: replayReview,
      });
      expect(out.fallbackReason).toBe("invalid_output");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("falls back with no_key when live mode has no key", async () => {
    const stored = makeReview({ arm: "A", source: "recorded" });
    const pr = makePr({ reviews: { A: stored } });
    const client = vi.fn(() => {
      throw new Error("client must not be created without a key");
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const out = await review(inputFor(pr), {
        env: LIVE_NO_KEY,
        client,
        replay: replayReview,
      });

      expect(out.mode).toBe("fallback");
      expect(out.fallbackReason).toBe("no_key");
      expect(out.result.source).toBe("fallback");
      expect(client).not.toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });
});
