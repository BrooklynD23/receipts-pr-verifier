import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewResult } from "../src/lib/schemas";
import type { ReviewFn } from "../src/lib/reviewer/replay";
import { run } from "./record-reviews";

let dir: string;
const ARMS = ["A", "B", "C", "D"];

const fakeReview: ReviewFn = async (input) => {
  const stored = input.pr.reviews[input.arm]!;
  return { ...stored, arm: input.arm, model: "fake-model", source: "live" };
};

const read = async (sub: string, arm: string): Promise<string> =>
  readFile(join(dir, "pr-1", sub, `${arm}.json`), "utf8");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rec-"));
  await cp(join(process.cwd(), "fixtures/prs/pr-1"), join(dir, "pr-1"), {
    recursive: true,
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("run", () => {
  it("writes 4 + 4 recorded files", async () => {
    const code = await run(["--dir", dir], {
      review: fakeReview,
      hasKey: true,
    });
    expect(code).toBe(0);
    for (const [sub, arm] of ARMS.flatMap((a) =>
      ["reviews", "reviews-sabotaged"].map((s) => [s, a] as const),
    )) {
      const r = ReviewResult.parse(JSON.parse(await read(sub, arm)));
      expect(r.source).toBe("recorded");
      expect(r.model).toBe("fake-model");
      expect(r.recorded_at).toBeTruthy();
    }
  });

  it("missing key -> exit 2, nothing written", async () => {
    const before = await read("reviews", "A");
    const code = await run(["--dir", dir], {
      review: fakeReview,
      hasKey: false,
    });
    expect(code).toBe(2);
    expect(await read("reviews", "A")).toBe(before);
  });

  it("--dry-run writes nothing, needs no key", async () => {
    const review = vi.fn(fakeReview);
    const before = await read("reviews", "B");
    const code = await run(["--dir", dir, "--dry-run"], {
      review,
      hasKey: false,
    });
    expect(code).toBe(0);
    expect(review).not.toHaveBeenCalled();
    expect(await read("reviews", "B")).toBe(before);
  });

  it("failure stops and leaves existing files unchanged", async () => {
    const before = await read("reviews", "B");
    const failing: ReviewFn = async (input) => {
      if (input.arm === "B") throw new Error("boom");
      return fakeReview(input);
    };
    const code = await run(["--dir", dir, "--pr", "pr-1"], {
      review: failing,
      hasKey: true,
    });
    expect(code).toBe(1);
    expect(await read("reviews", "B")).toBe(before);
  });

  it("invalid result is not written", async () => {
    const before = await read("reviews", "A");
    const bad = (async () => ({ nope: 1 })) as unknown as ReviewFn;
    const code = await run(["--dir", dir, "--arm", "A"], {
      review: bad,
      hasKey: true,
    });
    expect(code).toBe(1);
    expect(await read("reviews", "A")).toBe(before);
  });

  it("bad arm -> exit 2", async () => {
    const code = await run(["--dir", dir, "--arm", "Z"], {
      review: fakeReview,
      hasKey: true,
    });
    expect(code).toBe(2);
  });
});
