import Anthropic, { APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { ReviewOutput } from "../schemas";

export const PRIMARY_MODEL = "claude-sonnet-5-5";
export const CHEAP_MODEL = "claude-haiku-5-5";

export type ReviewerErrorReason = "timeout" | "api_error" | "invalid_output";

/**
 * Typed failure from the live reviewer. Messages are static strings so a
 * thrown ReviewerError can never echo the API key or prompt content.
 */
export class ReviewerError extends Error {
  readonly reason: ReviewerErrorReason;

  constructor(reason: ReviewerErrorReason, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ReviewerError";
    this.reason = reason;
  }
}

/** The slice of the Anthropic SDK this module uses (fakeable in tests). */
export interface ParseClient {
  messages: {
    parse: (args: unknown) => Promise<{ parsed_output: unknown }>;
  };
}

/**
 * Build the live client. The SDK reads ANTHROPIC_API_KEY itself; the key is
 * never touched here. 30s timeout, one retry. The wrapper widens the SDK's
 * typed `parse` signature to the `unknown`-in/`unknown`-out ParseClient slice.
 */
export function createClient(): ParseClient {
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  return {
    messages: {
      parse: (args: unknown) =>
        client.messages.parse(
          args as Parameters<Anthropic["messages"]["parse"]>[0],
        ),
    },
  };
}

export interface ClaudePrompt {
  system: string;
  user: string;
}

/**
 * One structured-output call to Claude. Retries/timeout come from the client;
 * `parsed_output` is re-validated locally as defence in depth.
 */
export async function callClaude(
  client: ParseClient,
  model: string,
  prompt: ClaudePrompt,
): Promise<ReviewOutput> {
  let parsedOutput: unknown;
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 2048,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      output_config: { format: zodOutputFormat(ReviewOutput) },
    });
    parsedOutput = response.parsed_output;
  } catch (err) {
    if (err instanceof APIConnectionTimeoutError) {
      throw new ReviewerError("timeout", "Claude request timed out", err);
    }
    throw new ReviewerError("api_error", "Claude API request failed", err);
  }

  const result = ReviewOutput.safeParse(parsedOutput);
  if (!result.success) {
    throw new ReviewerError(
      "invalid_output",
      "Claude response failed schema validation",
    );
  }
  return result.data;
}
