import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateDir } from "./validate-fixtures";

const GOOD_DIR = join(process.cwd(), "fixtures/prs");

const MIN_GROUND_TRUTH = {
  pr_id: "x",
  expected_badge: "clean",
  faults: [],
  expected_findings: [],
};

describe("validateDir", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("committed fixtures/prs: every subdir OK", async () => {
    const results = await validateDir(GOOD_DIR);
    expect(results.map((r) => r.id)).toEqual(["pr-1", "pr-2", "pr-3"]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(console.log).toHaveBeenCalledWith("OK pr-1");
    expect(console.log).toHaveBeenCalledWith("OK pr-2");
    expect(console.log).toHaveBeenCalledWith("OK pr-3");
  });

  describe("broken temp dir", () => {
    let tmp: string;
    beforeEach(async () => {
      tmp = await mkdtemp(join(tmpdir(), "validate-"));
      // good-1: minimal valid fixture
      const good = join(tmp, "good-1");
      await mkdir(good);
      await writeFile(join(good, "issue.md"), "# Good\n");
      await writeFile(join(good, "diff.patch"), "diff --git a/x b/x\n");
      await writeFile(
        join(good, "ground-truth.json"),
        JSON.stringify(MIN_GROUND_TRUTH),
      );
      // bad-1: invalid ground-truth.json
      const bad = join(tmp, "bad-1");
      await mkdir(bad);
      await writeFile(join(bad, "issue.md"), "# Bad\n");
      await writeFile(join(bad, "diff.patch"), "diff --git a/x b/x\n");
      await writeFile(
        join(bad, "ground-truth.json"),
        JSON.stringify({ wrong: true }),
      );
    });
    afterEach(async () => {
      await rm(tmp, { recursive: true, force: true });
    });

    it("reports ok for the valid subdir and an error for the broken one", async () => {
      const results = await validateDir(tmp);
      const byId = Object.fromEntries(results.map((r) => [r.id, r]));
      expect(byId["good-1"].ok).toBe(true);
      expect(byId["bad-1"].ok).toBe(false);
      expect(byId["bad-1"].error).toBeTruthy();
      expect(results.some((r) => !r.ok)).toBe(true);
    });
  });
});
