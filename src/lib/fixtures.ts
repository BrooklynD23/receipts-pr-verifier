import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  Arm,
  FixturePr,
  PR_IDS,
  type PrId,
  type ReviewResult,
} from "./schemas";

const ARMS = Arm.options; // ["A", "B", "C", "D"]

const isEnoent = (e: unknown): boolean =>
  typeof e === "object" &&
  e !== null &&
  (e as NodeJS.ErrnoException).code === "ENOENT";

// null when the file is absent; any other error (permissions, malformed
// path) still throws. JSON validity is the caller's problem.
const readTextOrNull = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if (isEnoent(e)) return null;
    throw e;
  }
};

// Reviews are validated later by FixturePr.parse; here we only collect the
// arms that exist on disk.
const readReviews = async (
  dir: string,
): Promise<Partial<Record<(typeof ARMS)[number], unknown>>> => {
  const reviews: Partial<Record<(typeof ARMS)[number], unknown>> = {};
  for (const arm of ARMS) {
    const text = await readTextOrNull(join(dir, `${arm}.json`));
    if (text !== null) reviews[arm] = JSON.parse(text);
  }
  return reviews;
};

// Loads one fixture dir (PLAN-01 §2 file list). Missing bundle.json ->
// bundle: null; missing reviews dirs -> omitted. Throws on malformed JSON
// or schema violations (FixturePr.parse is the boundary check).
export async function loadPr(dir: string): Promise<FixturePr> {
  const issue = await readFile(join(dir, "issue.md"), "utf8");
  const titleLine = issue.split(/\r?\n/).find((l) => l.startsWith("# "));
  if (titleLine === undefined) {
    throw new Error(`${dir}/issue.md has no "# " title line`);
  }

  const bundleText = await readTextOrNull(join(dir, "bundle.json"));
  const sabotageText = await readTextOrNull(join(dir, "sabotage.patch"));

  const candidate = {
    id: basename(dir),
    title: titleLine.slice(2).trim(),
    issue,
    diff: await readFile(join(dir, "diff.patch"), "utf8"),
    bundle: bundleText === null ? null : JSON.parse(bundleText),
    groundTruth: JSON.parse(
      await readFile(join(dir, "ground-truth.json"), "utf8"),
    ),
    reviews: await readReviews(join(dir, "reviews")),
    ...(sabotageText === null
      ? {}
      : {
          sabotage: {
            patch: sabotageText,
            reviews: await readReviews(join(dir, "reviews-sabotaged")),
          },
        }),
  };
  return FixturePr.parse(candidate);
}

// id is a PrId from the zod enum (API allowlist) — never raw user input —
// so the only paths reached are fixtures/prs/<pr-1|pr-2|pr-3>.
export async function loadDemoPr(id: PrId): Promise<FixturePr> {
  "use cache";
  return loadPr(join(process.cwd(), "fixtures/prs", id));
}

export async function listDemoPrs(): Promise<FixturePr[]> {
  "use cache";
  return Promise.all(PR_IDS.map((id) => loadDemoPr(id)));
}

// Re-exported so callers listing fixture subdirs share one implementation.
export async function listFixtureDirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export type { ReviewResult };
