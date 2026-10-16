import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { ReviewResponse } from "../src/lib/schemas";

const DemoUrl = z
  .string()
  .url()
  .refine((u) => {
    const { protocol, hostname } = new URL(u);
    return (
      protocol === "https:" ||
      (protocol === "http:" && ["localhost", "127.0.0.1"].includes(hostname))
    );
  }, "must be https:// or http://localhost:<port>");

type FetchImpl = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const TIMEOUT_MS = 10_000;

export async function run(
  env: Record<string, string | undefined>,
  fetchImpl: FetchImpl = fetch,
  log: (line: string) => void = console.log,
): Promise<number> {
  const parsed = DemoUrl.safeParse(env.DEMO_URL);
  if (!parsed.success) {
    log(
      env.DEMO_URL
        ? `DEMO_URL invalid: ${parsed.error.issues[0]?.message}`
        : "set DEMO_URL (e.g. https://<app>.vercel.app)",
    );
    return 2;
  }
  const base = parsed.data.replace(/\/+$/, "");
  const call = (path: string, body?: unknown) =>
    fetchImpl(`${base}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });

  const page =
    (path: string, needles: string[] = []) =>
    async () => {
      const res = await call(path);
      if (res.status !== 200) throw new Error(`status ${res.status}`);
      const text = await res.text();
      for (const n of needles) {
        if (!text.includes(n)) throw new Error(`missing "${n}"`);
      }
    };

  const checks: [string, () => Promise<void>][] = [
    ["GET /", page("/", ["Receipts PR Verifier", "pr-1"])],
    ["GET /pr/pr-1", page("/pr/pr-1")],
    ["GET /results", page("/results")],
    [
      "POST /api/review",
      async () => {
        const res = await call("/api/review", {
          prId: "pr-1",
          arm: "D",
          sabotaged: false,
        });
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        ReviewResponse.parse(await res.json());
      },
    ],
    [
      "POST /api/review bad id -> 400",
      async () => {
        const res = await call("/api/review", { prId: "../etc" });
        if (res.status !== 400) throw new Error(`status ${res.status}`);
      },
    ],
  ];

  let failed = 0;
  for (const [name, check] of checks) {
    try {
      await check();
      log(`PASS ${name}`);
    } catch (e) {
      failed += 1;
      log(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return failed ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run(process.env).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(e);
      process.exitCode = 1;
    },
  );
}
