import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { aggregate, scoreReview, type ScoredCase } from "../src/lib/eval";
import { listFixtureDirs, loadPr } from "../src/lib/fixtures";
import { Arm } from "../src/lib/schemas";

const Args = z.object({
  dir: z.string().min(1).default("fixtures/prs"),
  out: z.string().min(1).default("fixtures/eval/results.json"),
});
export type EvalArgs = z.input<typeof Args>;

export async function run(input: EvalArgs) {
  const args = Args.parse(input);
  const scored: ScoredCase[] = [];
  const sources = { authored: 0, recorded: 0, live: 0 };
  let cases = 0;
  for (const id of await listFixtureDirs(args.dir)) {
    const pr = await loadPr(`${args.dir}/${id}`);
    const variants = [
      { faults: pr.groundTruth.faults, reviews: pr.reviews },
      ...(pr.sabotage && pr.groundTruth.sabotaged
        ? [
            {
              faults: pr.groundTruth.sabotaged.faults,
              reviews: pr.sabotage.reviews,
            },
          ]
        : []),
    ];
    for (const v of variants) {
      cases += 1;
      for (const arm of Arm.options) {
        const review = v.reviews[arm];
        if (!review) continue;
        scored.push({
          arm,
          faults: v.faults,
          score: scoreReview(v.faults, review),
        });
        // fallback reviews are recorded outputs served on failure
        const src = review.source === "fallback" ? "recorded" : review.source;
        sources[src] += 1;
      }
    }
  }
  const results = {
    generated_at: new Date().toISOString(),
    dir: args.dir,
    cases,
    sources,
    ...aggregate(scored),
  };
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, JSON.stringify(results, null, 2) + "\n");
  return results;
}

export function parseArgv(argv: readonly string[]): EvalArgs {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key?.startsWith("--") || val === undefined) {
      throw new Error(`bad args near "${key ?? ""}"`);
    }
    out[key.slice(2)] = val;
  }
  return out;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run(parseArgv(process.argv.slice(2))).then(
    (r) => console.log(`scored ${r.cases} cases`),
    (e) => {
      console.error(e instanceof z.ZodError ? z.prettifyError(e) : String(e));
      process.exitCode = 1;
    },
  );
}
