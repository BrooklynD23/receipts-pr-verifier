import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { badgeFor } from "../src/lib/checker/badge";
import { check } from "../src/lib/checker";
import { Bundle, type CheckerFinding } from "../src/lib/schemas";

const Sha = z.string().regex(/^[0-9a-f]{7,40}$/, "must be 7-40 hex chars");
const Args = z.object({
  base: Sha,
  head: Sha,
  bundle: z.string().min(1),
  "fail-on": z.enum(["red", "amber", "none"]),
});

const MAX_BYTES = 60 * 1024;

export type Deps = {
  git: (base: string, head: string) => string;
  readFile: (path: string) => string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  env: Record<string, string | undefined>;
  writeSummary: (md: string) => void;
  stdout: (md: string) => void;
};

const esc = (s: string) =>
  s.replace(/[|`]/g, (c) => `\\${c}`).replace(/\n/g, " ");

export function toMarkdown(findings: readonly CheckerFinding[]): string {
  const rows = findings.map(
    (f) =>
      `| ${f.rule} | ${f.severity} | ${f.file ? esc(`${f.file}${f.line ? `:${f.line}` : ""}`) : ""} | ${esc(f.message)} |`,
  );
  const md = [
    `**Receipts badge: ${badgeFor(findings)}**`,
    "",
    "| Rule | Severity | Location | Message |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  return md.length > MAX_BYTES
    ? `${md.slice(0, MAX_BYTES)}\n\n_truncated_\n`
    : md;
}

function loadBundle(
  path: string,
  readFile: Deps["readFile"],
): { bundle: Bundle | null; error?: string } {
  let raw: string;
  try {
    raw = readFile(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { bundle: null };
    throw e;
  }
  try {
    const r = Bundle.safeParse(JSON.parse(raw));
    return r.success
      ? { bundle: r.data }
      : { bundle: null, error: r.error.message };
  } catch (e) {
    return { bundle: null, error: `invalid JSON: ${(e as Error).message}` };
  }
}

async function publish(md: string, deps: Deps): Promise<void> {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    PR_NUMBER: n,
  } = deps.env;
  if (token && repo && n) {
    const res = await deps.fetch(
      `https://api.github.com/repos/${repo}/issues/${n}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: md }),
      },
    );
    if (res.ok) return;
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`comment POST failed: ${res.status}`);
    }
  }
  // Fork PRs have a read-only token (403/404): degrade to the job summary.
  if (deps.env.GITHUB_STEP_SUMMARY) deps.writeSummary(md);
  else deps.stdout(md);
}

export async function run(argv: string[], deps: Deps): Promise<number> {
  let parsed;
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        base: { type: "string" },
        head: { type: "string" },
        bundle: { type: "string", default: ".receipts/bundle.json" },
        "fail-on": { type: "string", default: "red" },
      },
    });
    parsed = Args.parse(values);
  } catch (e) {
    deps.stdout(`bad args: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const diff = deps.git(parsed.base, parsed.head);
  const { bundle, error } = loadBundle(parsed.bundle, deps.readFile);
  const findings = check(diff, bundle).map((f) =>
    error && f.rule === "missing_bundle"
      ? { ...f, message: `${f.message} (${error})` }
      : f,
  );
  await publish(toMarkdown(findings), deps);
  const level = parsed["fail-on"];
  const failing = findings.some(
    (f) => level === "amber" || (level === "red" && f.severity === "red"),
  );
  return failing ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const env = process.env;
  run(process.argv.slice(2), {
    git: (b, h) =>
      execFileSync("git", ["diff", `${b}...${h}`], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      }),
    readFile: (p) => readFileSync(p, "utf8"),
    fetch: (u, i) => fetch(u, i),
    env,
    writeSummary: (m) => appendFileSync(env.GITHUB_STEP_SUMMARY as string, m),
    stdout: (m) => console.log(m),
  }).then(
    (c) => process.exit(c),
    (e) => {
      console.error(e instanceof Error ? e.message : "check-pr failed");
      process.exit(2);
    },
  );
}
