import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { run, toMarkdown, type Deps } from "./check-pr";

const fx = (n: string) =>
  readFileSync(
    new URL(`./__fixtures__/check-pr/${n}`, import.meta.url),
    "utf8",
  );
const SHA = ["--base", "abc1234", "--head", "def5678"];
const TOKEN = "ghs_secrettoken123";

function mk(patch: string, over: Partial<Deps> = {}) {
  const out: string[] = [];
  const summary: string[] = [];
  const deps: Deps = {
    git: () => fx(patch),
    readFile: () => fx("bundle.json"),
    fetch: vi.fn(),
    env: {},
    writeSummary: (m) => summary.push(m),
    stdout: (m) => out.push(m),
    ...over,
  };
  return { deps, out, summary };
}

describe("check-pr run", () => {
  it("renders rule names and file:line to stdout without env", async () => {
    const { deps, out } = mk("silenced.patch");
    const code = await run(SHA, deps);
    const text = out.join("\n");
    expect(text).toContain("new_skip_marker");
    expect(text).toContain("tests/test_a.py:2");
    expect(code).toBe(1);
  });

  it("posts a comment with correct URL and headers", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 201 }));
    const { deps, out } = mk("silenced.patch", {
      fetch: fetchFn as unknown as Deps["fetch"],
      env: { GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: "o/r", PR_NUMBER: "7" },
    });
    await run(SHA, deps);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.github.com/repos/o/r/issues/7/comments");
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h.Accept).toBe("application/vnd.github+json");
    expect(out.join("")).not.toContain(TOKEN);
  });

  it("403 falls back to job summary and never leaks token", async () => {
    const { deps, out, summary } = mk("silenced.patch", {
      fetch: (async () => new Response("no", { status: 403 })) as Deps["fetch"],
      env: {
        GITHUB_TOKEN: TOKEN,
        GITHUB_REPOSITORY: "o/r",
        PR_NUMBER: "7",
        GITHUB_STEP_SUMMARY: "/x",
      },
    });
    await run(SHA, deps);
    expect(summary.join("")).toContain("new_skip_marker");
    expect([...out, ...summary].join("")).not.toContain(TOKEN);
  });

  it("rejects bad SHA with exit 2", async () => {
    const { deps } = mk("clean.patch");
    expect(await run(["--base", "x;rm", "--head", "def5678"], deps)).toBe(2);
  });

  it("invalid bundle yields missing_bundle finding with message", async () => {
    const { deps, out } = mk("clean.patch", { readFile: () => "{not json" });
    await run(SHA, deps);
    expect(out.join("\n")).toContain("missing_bundle");
  });

  it("missing bundle file is treated as null", async () => {
    const { deps, out } = mk("clean.patch", {
      readFile: () => {
        throw Object.assign(new Error("nf"), { code: "ENOENT" });
      },
    });
    await run(SHA, deps);
    expect(out.join("\n")).toContain("missing_bundle");
  });

  it("escapes pipes and backticks, truncates to 60KB", () => {
    const f = (file: string, message: string) =>
      ({ rule: "r", severity: "high", file, line: 3, message }) as never;
    const md = toMarkdown([f("a|b`a.py", "x|y")]);
    expect(md).toContain("a\\|b\\`a.py:3");
    expect(md).toContain("x\\|y");
    const big = toMarkdown(
      Array.from({ length: 2000 }, () => f("a.py", "m".repeat(100))),
    );
    expect(big).toContain("_truncated_");
    expect(big.length).toBeLessThanOrEqual(60 * 1024 + 20);
  });

  it.each([
    ["silenced.patch", "red", 1],
    ["silenced.patch", "amber", 1],
    ["silenced.patch", "none", 0],
    ["clean.patch", "red", 0],
    ["clean.patch", "amber", 0],
  ])("%s with --fail-on %s exits %i", async (patch, level, expected) => {
    const { deps } = mk(patch);
    expect(await run([...SHA, "--fail-on", level], deps)).toBe(expected);
  });
});
