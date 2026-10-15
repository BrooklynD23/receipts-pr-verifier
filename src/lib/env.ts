export type ReviewerMode = "replay" | "live";

export interface EnvInfo {
  mode: ReviewerMode;
  hasKey: boolean;
}

/**
 * Read reviewer-related env vars. The key value itself is never returned —
 * only whether a non-empty key is present.
 */
export function readEnv(
  env: Record<string, string | undefined> = process.env,
): EnvInfo {
  const hasKey = (env.ANTHROPIC_API_KEY ?? "").trim().length > 0;
  const mode: ReviewerMode =
    env.REVIEWER_MODE === "live" && hasKey ? "live" : "replay";
  return { mode, hasKey };
}
