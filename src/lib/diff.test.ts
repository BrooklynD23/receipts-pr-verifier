import { describe, expect, it } from "vitest";

import { addedLines, parseDiff, type DiffFile } from "./diff";

describe("parseDiff", () => {
  it("parses a single hunk with correct add/del/ctx line numbers", () => {
    const text = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,3 +1,4 @@",
      " const a = 1;",
      "-const b = 2;",
      "+const b = 3;",
      "+const c = 4;",
      " const d = 5;",
    ].join("\n");
    const files = parseDiff(text);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: "src/a.ts",
      oldPath: "src/a.ts",
      binary: false,
    });
    expect(files[0].hunks).toHaveLength(1);
    expect(files[0].hunks[0]).toMatchObject({ oldStart: 1, newStart: 1 });
    expect(files[0].hunks[0].lines).toEqual([
      { kind: "ctx", text: " const a = 1;", oldLine: 1, newLine: 1 },
      { kind: "del", text: "-const b = 2;", oldLine: 2 },
      { kind: "add", text: "+const b = 3;", newLine: 2 },
      { kind: "add", text: "+const c = 4;", newLine: 3 },
      { kind: "ctx", text: " const d = 5;", oldLine: 3, newLine: 4 },
    ]);
  });

  it("parses multiple hunks in one file", () => {
    const text = [
      "diff --git a/f.ts b/f.ts",
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,2 +1,2 @@",
      "-old1",
      "+new1",
      "@@ -10,2 +10,3 @@",
      " ctx",
      "+added",
      " tail",
    ].join("\n");
    const files = parseDiff(text);
    expect(files[0].hunks).toHaveLength(2);
    expect(files[0].hunks[1]).toMatchObject({ oldStart: 10, newStart: 10 });
    expect(files[0].hunks[1].lines).toEqual([
      { kind: "ctx", text: " ctx", oldLine: 10, newLine: 10 },
      { kind: "add", text: "+added", newLine: 11 },
      { kind: "ctx", text: " tail", oldLine: 11, newLine: 12 },
    ]);
  });

  it("handles a new file (--- /dev/null) with oldPath null", () => {
    const text = [
      "diff --git a/new.ts b/new.ts",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,2 @@",
      "+a",
      "+b",
    ].join("\n");
    const files = parseDiff(text);
    expect(files[0].path).toBe("new.ts");
    expect(files[0].oldPath).toBeNull();
    expect(files[0].hunks[0].lines).toEqual([
      { kind: "add", text: "+a", newLine: 1 },
      { kind: "add", text: "+b", newLine: 2 },
    ]);
  });

  it("handles a deleted file (+++ /dev/null) with path = old path", () => {
    const text = [
      "diff --git a/old.ts b/old.ts",
      "--- a/old.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-a",
      "-b",
    ].join("\n");
    const files = parseDiff(text);
    expect(files[0].path).toBe("old.ts");
    expect(files[0].oldPath).toBe("old.ts");
    expect(files[0].hunks[0].lines).toEqual([
      { kind: "del", text: "-a", oldLine: 1 },
      { kind: "del", text: "-b", oldLine: 2 },
    ]);
  });

  it("marks binary files and keeps hunks empty", () => {
    const text = [
      "diff --git a/logo.png b/logo.png",
      "Binary files a/logo.png and b/logo.png differ",
    ].join("\n");
    const files = parseDiff(text);
    expect(files[0].binary).toBe(true);
    expect(files[0].hunks).toEqual([]);
    expect(files[0].path).toBe("logo.png");
  });

  it("skips the no-newline marker without affecting line numbers", () => {
    const text = [
      "diff --git a/f.ts b/f.ts",
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,2 +1,2 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
      "\\ No newline at end of file",
      " ctx",
    ].join("\n");
    const lines = parseDiff(text)[0].hunks[0].lines;
    expect(lines).toEqual([
      { kind: "del", text: "-old", oldLine: 1 },
      { kind: "add", text: "+new", newLine: 1 },
      { kind: "ctx", text: " ctx", oldLine: 2, newLine: 2 },
    ]);
  });

  it("handles CRLF line endings", () => {
    const text = [
      "diff --git a/f.ts b/f.ts",
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,1 +1,1 @@",
      "-x",
      "+y",
    ].join("\r\n");
    const files = parseDiff(text);
    expect(files[0].path).toBe("f.ts");
    expect(files[0].hunks[0].lines).toEqual([
      { kind: "del", text: "-x", oldLine: 1 },
      { kind: "add", text: "+y", newLine: 1 },
    ]);
  });

  it("keeps several diff --git blocks for the same path as separate entries", () => {
    const block = [
      "diff --git a/same.ts b/same.ts",
      "--- a/same.ts",
      "+++ b/same.ts",
      "@@ -1,1 +1,1 @@",
      "-x",
      "+y",
    ].join("\n");
    const files = parseDiff(`${block}\n${block}`);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("same.ts");
    expect(files[1].path).toBe("same.ts");
  });

  it("returns [] for an empty string", () => {
    expect(parseDiff("")).toEqual([]);
  });
});

describe("addedLines", () => {
  it("maps path to the set of new-file line numbers of add lines", () => {
    const text = [
      "diff --git a/f.ts b/f.ts",
      "--- a/f.ts",
      "+++ b/f.ts",
      "@@ -1,3 +1,4 @@",
      " ctx",
      "-del",
      "+add1",
      "+add2",
      " tail",
      "diff --git a/g.ts b/g.ts",
      "--- a/g.ts",
      "+++ b/g.ts",
      "@@ -5,1 +5,2 @@",
      " ctx",
      "+add3",
    ].join("\n");
    const result = addedLines(parseDiff(text));
    expect(result).toBeInstanceOf(Map);
    expect(result.get("f.ts")).toEqual(new Set([2, 3]));
    expect(result.get("g.ts")).toEqual(new Set([6]));
    expect(result.size).toBe(2);
  });

  it("omits files with no added lines and returns empty map for no files", () => {
    const files: DiffFile[] = [
      { path: "x.ts", oldPath: "x.ts", binary: false, hunks: [] },
    ];
    expect(addedLines(files).size).toBe(0);
    expect(addedLines([]).size).toBe(0);
  });

  it("merges line numbers across repeated blocks for one path", () => {
    const block = (n: number) =>
      [
        "diff --git a/s.ts b/s.ts",
        "--- a/s.ts",
        "+++ b/s.ts",
        `@@ -${n},0 +${n},1 @@`,
        "+line",
      ].join("\n");
    const result = addedLines(parseDiff(`${block(1)}\n${block(5)}`));
    expect(result.size).toBe(1);
    expect(result.get("s.ts")).toEqual(new Set([1, 5]));
  });
});
