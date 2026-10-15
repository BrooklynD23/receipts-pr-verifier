import type { DiffFile, DiffLine } from "@/lib/diff";
import type { CheckerFinding } from "@/lib/schemas";

// Duplicated from Matrix (T04.3) on purpose: the two files must stay disjoint,
// so the 1-line anchorId helper is copied here instead of imported.
const anchorId = (path: string, side: "n" | "o", line: number): string =>
  `L-${encodeURIComponent(path)}-${side}${line}`;

const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "-", ctx: " " };

const FLAG_CLASS: Record<CheckerFinding["severity"], string> = {
  red: "bg-red-100",
  amber: "bg-amber-100",
};

export function DiffView({
  files,
  findings,
}: {
  files: DiffFile[];
  findings: CheckerFinding[];
}) {
  // Line-anchored findings only: `${file}|${side}|${line}` -> findings.
  // Findings without file/line are file-level and shown in Matrix's panel.
  const byLine = new Map<string, CheckerFinding[]>();
  for (const f of findings) {
    if (f.file === undefined || f.line === undefined) continue;
    const key = `${f.file}|${f.side ?? "new"}|${f.line}`;
    const list = byLine.get(key);
    if (list) list.push(f);
    else byLine.set(key, [f]);
  }

  return (
    <div>
      <style>{".diff-line:target{background-color:#fde68a}"}</style>
      {files.map((file) => (
        <section key={file.path}>
          <h3>
            {file.oldPath && file.oldPath !== file.path
              ? `${file.oldPath} → ${file.path}`
              : file.path}
          </h3>
          {file.binary ? (
            <p>Binary file not shown</p>
          ) : (
            <table>
              <caption className="sr-only">Diff of {file.path}</caption>
              <thead>
                <tr>
                  <th scope="col">old</th>
                  <th scope="col">new</th>
                  <th scope="col"></th>
                  <th scope="col">line</th>
                </tr>
              </thead>
              <tbody>
                {file.hunks.map((hunk, hi) =>
                  hunk.lines.map((line, li) => {
                    const del = line.kind === "del";
                    const num = del ? line.oldLine : line.newLine;
                    const id = anchorId(file.path, del ? "o" : "n", num ?? 0);
                    const hits =
                      num === undefined
                        ? []
                        : (byLine.get(
                            `${file.path}|${del ? "old" : "new"}|${num}`,
                          ) ?? []);
                    const flagged = hits.length > 0;
                    const noteId = `note-${id}`;
                    return (
                      <tr
                        key={`${hi}-${li}`}
                        id={id}
                        className={
                          flagged
                            ? `diff-line ${FLAG_CLASS[hits.some((h) => h.severity === "red") ? "red" : "amber"]}`
                            : "diff-line"
                        }
                        aria-describedby={flagged ? noteId : undefined}
                      >
                        <td>{line.oldLine ?? ""}</td>
                        <td>{line.newLine ?? ""}</td>
                        <td>{SIGN[line.kind]}</td>
                        <td>
                          {/* untrusted diff text: React children only, never dangerouslySetInnerHTML */}
                          {line.text.slice(1)}
                          {flagged ? (
                            <span id={noteId} role="note">
                              {" "}
                              {hits.map((h) => h.message).join("; ")}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
