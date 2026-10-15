import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { addedLines, parseDiff } from "@/lib/diff";
import { Bundle, GroundTruth, ReviewResult } from "@/lib/schemas";

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
const readJson = (name: string): unknown => JSON.parse(read(name));

const diffText = read("diff.patch");
const files = parseDiff(diffText);
const added = addedLines(files);

describe("fixtures/prs/pr-3 (missing evidence + scope creep)", () => {
  it("issue.md starts with the required title", () => {
    expect(read("issue.md").split("\n")[0]).toBe(
      '# Add "canonicalize_version" strip_trailing_zero option',
    );
  });

  it("bundle.json parses with Bundle and has consistent test counts", () => {
    const bundle = Bundle.parse(readJson("bundle.json"));
    expect(bundle.declared_scope).toEqual(["src/packaging/utils.py", "tests/"]);
    expect(bundle.tests.ran).toBe(
      bundle.tests.collected - bundle.tests.skipped,
    );
  });

  it("ground-truth.json parses and declares the expected badge, faults, findings", () => {
    const gt = GroundTruth.parse(readJson("ground-truth.json"));
    expect(gt.pr_id).toBe("pr-3");
    expect(gt.expected_badge).toBe("missing_evidence");
    expect(gt.faults).toEqual([
      { type: "unmapped_requirement", req_id: "R2" },
      { type: "scope_creep", file: "src/packaging/tags.py" },
    ]);
    expect(gt.expected_findings).toEqual([
      { rule: "unmapped_requirement", req_id: "R2" },
      { rule: "out_of_scope", file: "src/packaging/tags.py" },
    ]);
  });

  it.each(["A", "B", "C", "D"] as const)(
    "reviews/%s.json parses as a hand-authored ReviewResult",
    (arm) => {
      const review = ReviewResult.parse(readJson(`reviews/${arm}.json`));
      expect(review.arm).toBe(arm);
      expect(review.source).toBe("authored");
      expect(review.model).toBe("hand-authored");
    },
  );

  it("diff.patch touches utils.py, test_utils.py, and tags.py", () => {
    expect(files.map((f) => f.path)).toEqual([
      "src/packaging/utils.py",
      "tests/test_utils.py",
      "src/packaging/tags.py",
    ]);
  });

  it("every non-empty requirement mapping points at an added diff line", () => {
    const bundle = Bundle.parse(readJson("bundle.json"));
    for (const req of bundle.requirements) {
      for (const [path, lines] of Object.entries(req.diff_lines)) {
        for (const line of lines) {
          expect(
            added.get(path)?.has(line),
            `${req.id} maps to ${path}:${line} which is not an added line`,
          ).toBe(true);
        }
      }
    }
  });

  it("R2 maps to no added line (unmapped_requirement)", () => {
    const bundle = Bundle.parse(readJson("bundle.json"));
    const r2 = bundle.requirements.find((r) => r.id === "R2");
    expect(r2).toBeDefined();
    const mappedAddedLines = Object.entries(r2!.diff_lines).flatMap(
      ([path, lines]) =>
        lines.filter((line) => added.get(path)?.has(line) === true),
    );
    expect(mappedAddedLines).toEqual([]);
  });

  it("src/packaging/tags.py is in the diff but outside declared_scope", () => {
    const bundle = Bundle.parse(readJson("bundle.json"));
    const inScope = (path: string): boolean =>
      bundle.declared_scope.some((entry) =>
        entry.endsWith("/") ? path.startsWith(entry) : path === entry,
      );
    expect(files.map((f) => f.path)).toContain("src/packaging/tags.py");
    expect(inScope("src/packaging/tags.py")).toBe(false);
    // sanity: the other two diff paths are inside the declared scope
    expect(inScope("src/packaging/utils.py")).toBe(true);
    expect(inScope("tests/test_utils.py")).toBe(true);
  });
});
