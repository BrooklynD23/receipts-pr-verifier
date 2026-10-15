export type DiffLine = {
  kind: "add" | "del" | "ctx";
  text: string;
  oldLine?: number;
  newLine?: number;
};

export type Hunk = {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
};

export type DiffFile = {
  path: string;
  oldPath: string | null;
  binary: boolean;
  hunks: Hunk[];
};

const stripPrefix = (p: string): string => p.replace(/^[ab]\//, "");

// ponytail: hand parser; switch to parse-diff 0.12.0 if renames/combined diffs appear
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  for (const line of text.split(/\r?\n/)) {
    const git = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (git) {
      file = { path: git[2], oldPath: git[1], binary: false, hunks: [] };
      files.push(file);
      hunk = null;
    } else if (file && file.hunks.length === 0 && line.startsWith("--- ")) {
      file.oldPath =
        line === "--- /dev/null" ? null : stripPrefix(line.slice(4));
    } else if (file && file.hunks.length === 0 && line.startsWith("+++ ")) {
      file.path =
        line === "+++ /dev/null"
          ? (file.oldPath ?? file.path)
          : stripPrefix(line.slice(4));
    } else if (file && line.startsWith("Binary files")) {
      file.binary = true;
    } else if (file && line.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
        hunk = { oldStart: oldNo, newStart: newNo, lines: [] };
        file.hunks.push(hunk);
      }
    } else if (hunk) {
      if (line === "" || line.startsWith("\\")) continue;
      const kind = line[0] === "+" ? "add" : line[0] === "-" ? "del" : "ctx";
      const l: DiffLine = { kind, text: line };
      if (kind !== "add") l.oldLine = oldNo++;
      if (kind !== "del") l.newLine = newNo++;
      hunk.lines.push(l);
    }
  }
  return files;
}

export function addedLines(files: DiffFile[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const f of files) {
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.kind === "add" && l.newLine !== undefined) {
          let s = map.get(f.path);
          if (!s) map.set(f.path, (s = new Set()));
          s.add(l.newLine);
        }
      }
    }
  }
  return map;
}
