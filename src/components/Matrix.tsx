import type {
  Bundle,
  CheckerFinding,
  ReviewResult,
  SourceLabel,
} from "../lib/schemas";

// Diff anchor format, shared with DiffView (T04.4):
//   L-<encodeURIComponent(file)>-<n|o><line>
// "n" = new-file side, "o" = old-file side (removed lines). DiffView
// deliberately duplicates this helper instead of importing it (the wave keeps
// the two files disjoint) — if this format changes, change it there too.
export function anchorId(
  file: string,
  side: "new" | "old",
  line: number,
): string {
  return `L-${encodeURIComponent(file)}-${side === "old" ? "o" : "n"}${line}`;
}

export type MatrixProps = {
  requirements: Bundle["requirements"];
  review: ReviewResult;
  findings: CheckerFinding[];
  sourceLabel: SourceLabel;
};

const SEVERITY_TEXT: Record<CheckerFinding["severity"], string> = {
  red: "Red flag",
  amber: "Amber",
};

const STATUS_TEXT: Record<ReviewResult["rows"][number]["status"], string> = {
  met: "met",
  unmet: "unmet",
  unclear: "unclear",
};

export function Matrix({
  requirements,
  review,
  findings,
  sourceLabel,
}: MatrixProps) {
  const rowsByReq = new Map(review.rows.map((r) => [r.req_id, r]));
  const unmapped = new Set(
    findings
      .filter((f) => f.rule === "unmapped_requirement")
      .map((f) => f.req_id),
  );

  return (
    <section aria-label="Requirement evidence and checker findings">
      <table className="w-full border-collapse text-sm">
        <caption className="py-2 text-left font-semibold">
          Requirement → evidence matrix
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border-b p-2 text-left">
              Requirement
            </th>
            <th scope="col" className="border-b p-2 text-left">
              Reviewer status{" "}
              <span className="ml-1 rounded border border-gray-400 px-1 text-xs font-semibold">
                {sourceLabel}
              </span>
            </th>
            <th scope="col" className="border-b p-2 text-left">
              Evidence
            </th>
            <th scope="col" className="border-b p-2 text-left">
              Checker
            </th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((req) => {
            const row = rowsByReq.get(req.id);
            return (
              <tr key={req.id}>
                <td className="border-b p-2 align-top">
                  <span className="font-semibold">{req.id}</span> {req.text}
                </td>
                <td className="border-b p-2 align-top">
                  {row === undefined ? "—" : STATUS_TEXT[row.status]}
                  {row !== undefined && row.note !== "" && (
                    <span className="block text-xs text-gray-700">
                      {row.note}
                    </span>
                  )}
                </td>
                <td className="border-b p-2 align-top">
                  {row !== undefined && row.evidence.length > 0 ? (
                    <ul>
                      {row.evidence.map((e, i) => (
                        <li key={`${e.file}-${e.line_start}-${i}`}>
                          <a
                            className="text-blue-700 underline"
                            href={`#${anchorId(e.file, "new", e.line_start)}`}
                          >
                            {e.file}:{e.line_start}
                            {e.line_end !== e.line_start && `–${e.line_end}`}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="border-b p-2 align-top">
                  {unmapped.has(req.id) ? "Missing evidence" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section aria-label="Reviewer result">
        <h3 className="mt-4 font-semibold">Reviewer verdict</h3>
        <p>{review.verdict}</p>
        <h3 className="mt-2 font-semibold">Reviewer flags</h3>
        {review.flags.length === 0 ? (
          <p>No reviewer flags.</p>
        ) : (
          <ul className="list-disc pl-5">
            {review.flags.map((flag, i) => (
              <li key={`${flag.type}-${flag.file}-${flag.line}-${i}`}>
                <span className="font-semibold">{flag.type}</span>:{" "}
                {flag.reason}{" "}
                {flag.line > 0 ? (
                  <a
                    className="text-blue-700 underline"
                    href={`#${anchorId(flag.file, "new", flag.line)}`}
                  >
                    {flag.file}:{flag.line}
                  </a>
                ) : (
                  <span>({flag.file})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Checker findings">
        <h3 className="mt-4 font-semibold">Checker findings</h3>
        {findings.length === 0 ? (
          <p>No checker findings</p>
        ) : (
          <ul className="list-disc pl-5">
            {findings.map((f, i) => (
              <li key={`${f.rule}-${f.file ?? ""}-${f.line ?? ""}-${i}`}>
                <span className="font-semibold">
                  {SEVERITY_TEXT[f.severity]}
                </span>{" "}
                <span className="font-mono text-xs">{f.rule}</span>: {f.message}{" "}
                {f.file !== undefined && f.line !== undefined && (
                  <a
                    className="text-blue-700 underline"
                    href={`#${anchorId(f.file, f.side ?? "new", f.line)}`}
                  >
                    {f.file}:{f.line}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
