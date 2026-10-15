import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import type { ReviewOutput } from "../schemas";
import {
  CHEAP_MODEL,
  callClaude,
  createClient,
  PRIMARY_MODEL,
  ReviewerError,
  type ParseClient,
} from "./anthropic";

const VALID_OUTPUT: ReviewOutput = {
  rows: [
    {
      req_id: "R1",
      status: "met",
      evidence: [{ file: "src/a.ts", line_start: 1, line_end: 3 }],
      note: "covered",
    },
  ],
  flags: [],
  verdict: "approve",
};

const PROMPT = { system: "sys", user: "usr" };

function fakeClient(
  behaviour: { parsed_output: unknown } | { throw: unknown },
): { client: ParseClient; lastArgs: () => Record<string, unknown> } {
  let lastArgs: unknown;
  return {
    client: {
      messages: {
        parse: async (args: unknown) => {
          lastArgs = args;
          if ("throw" in behaviour) throw behaviour.throw;
          return { parsed_output: behaviour.parsed_output };
        },
      },
    },
    lastArgs: () => lastArgs as Record<string, unknown>,
  };
}

describe("constants", () => {
  it("pins the expected models", () => {
    expect(PRIMARY_MODEL).toBe("claude-sonnet-5-5");
    expect(CHEAP_MODEL).toBe("claude-haiku-5-5");
  });
});

describe("createClient", () => {
  it("returns a client exposing messages.parse", () => {
    const client = createClient();
    expect(typeof client.messages.parse).toBe("function");
  });
});

describe("callClaude", () => {
  it("returns the parsed review output on success", async () => {
    const { client } = fakeClient({ parsed_output: VALID_OUTPUT });
    const out = await callClaude(client, PRIMARY_MODEL, PROMPT);
    expect(out).toEqual(VALID_OUTPUT);
  });

  it("sends model, prompt and output_config.format in the request", async () => {
    const { client, lastArgs } = fakeClient({ parsed_output: VALID_OUTPUT });
    await callClaude(client, CHEAP_MODEL, PROMPT);
    const args = lastArgs();
    expect(args.model).toBe(CHEAP_MODEL);
    expect(args.max_tokens).toBe(2048);
    expect(args.system).toBe(PROMPT.system);
    expect(args.messages).toEqual([{ role: "user", content: PROMPT.user }]);
    const outputConfig = args.output_config as Record<string, unknown>;
    expect(outputConfig).toBeDefined();
    expect(outputConfig.format).toBeDefined();
  });

  it("maps null parsed_output to invalid_output", async () => {
    const { client } = fakeClient({ parsed_output: null });
    await expect(
      callClaude(client, PRIMARY_MODEL, PROMPT),
    ).rejects.toMatchObject({ reason: "invalid_output" });
  });

  it("maps a schema-invalid parsed_output to invalid_output", async () => {
    const { client } = fakeClient({
      parsed_output: { rows: "nope", verdict: "approve" },
    });
    const err = await callClaude(client, PRIMARY_MODEL, PROMPT).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ReviewerError);
    expect((err as ReviewerError).reason).toBe("invalid_output");
  });

  it("maps an SDK timeout error to timeout", async () => {
    const { client } = fakeClient({
      throw: new APIConnectionTimeoutError({ message: "Request timed out." }),
    });
    const err = await callClaude(client, PRIMARY_MODEL, PROMPT).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ReviewerError);
    expect((err as ReviewerError).reason).toBe("timeout");
  });

  it("maps any other thrown error to api_error without leaking secrets", async () => {
    const { client } = fakeClient({
      throw: new Error("boom for key sk-ant-secret-key-123"),
    });
    const err = await callClaude(client, PRIMARY_MODEL, PROMPT).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ReviewerError);
    expect((err as ReviewerError).reason).toBe("api_error");
    expect((err as ReviewerError).message).not.toContain("sk-ant");
    expect((err as ReviewerError).message).not.toContain(PROMPT.user);
  });
});
