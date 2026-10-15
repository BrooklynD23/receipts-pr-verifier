import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { listFixtureDirs, loadPr } from "../src/lib/fixtures";

export type ValidateResult = {
  id: string;
  ok: boolean;
  error?: string;
};

// Loads every subdirectory of `dir` as a fixture PR. Prints `OK <id>` or
// `FAIL <id>: <zod error>`; returns one result per subdir (never throws on
// a bad fixture — a non-ENOENT dir error still propagates).
export async function validateDir(dir: string): Promise<ValidateResult[]> {
  const results: ValidateResult[] = [];
  for (const id of await listFixtureDirs(dir)) {
    try {
      const pr = await loadPr(`${dir}/${id}`);
      console.log(`OK ${pr.id}`);
      results.push({ id, ok: true });
    } catch (e) {
      const error = e instanceof z.ZodError ? z.prettifyError(e) : String(e);
      console.error(`FAIL ${id}: ${error}`);
      results.push({ id, ok: false, error });
    }
  }
  return results;
}

export async function main(argv: readonly string[]): Promise<void> {
  const dir = argv[0] ?? "fixtures/prs";
  const results = await validateDir(dir);
  if (results.some((r) => !r.ok)) {
    process.exitCode = 1;
  }
}

const invokedAsScript =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScript) {
  void main(process.argv.slice(2));
}
