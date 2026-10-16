import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { Arm, FaultType } from "../../lib/schemas";

const Cell = z.object({ detected: z.number(), total: z.number() });
const Results = z.object({
  cases: z.number(),
  sources: z.object({
    authored: z.number(),
    recorded: z.number(),
    live: z.number(),
  }),
  table: z.partialRecord(FaultType, z.record(Arm, Cell)),
  falseFlagRate: z.record(Arm, z.number()),
});

async function load() {
  "use cache";
  try {
    const text = await readFile(
      join(process.cwd(), "fixtures/eval/results.json"),
      "utf8",
    );
    return Results.parse(JSON.parse(text));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export default async function ResultsPage() {
  const r = await load();
  if (!r) return <p>No results yet</p>;
  const { authored, recorded, live } = r.sources;
  const mix = [
    authored && "hand-authored samples",
    recorded && "recorded outputs",
    live && "live outputs",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <h1 className="text-2xl font-semibold">Detection results</h1>
      <table className="mt-4 w-full text-left text-sm">
        <caption className="mb-2 text-left">
          Demo set: {r.cases} cases, {mix} — not a benchmark
        </caption>
        <thead>
          <tr>
            <th scope="col">Fault type</th>
            {Arm.options.map((a) => (
              <th key={a} scope="col">
                Arm {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(r.table).map(([type, row]) => (
            <tr key={type}>
              <th scope="row">{type}</th>
              {Arm.options.map((a) => (
                <td key={a}>
                  {row[a].detected}/{row[a].total}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">false flags per case</th>
            {Arm.options.map((a) => (
              <td key={a}>{r.falseFlagRate[a].toFixed(2)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
}
