import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { addedLines, parseDiff } from "@/lib/diff";
import { Bundle, GroundTruth, ReviewResult } from "@/lib/schemas";

const dir = dirname(fileURLToPath(import.meta.url));
const readText = (name: string) => readFileSync(join(dir, name), "utf8");
const readJson = (name: string): unknown => JSON.parse(readText(name));

const SRC_FILE = "src/packaging/specifiers.py";
const TEST_FILE = "tests/test_specifiers.py";
const SKIP_MARKER = '@pytest.mark.skip(reason="flaky")';
const SKIP_LINE = 88;
const ARMS = ["A", "B", "C", "D"] as const;

const combinedDiff = () =>
  parseDiff(`${readText("diff.patch")}\n${readText("sabotage.patch")}`);

describe("pr-1 fixture files", () => {
  it("issue.md starts with the required title and lists R1-R3", () => {
    const issue = readText("issue.md");
    expect(issue.split("\n")[0]).toBe(
      '# Support "===" arbitrary equality in SpecifierSet.filter',
    );
    for (const id of ["R1", "R2", "R3"]) {
      expect(issue).toContain(id);
    }
  });

  it("diff.patch is a real unified diff over the two touched files", () => {
    const files = parseDiff(readText("diff.patch"));
    expect(files.map((f) => f.path)).toEqual([SRC_FILE, TEST_FILE]);
    for (const f of files) {
      expect(f.hunks.length).toBeGreaterThan(0);
    }
  });

  it("clean diff adds no skip markers and removes no lines in the test file", () => {
    const skipRe =
      /@pytest\.mark\.(skip|skipif|xfail)|pytest\.skip\(|@unittest\.skip/;
    for (const f of parseDiff(readText("diff.patch"))) {
      for (const h of f.hunks) {
        for (const l of h.lines) {
          if (l.kind === "add") {
            expect(l.text).not.toMatch(skipRe);
          }
          if (f.path === TEST_FILE) {
            expect(l.kind).not.toBe("del");
          }
        }
      }
    }
  });

  it("bundle.json parses and declares consistent evidence", () => {
    const bundle = Bundle.parse(readJson("bundle.json"));
    expect(bundle.tests.skipped).toBe(0);
    expect(bundle.tests.ran).toBe(
      bundle.tests.collected - bundle.tests.skipped,
    );
    expect(bundle.files_touched).toEqual(
      expect.arrayContaining([SRC_FILE, TEST_FILE]),
    );
    for (const p of [SRC_FILE, TEST_FILE]) {
      const covered = bundle.declared_scope.some(
        (s) => p === s || (s.endsWith("/") && p.startsWith(s)),
      );
      expect(covered, `${p} covered by declared_scope`).toBe(true);
    }
  });

  it("every requirement maps to lines actually added by the diff", () => {
    const bundle = Bundle.parse(readJson("bundle.json"));
    const added = addedLines(parseDiff(readText("diff.patch")));
    expect(bundle.requirements.map((r) => r.id)).toEqual(["R1", "R2", "R3"]);
    for (const req of bundle.requirements) {
      const entries = Object.entries(req.diff_lines);
      expect(entries.length).toBeGreaterThan(0);
      for (const [file, lines] of entries) {
        expect(lines.length, `${req.id} maps lines in ${file}`).toBeGreaterThan(
          0,
        );
        for (const line of lines) {
          expect(
            added.get(file)?.has(line),
            `${req.id}: ${file}:${line} must be an added line`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("sabotage.patch", () => {
  it("is a single diff --git block for tests/test_specifiers.py", () => {
    const files = parseDiff(readText("sabotage.patch"));
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(TEST_FILE);
    expect(readText("sabotage.patch")).toContain(
      "diff --git a/tests/test_specifiers.py b/tests/test_specifiers.py",
    );
  });

  it("puts the added @pytest.mark.skip on new-file line 88 above a test", () => {
    const files = combinedDiff();
    const added = addedLines(files);
    expect(added.get(TEST_FILE)?.has(SKIP_LINE)).toBe(true);

    const block = files.find(
      (f) =>
        f.path === TEST_FILE &&
        f.hunks.some((h) =>
          h.lines.some((l) => l.kind === "add" && l.newLine === SKIP_LINE),
        ),
    );
    expect(block).toBeDefined();
    if (!block) return;

    const hunk = block.hunks.find((h) =>
      h.lines.some((l) => l.kind === "add" && l.newLine === SKIP_LINE),
    );
    expect(hunk).toBeDefined();
    if (!hunk) return;

    const idx = hunk.lines.findIndex(
      (l) => l.kind === "add" && l.newLine === SKIP_LINE,
    );
    expect(hunk.lines[idx].text).toContain(SKIP_MARKER);

    const below = hunk.lines[idx + 1];
    expect(below.kind).toBe("ctx");
    expect(below.newLine).toBe(SKIP_LINE + 1);
    expect(below.text).toMatch(/\bdef test_\w+\(/);
  });
});

describe("ground-truth.json", () => {
  it("expects a clean badge with no faults or findings", () => {
    const gt = GroundTruth.parse(readJson("ground-truth.json"));
    expect(gt.pr_id).toBe("pr-1");
    expect(gt.expected_badge).toBe("clean");
    expect(gt.faults).toEqual([]);
    expect(gt.expected_findings).toEqual([]);
  });

  it("sabotaged expectation flags silenced_test at tests/test_specifiers.py:88", () => {
    const sab = GroundTruth.parse(readJson("ground-truth.json")).sabotaged;
    expect(sab).toBeDefined();
    if (!sab) return;
    expect(sab.expected_badge).toBe("flags");
    expect(sab.faults).toEqual([
      { type: "silenced_test", file: TEST_FILE, line: SKIP_LINE },
    ]);
    expect(sab.expected_findings).toEqual([
      { rule: "new_skip_marker", file: TEST_FILE, line: SKIP_LINE },
    ]);
  });
});

describe("reviews", () => {
  it("clean reviews A-D approve, all rows met with evidence, hand-authored", () => {
    for (const arm of ARMS) {
      const review = ReviewResult.parse(readJson(`reviews/${arm}.json`));
      expect(review.arm).toBe(arm);
      expect(review.source).toBe("authored");
      expect(review.model).toBe("hand-authored");
      expect(review.verdict).toBe("approve");
      expect(review.flags).toEqual([]);
      expect(review.rows.map((r) => r.req_id)).toEqual(["R1", "R2", "R3"]);
      for (const row of review.rows) {
        expect(row.status).toBe("met");
        expect(row.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it("sabotaged reviews A and B approve with no flags (diff-only misses it)", () => {
    for (const arm of ["A", "B"] as const) {
      const review = ReviewResult.parse(
        readJson(`reviews-sabotaged/${arm}.json`),
      );
      expect(review.arm).toBe(arm);
      expect(review.source).toBe("authored");
      expect(review.model).toBe("hand-authored");
      expect(review.verdict).toBe("approve");
      expect(review.flags).toEqual([]);
    }
  });

  it("sabotaged reviews C and D request changes flagging silenced_test at 88", () => {
    for (const arm of ["C", "D"] as const) {
      const review = ReviewResult.parse(
        readJson(`reviews-sabotaged/${arm}.json`),
      );
      expect(review.arm).toBe(arm);
      expect(review.source).toBe("authored");
      expect(review.model).toBe("hand-authored");
      expect(review.verdict).toBe("request_changes");
      expect(review.flags).toEqual([
        expect.objectContaining({
          type: "silenced_test",
          file: TEST_FILE,
          line: SKIP_LINE,
        }),
      ]);
    }
  });
});
