import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PR_IDS, ReviewResponse } from "@/lib/schemas";

import { POST } from "./route";

const boom = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/fixtures", async (orig) => {
  const actual = await orig<typeof import("@/lib/fixtures")>();
  return {
    ...actual,
    loadDemoPr: (...a: Parameters<typeof actual.loadDemoPr>) => {
      if (boom.on) throw new TypeError("secret-key-sk-123 prompt data");
      return actual.loadDemoPr(...a);
    },
  };
});

// The rate limiter is module-level: every test uses a fresh client IP so the
// 10-per-minute window never leaks between tests.
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `10.99.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function req(
  body: unknown,
  opts: { ip?: string; contentType?: string } = {},
): Request {
  return new Request("https://demo.test/api/review", {
    method: "POST",
    headers: {
      "content-type": opts.contentType ?? "application/json",
      "x-forwarded-for": opts.ip ?? uniqueIp(),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = { prId: "pr-1", arm: "A", sabotaged: false };

beforeEach(() => {
  // Force replay mode regardless of ambient env so tests never hit Claude.
  vi.stubEnv("REVIEWER_MODE", "replay");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  boom.on = false;
});

describe("POST /api/review", () => {
  it.each(PR_IDS)(
    "returns a valid ReviewResponse in replay mode for %s",
    async (prId) => {
      const res = await POST(req({ ...VALID, prId }));
      expect(res.status).toBe(200);

      const parsed = ReviewResponse.safeParse(await res.json());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.mode).toBe("replay");
        expect(parsed.data.result.arm).toBe("A");
      }
    },
  );

  it("accepts a sabotaged review request for pr-1", async () => {
    const res = await POST(req({ ...VALID, sabotaged: true }));
    expect(res.status).toBe(200);
    const parsed = ReviewResponse.safeParse(await res.json());
    expect(parsed.success).toBe(true);
  });

  it.each([
    ["an extra key", { ...VALID, extra: 1 }],
    ["an unknown prId", { ...VALID, prId: "pr-99" }],
    ["sabotage on pr-2", { ...VALID, prId: "pr-2", sabotaged: true }],
    ["a bad arm", { ...VALID, arm: "E" }],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid request" });
  });

  it("does not echo the rejected input", async () => {
    const res = await POST(req({ ...VALID, prId: "pr-99", marker: "XYZZY" }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("XYZZY");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid request" });
  });

  it("returns 415 for a non-JSON content type", async () => {
    const res = await POST(req(VALID, { contentType: "text/plain" }));
    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("returns 413 for a body over 1 KB", async () => {
    const res = await POST(req("x".repeat(2049)));
    expect(res.status).toBe(413);
  });

  it("accepts a body at exactly 1 KB", async () => {
    // pad the request so the encoded body is exactly 1024 bytes
    const base = JSON.stringify(VALID);
    const padLen = 1024 - base.length;
    const body = `{"prId":"pr-1","arm":"A","sabotaged":false,"x":"${"y".repeat(
      padLen - ',"x":""'.length,
    )}"}`;
    // sanity: the body must be exactly 1024 bytes
    expect(new TextEncoder().encode(body).length).toBe(1024);
    // extra key -> still a 400, not a 413
    const res = await POST(req(body));
    expect(res.status).toBe(400);
  });

  it("returns 429 with Retry-After after 10 calls from one IP", async () => {
    const ip = uniqueIp();
    const body = { prId: "pr-3", arm: "A", sabotaged: false };
    for (let i = 0; i < 10; i += 1) {
      const res = await POST(req(body, { ip }));
      expect(res.status).toBe(200);
    }
    const res = await POST(req(body, { ip }));
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("retry-after");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("does not count requests rejected before the rate-limit check", async () => {
    const ip = uniqueIp();
    // 10 invalid requests must not exhaust the window for this IP
    for (let i = 0; i < 10; i += 1) {
      await POST(req("{bad", { ip }));
    }
    const res = await POST(req(VALID, { ip }));
    expect(res.status).toBe(200);
  });

  it("returns 500 with a static body and logs only the error name", async () => {
    boom.on = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req(VALID));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "internal error" });
    expect(text).not.toContain("pr-1");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain("TypeError");
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("secret");
  });

  it("exports only POST as an HTTP method handler", async () => {
    const mod = await import("./route");
    const handlers = [
      "GET",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ].filter((m) => m in mod);
    expect(handlers).toEqual([]);
  });
});
