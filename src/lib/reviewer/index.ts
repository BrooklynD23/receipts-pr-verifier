import { readEnv, type EnvInfo } from "../env";
import type { ReviewResponse, ReviewResult } from "../schemas";
import { effectiveDiff } from "../workspace";
import {
  CHEAP_MODEL,
  callClaude,
  createClient,
  PRIMARY_MODEL,
  ReviewerError,
  type ParseClient,
} from "./anthropic";
import { buildPrompt } from "./prompt";
import { replayReview, type ReviewFn, type ReviewInput } from "./replay";

export type FallbackReason = NonNullable<ReviewResponse["fallbackReason"]>;

/**
 * Injectable dependencies for review(). `client` is a thunk so replay mode
 * never constructs the SDK client (tests pass `() => fakeClient`).
 */
export interface ReviewDeps {
  env: EnvInfo;
  client: () => ParseClient;
  replay: ReviewFn;
}

/**
 * Live provider factory: buildPrompt -> callClaude on the primary model,
 * one retry on the cheap model for ReviewerError only. The returned result is
 * stamped with arm, the model that produced it, source "live" and a fresh
 * recorded_at timestamp.
 */
export function liveReview(deps: Pick<ReviewDeps, "client">): ReviewFn {
  return async (input) => {
    const prompt = buildPrompt({
      pr: input.pr,
      arm: input.arm,
      diff: effectiveDiff(input.pr, input.sabotaged),
      findings: input.findings,
    });
    const client = deps.client();

    let output;
    let model = PRIMARY_MODEL;
    try {
      output = await callClaude(client, PRIMARY_MODEL, prompt);
    } catch (err) {
      if (!(err instanceof ReviewerError)) throw err;
      model = CHEAP_MODEL;
      output = await callClaude(client, CHEAP_MODEL, prompt);
    }

    return {
      ...output,
      arm: input.arm,
      model,
      source: "live",
      recorded_at: new Date().toISOString(),
    };
  };
}

// Only ReviewerError carries a mapped reason; anything else is api_error.
function mapReason(err: unknown): FallbackReason {
  return err instanceof ReviewerError ? err.reason : "api_error";
}

// Reason + prId only: error text may contain secrets, prompt data is
// untrusted, and neither belongs in logs.
function logFallback(input: ReviewInput, reason: FallbackReason): void {
  console.error(`review fallback: ${reason} (${input.pr.id})`);
}

async function recordedFallback(
  input: ReviewInput,
  replay: ReviewFn,
  reason: FallbackReason,
): Promise<ReviewResponse> {
  const recorded = await replay(input);
  return {
    result: { ...recorded, source: "fallback" },
    mode: "fallback",
    fallbackReason: reason,
  };
}

// Default deps per call: env is read fresh on every request and the SDK
// client is built lazily so replay mode never touches it.
function defaultDeps(): ReviewDeps {
  let cached: ParseClient | undefined;
  return {
    env: readEnv(),
    client: () => (cached ??= createClient()),
    replay: replayReview,
  };
}

/**
 * Mode select + fallback chain (PLAN-01 §5). Replay mode returns the recorded
 * fixture review untouched. Live mode tries liveReview (sonnet -> haiku);
 * any failure — or a live request with no key — returns the recorded review
 * re-labelled source "fallback" with a mapped fallbackReason.
 */
export async function review(
  input: ReviewInput,
  deps: ReviewDeps = defaultDeps(),
): Promise<ReviewResponse> {
  if (deps.env.mode !== "live") {
    const result: ReviewResult = await deps.replay(input);
    return { result, mode: "replay" };
  }

  if (!deps.env.hasKey) {
    logFallback(input, "no_key");
    return recordedFallback(input, deps.replay, "no_key");
  }

  try {
    return { result: await liveReview(deps)(input), mode: "live" };
  } catch (err) {
    const reason = mapReason(err);
    logFallback(input, reason);
    return recordedFallback(input, deps.replay, reason);
  }
}
