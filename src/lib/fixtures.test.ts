import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listDemoPrs, loadDemoPr, loadPr } from "./fixtures";
import { PR_IDS, type PrId } from "./schemas";

const PRS_DIR = join(process.cwd(), "fixtures/prs");

const MIN_GROUND_TRUTH = {
  pr_id: "tmp",
  expected_badge: "clean",
  faults: [],
  expected_findings: [],
};

describe("loadDemoPr / loadPr on committed fixtures", () => {
  it.each(PR_IDS)(
    "loads %s with matching id and non-empty fields",
    async (id) => {
      const pr = await loadDemoPr(id);
      expect(pr.id).toBe(id);
      expect(pr.title.length).toBeGreaterThan(0);
      expect(pr.issue).toContain("# ");
      expect(pr.diff).toContain("diff --git");
      expect(pr.groundTruth.pr_id).toBe(id);
    },
  );

  it("pr-1 title is the first '# ' line of issue.md, without the prefix", async () => {
    const pr = await loadDemoPr("pr-1");
    expect(pr.title).toBe(
      'Support "===" arbitrary equality in SpecifierSet.filter',
    );
  });

  it("pr-1 loads sabotage patch plus all 4 sabotaged reviews", async () => {
    const pr = await loadDemoPr("pr-1");
    expect(pr.sabotage).toBeDefined();
    expect(pr.sabotage?.patch).toContain("diff --git");
    expect(Object.keys(pr.sabotage?.reviews ?? {}).sort()).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it.each(PR_IDS)("%s has all 4 arm reviews", async (id) => {
    const pr = await loadDemoPr(id);
    expect(Object.keys(pr.reviews).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("loadPr(dir) gives the same result as loadDemoPr for pr-2", async () => {
    const viaDir = await loadPr(join(PRS_DIR, "pr-2"));
    const viaId = await loadDemoPr("pr-2");
    expect(viaDir).toEqual(viaId);
  });
});

describe("listDemoPrs", () => {
  it("returns one FixturePr per PR_ID, in order", async () => {
    const prs = await listDemoPrs();
    expect(prs.map((p) => p.id)).toEqual([...PR_IDS]);
  });
});

describe("loadPr on a temp dir", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "fixture-"));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  const writeBase = async () => {
    await writeFile(join(tmp, "issue.md"), "# Temp PR\n\nbody text\n");
    await writeFile(
      join(tmp, "diff.patch"),
      "diff --git a/x.py b/x.py\n@@ -0,0 +1 @@\n+x = 1\n",
    );
    await writeFile(
      join(tmp, "ground-truth.json"),
      JSON.stringify(MIN_GROUND_TRUTH),
    );
  };

  it("missing bundle.json -> bundle: null, reviews omitted", async () => {
    await writeBase();
    const pr = await loadPr(tmp);
    expect(pr.bundle).toBeNull();
    expect(pr.reviews).toEqual({});
    expect(pr.sabotage).toBeUndefined();
    expect(pr.title).toBe("Temp PR");
    expect(pr.id).toBe(tmp.split("/").pop());
  });

  it("malformed bundle.json throws", async () => {
    await writeBase();
    await writeFile(join(tmp, "bundle.json"), "{ not json");
    await expect(loadPr(tmp)).rejects.toThrow();
  });

  it("malformed ground-truth.json throws", async () => {
    await writeBase();
    await writeFile(join(tmp, "ground-truth.json"), "nope");
    await expect(loadPr(tmp)).rejects.toThrow();
  });

  it("bundle.json failing the Bundle schema throws (zod)", async () => {
    await writeBase();
    await writeFile(
      join(tmp, "bundle.json"),
      JSON.stringify({ schema_version: "9.9" }),
    );
    await expect(loadPr(tmp)).rejects.toThrow();
  });

  it("missing issue.md throws", async () => {
    await writeFile(
      join(tmp, "ground-truth.json"),
      JSON.stringify(MIN_GROUND_TRUTH),
    );
    await expect(loadPr(tmp)).rejects.toThrow();
  });

  it("issue.md with no '# ' line throws", async () => {
    await writeFile(join(tmp, "issue.md"), "no heading here\n");
    await writeFile(join(tmp, "diff.patch"), "x\n");
    await writeFile(
      join(tmp, "ground-truth.json"),
      JSON.stringify(MIN_GROUND_TRUTH),
    );
    await expect(loadPr(tmp)).rejects.toThrow(/title/);
  });
});

describe("id safety", () => {
  it("a non-enum id never reaches the filesystem as a valid load", async () => {
    // PrId comes from the zod enum; a casted bad id must simply fail to load.
    await expect(loadDemoPr("../schemas" as PrId)).rejects.toThrow();
  });
});
