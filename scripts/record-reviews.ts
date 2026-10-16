import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { check } from "../src/lib/checker";
import { listFixtureDirs, loadPr } from "../src/lib/fixtures";
import { liveReview } from "../src/lib/reviewer";
import { createClient } from "../src/lib/reviewer/anthropic";
import type { ReviewFn } from "../src/lib/reviewer/replay";
import { Arm, ReviewResult } from "../src/lib/schemas";
import { effectiveDiff } from "../src/lib/workspace";

export type Deps = { review: ReviewFn; hasKey: boolean };

// Rough upper bound, no tokens counted: ~8k in + ~2k out per call.
const EST_USD_PER_CALL = 0.05;

// Exit codes: 0 ok, 1 call/validation failure, 2 usage or missing key.
export async function run(
  args: readonly string[],
  deps: Deps,
): Promise<number> {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...args],
      options: {
        dir: { type: "string", default: "fixtures/prs" },
        pr: { type: "string" },
        arm: { type: "string" },
        "dry-run": { type: "boolean", default: false },
      },
    }));
  } catch (e) {
    console.error(String(e));
    return 2;
  }
  const arms =
    values.arm === undefined ? Arm.options : Arm.safeParse(values.arm).data;
  if (arms === undefined) {
    console.error(`invalid --arm "${values.arm}" (A|B|C|D)`);
    return 2;
  }
  const dry = values["dry-run"];
  if (!dry && !deps.hasKey) {
    console.error("ANTHROPIC_API_KEY is not set; use --dry-run to preview");
    return 2;
  }

  const dir = values.dir;
  const ids = (await listFixtureDirs(dir)).filter(
    (id) => values.pr === undefined || id === values.pr,
  );
  const armList = Array.isArray(arms) ? arms : [arms];
  let calls = 0;
  for (const id of ids) {
    const pr = await loadPr(join(dir, id));
    const variants = pr.sabotage ? [false, true] : [false];
    for (const sabotaged of variants) {
      const sub = sabotaged ? "reviews-sabotaged" : "reviews";
      const findings = check(effectiveDiff(pr, sabotaged), pr.bundle);
      for (const arm of armList) {
        calls++;
        const path = join(dir, id, sub, `${arm}.json`);
        if (dry) {
          console.log(`would call ${id} ${sub}/${arm}`);
          continue;
        }
        try {
          const out = await deps.review({ pr, arm, sabotaged, findings });
          const result = ReviewResult.parse({
            ...out,
            source: "recorded",
            recorded_at: out.recorded_at ?? new Date().toISOString(),
          });
          await mkdir(join(dir, id, sub), { recursive: true });
          await writeFile(path, `${JSON.stringify(result, null, 2)}\n`);
          console.log(`wrote ${path}`);
        } catch (e) {
          console.error(`FAIL ${id} ${sub}/${arm}: ${String(e)}`);
          return 1;
        }
      }
    }
  }
  if (dry) {
    console.log(
      `${calls} calls planned, est. <= $${(calls * EST_USD_PER_CALL).toFixed(2)} (no tokens used)`,
    );
  }
  return 0;
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScript) {
  const hasKey = (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;
  const review = liveReview({ client: createClient });
  void run(process.argv.slice(2), { review, hasKey }).then((code) => {
    process.exitCode = code;
  });
}
