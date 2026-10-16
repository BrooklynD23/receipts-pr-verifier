import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseArgv, run } from "./eval";

describe("scripts/eval run", () => {
  it("scores fixtures/prs with all 4 arms", async () => {
    const out = join(await mkdtemp(join(tmpdir(), "eval-")), "r.json");
    await run({ dir: "fixtures/prs", out });
    const r = JSON.parse(await readFile(out, "utf8"));
    expect(r.cases).toBeGreaterThanOrEqual(3);
    expect(Object.keys(r.falseFlagRate).sort()).toEqual(["A", "B", "C", "D"]);
    for (const row of Object.values(r.table) as Record<string, unknown>[]) {
      expect(Object.keys(row).sort()).toEqual(["A", "B", "C", "D"]);
    }
    expect(r.sources.authored).toBeGreaterThan(0);
  });

  it("rejects a bad dir", async () => {
    await expect(
      run({ dir: "no/such/dir", out: "/tmp/x.json" }),
    ).rejects.toThrow();
  });
});

describe("parseArgv", () => {
  it("parses --key value pairs", () => {
    expect(parseArgv(["--dir", "a", "--out", "b"])).toEqual({
      dir: "a",
      out: "b",
    });
  });
  it("throws on a missing value", () => {
    expect(() => parseArgv(["--dir"])).toThrow(/bad args/);
  });
  it("throws on a non-`--` key", () => {
    expect(() => parseArgv(["dir", "a"])).toThrow(/bad args/);
  });
});
