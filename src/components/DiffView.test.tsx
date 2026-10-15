import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DiffFile } from "@/lib/diff";
import type { CheckerFinding } from "@/lib/schemas";
import { DiffView } from "./DiffView";

const files: DiffFile[] = [
  {
    path: "src/a.ts",
    oldPath: "src/a.ts",
    binary: false,
    hunks: [
      {
        oldStart: 1,
        newStart: 1,
        lines: [
          { kind: "ctx", text: " const a = 1;", oldLine: 1, newLine: 1 },
          { kind: "del", text: "-const b = 2;", oldLine: 2 },
          { kind: "add", text: "+const b = 3;", newLine: 2 },
        ],
      },
    ],
  },
];

const render = (fs: DiffFile[], findings: CheckerFinding[] = []) =>
  renderToStaticMarkup(<DiffView files={fs} findings={findings} />);

describe("DiffView", () => {
  it("anchors rows: ctx/add -> n<newLine>, del -> o<oldLine>", () => {
    const html = render(files);
    expect(html).toContain('id="L-src%2Fa.ts-n1"');
    expect(html).toContain('id="L-src%2Fa.ts-o2"');
    expect(html).toContain('id="L-src%2Fa.ts-n2"');
  });

  it("renders old/new numbers and +/-/space markers", () => {
    const html = render(files);
    expect(html).toContain("<td>1</td><td>1</td><td> </td>");
    expect(html).toContain("<td>2</td><td></td><td>-</td>");
    expect(html).toContain("<td></td><td>2</td><td>+</td>");
    expect(html).toContain("const b = 3;");
  });

  it("flags matching rows: highlight + aria-describedby -> inline note", () => {
    const findings: CheckerFinding[] = [
      {
        rule: "new_skip_marker",
        severity: "red",
        file: "src/a.ts",
        line: 2,
        side: "new",
        message: "added skip marker",
      },
      {
        rule: "assert_removed",
        severity: "red",
        file: "src/a.ts",
        line: 2,
        side: "old",
        message: "assertion removed",
      },
    ];
    const html = render(files, findings);
    expect(html).toContain('aria-describedby="note-L-src%2Fa.ts-n2"');
    expect(html).toContain('id="note-L-src%2Fa.ts-n2"');
    expect(html).toContain("added skip marker");
    expect(html).toContain('aria-describedby="note-L-src%2Fa.ts-o2"');
    expect(html).toContain("assertion removed");
    expect(html).toContain(".diff-line:target");
  });

  it("does not flag unflagged rows or unmatched findings", () => {
    const findings: CheckerFinding[] = [
      {
        rule: "out_of_scope",
        severity: "amber",
        file: "src/other.ts",
        line: 9,
        message: "out of scope",
      },
    ];
    const html = render(files, findings);
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("out of scope"); // unmatched line -> no note
  });

  it("escapes <script> text in diff lines", () => {
    const evil: DiffFile[] = [
      {
        path: "evil.html",
        oldPath: "evil.html",
        binary: false,
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: [
              {
                kind: "add",
                text: "+<script>alert(1)</script>",
                newLine: 1,
              },
            ],
          },
        ],
      },
    ];
    const html = render(evil);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("shows placeholder for binary files", () => {
    const bin: DiffFile[] = [
      { path: "img.png", oldPath: "img.png", binary: true, hunks: [] },
    ];
    const html = render(bin);
    expect(html).toContain("Binary file not shown");
    expect(html).not.toContain("<table");
  });
});
