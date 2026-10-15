export interface RateLimiterOptions {
  /** Maximum allowed calls per key per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Clock, injectable for tests. Defaults to Date.now. */
  now?: () => number;
}

export type RateLimitResult =
  { ok: true } | { ok: false; retryAfterSec: number };

export interface RateLimiter {
  check(key: string): RateLimitResult;
  /** Number of tracked keys; exposed so tests can verify bounded memory. */
  size(): number;
}

const MAX_TRACKED_KEYS = 10_000;

interface WindowEntry {
  start: number;
  count: number;
}

/**
 * Fixed-window, per-key rate limiter.
 */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  // ponytail: per-instance Map, resets on cold start; Vercel WAF rule (HUMAN-04) is the real limit.
  const windows = new Map<string, WindowEntry>();

  function evictExpired(current: number): void {
    for (const [key, entry] of windows) {
      if (current - entry.start >= windowMs) {
        windows.delete(key);
      }
    }
  }

  function check(key: string): RateLimitResult {
    const current = now();
    if (windows.size > MAX_TRACKED_KEYS) {
      evictExpired(current);
    }

    const entry = windows.get(key);
    if (entry === undefined || current - entry.start >= windowMs) {
      windows.set(key, { start: current, count: 1 });
      return { ok: true };
    }

    if (entry.count < limit) {
      entry.count += 1;
      return { ok: true };
    }

    const retryAfterSec = Math.ceil((entry.start + windowMs - current) / 1000);
    return { ok: false, retryAfterSec };
  }

  function size(): number {
    return windows.size;
  }

  return { check, size };
}

/**
 * Client IP from proxy headers: the first comma-separated value of
 * `x-forwarded-for`, trimmed; `"unknown"` when absent or empty.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded === null) {
    return "unknown";
  }
  const first = forwarded.split(",")[0]?.trim() ?? "";
  return first.length > 0 ? first : "unknown";
}
