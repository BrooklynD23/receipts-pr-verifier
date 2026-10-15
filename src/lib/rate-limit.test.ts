import { describe, expect, it } from "vitest";

import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows `limit` calls then blocks", () => {
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 60_000,
      now: () => 0,
    });
    expect(limiter.check("ip")).toEqual({ ok: true });
    expect(limiter.check("ip")).toEqual({ ok: true });
    expect(limiter.check("ip")).toEqual({ ok: true });
    expect(limiter.check("ip").ok).toBe(false);
  });

  it("returns retryAfterSec > 0 and <= the window in seconds", () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
    });
    limiter.check("ip");
    const blocked = limiter.check("ip");
    if (blocked.ok) throw new Error("expected request to be blocked");
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("resets after the window passes (fake now)", () => {
    let now = 0;
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1_000,
      now: () => now,
    });
    expect(limiter.check("ip").ok).toBe(true);
    expect(limiter.check("ip").ok).toBe(false);
    now = 1_000;
    expect(limiter.check("ip")).toEqual({ ok: true });
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
    });
    limiter.check("a");
    expect(limiter.check("a").ok).toBe(false);
    expect(limiter.check("b").ok).toBe(true);
  });

  it("evicts expired entries once the map exceeds 10,000 keys", () => {
    let now = 0;
    const limiter = createRateLimiter({
      limit: 5,
      windowMs: 1_000,
      now: () => now,
    });
    for (let i = 0; i <= 10_000; i += 1) {
      limiter.check(`ip-${i}`);
    }
    expect(limiter.size()).toBe(10_001);
    now = 2_000;
    limiter.check("fresh");
    expect(limiter.size()).toBe(1);
  });

  it("does not evict entries still inside their window", () => {
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => 0,
    });
    for (let i = 0; i <= 10_000; i += 1) {
      limiter.check(`ip-${i}`);
    }
    limiter.check("one-more");
    expect(limiter.size()).toBe(10_002);
  });
});

describe("clientIp", () => {
  it("returns the first comma-separated x-forwarded-for value, trimmed", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(headers)).toBe("1.2.3.4");
  });

  it("trims a single value", () => {
    const headers = new Headers({ "x-forwarded-for": "  9.9.9.9  " });
    expect(clientIp(headers)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when the header is missing", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("returns 'unknown' when the first value is empty", () => {
    const headers = new Headers({ "x-forwarded-for": "   " });
    expect(clientIp(headers)).toBe("unknown");
  });
});
