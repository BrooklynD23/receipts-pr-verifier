import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { run } from "./smoke";

const result = JSON.parse(
  readFileSync("fixtures/prs/pr-1/reviews/D.json", "utf8"),
);
const ok = { result, mode: "replay" };

function fakeFetch(overrides: { fail?: string } = {}) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const body = init?.body ? String(init.body) : "";
    if (overrides.fail === path) return new Response("boom", { status: 500 });
    if (path === "/") {
      return new Response("<html>Receipts PR Verifier pr-1</html>");
    }
    if (path === "/api/review") {
      return body.includes("../etc")
        ? new Response('{"error":"bad"}', { status: 400 })
        : new Response(JSON.stringify(ok));
    }
    return new Response("ok");
  };
}

const quiet = () => {};

describe("smoke run", () => {
  it("exits 0 when all checks pass", async () => {
    const code = await run(
      { DEMO_URL: "https://app.vercel.app" },
      fakeFetch(),
      quiet,
    );
    expect(code).toBe(0);
  });

  it("exits 1 when one check returns 500", async () => {
    const code = await run(
      { DEMO_URL: "https://app.vercel.app" },
      fakeFetch({ fail: "/results" }),
      quiet,
    );
    expect(code).toBe(1);
  });

  it("exits 1 when fetch throws", async () => {
    const code = await run(
      { DEMO_URL: "https://app.vercel.app" },
      async () => {
        throw new Error("net");
      },
      quiet,
    );
    expect(code).toBe(1);
  });

  it("exits 2 when DEMO_URL missing", async () => {
    const lines: string[] = [];
    const code = await run({}, fakeFetch(), (l) => lines.push(l));
    expect(code).toBe(2);
    expect(lines.join("\n")).toContain("set DEMO_URL");
  });

  it("rejects non-https remote URL", async () => {
    expect(
      await run({ DEMO_URL: "http://example.com" }, fakeFetch(), quiet),
    ).toBe(2);
  });

  it("allows http localhost", async () => {
    expect(
      await run({ DEMO_URL: "http://localhost:3000" }, fakeFetch(), quiet),
    ).toBe(0);
  });
  it("CLI entry exits 2 with 'set DEMO_URL' when unset", () => {
    const { DEMO_URL: _omit, ...env } = process.env;
    const r = spawnSync("npx", ["tsx", "scripts/smoke.ts"], {
      env,
      encoding: "utf8",
    });
    expect(r.status).toBe(2);
    expect(r.stdout).toContain("set DEMO_URL");
  }, 60000);
});
