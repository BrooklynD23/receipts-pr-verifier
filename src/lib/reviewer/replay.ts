import type { Arm, CheckerFinding, FixturePr, ReviewResult } from "../schemas";

// Single home for the reviewer-provider contract (PLAN-01 §5).
export type ReviewInput = {
  pr: FixturePr;
  arm: Arm;
  sabotaged: boolean;
  findings: CheckerFinding[];
};

export type ReviewFn = (input: ReviewInput) => Promise<ReviewResult>;

// Replay provider: returns the recorded fixture review. Callers (record-reviews,
// index.ts fallback) set `source`; it is kept exactly as stored.
export async function replayReview(input: ReviewInput): Promise<ReviewResult> {
  const { pr, arm, sabotaged } = input;
  const stored = sabotaged ? pr.sabotage?.reviews[arm] : pr.reviews[arm];
  if (!stored) {
    throw new Error(`no recorded review for ${pr.id}/${arm}`);
  }
  return { ...stored };
}
