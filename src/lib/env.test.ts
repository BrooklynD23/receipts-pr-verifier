import { describe, expect, it } from "vitest";

import { readEnv } from "./env";

describe("readEnv", () => {
  it("defaults to replay with no env vars", () => {
    expect(readEnv({})).toEqual({ mode: "replay", hasKey: false });
  });

  it("returns live only when REVIEWER_MODE=live and a key is set", () => {
    expect(
      readEnv({ REVIEWER_MODE: "live", ANTHROPIC_API_KEY: "sk-ant-test" }),
    ).toEqual({ mode: "live", hasKey: true });
  });

  it("treats unknown REVIEWER_MODE values as replay", () => {
    expect(
      readEnv({ REVIEWER_MODE: "bogus", ANTHROPIC_API_KEY: "sk-ant-test" })
        .mode,
    ).toBe("replay");
  });

  it("treats live mode without a key as replay", () => {
    expect(readEnv({ REVIEWER_MODE: "live" })).toEqual({
      mode: "replay",
      hasKey: false,
    });
  });

  it("treats an empty key as no key", () => {
    expect(readEnv({ REVIEWER_MODE: "live", ANTHROPIC_API_KEY: "" })).toEqual({
      mode: "replay",
      hasKey: false,
    });
    expect(
      readEnv({ REVIEWER_MODE: "live", ANTHROPIC_API_KEY: "   " }),
    ).toEqual({ mode: "replay", hasKey: false });
  });

  it("never returns the key value", () => {
    const result = readEnv({
      REVIEWER_MODE: "live",
      ANTHROPIC_API_KEY: "sk-ant-secret",
    });
    expect(result).not.toHaveProperty("key");
    expect(result).not.toHaveProperty("apiKey");
    expect(JSON.stringify(result)).not.toContain("sk-ant-secret");
  });
});
