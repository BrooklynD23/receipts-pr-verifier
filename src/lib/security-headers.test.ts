import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

const get = (isProd: boolean, key: string) =>
  securityHeaders(isProd).find((h) => h.key === key)?.value ?? "";

describe("securityHeaders", () => {
  it("prod CSP forbids unsafe-eval and framing", () => {
    const csp = get(true, "Content-Security-Policy");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
  });
  it("dev CSP allows unsafe-eval", () => {
    expect(get(false, "Content-Security-Policy")).toContain("'unsafe-eval'");
  });
  it("includes all 4 headers", () => {
    expect(
      securityHeaders(true)
        .map((h) => h.key)
        .sort(),
    ).toEqual([
      "Content-Security-Policy",
      "Permissions-Policy",
      "Referrer-Policy",
      "X-Content-Type-Options",
    ]);
    expect(get(true, "X-Content-Type-Options")).toBe("nosniff");
    expect(get(true, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(get(true, "Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });
});
