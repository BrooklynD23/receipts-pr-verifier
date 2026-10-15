import { check } from "./checker";
import { badgeFor } from "./checker/badge";
import type {
  Arm,
  Badge,
  CheckerFinding,
  FixturePr,
  ReviewResult,
} from "./schemas";

export type Mode = "replay" | "live" | "fallback";

export type State = {
  prId: string;
  arm: Arm;
  sabotaged: boolean;
  diff: string;
  findings: CheckerFinding[];
  badge: Badge;
  review: ReviewResult | null;
  mode: Mode;
  pending: boolean;
};

export type Action =
  | { type: "setArm"; arm: Arm }
  | { type: "toggleSabotage" }
  | { type: "liveStarted" }
  | { type: "liveResult"; result: ReviewResult; mode: Mode };

export const effectiveDiff = (pr: FixturePr, sabotaged: boolean): string =>
  sabotaged && pr.sabotage ? `${pr.diff}\n${pr.sabotage.patch}` : pr.diff;

const recorded = (
  pr: FixturePr,
  arm: Arm,
  sabotaged: boolean,
): ReviewResult | null =>
  (sabotaged ? pr.sabotage?.reviews[arm] : pr.reviews[arm]) ?? null;

function view(pr: FixturePr, arm: Arm, sabotaged: boolean): State {
  const diff = effectiveDiff(pr, sabotaged);
  const findings = check(diff, pr.bundle);
  return {
    prId: pr.id,
    arm,
    sabotaged,
    diff,
    findings,
    badge: badgeFor(findings),
    review: recorded(pr, arm, sabotaged),
    mode: "replay",
    pending: false,
  };
}

export const initState = (pr: FixturePr, arm: Arm = "D"): State =>
  view(pr, arm, false);

export function reduce(state: State, action: Action, pr: FixturePr): State {
  switch (action.type) {
    case "setArm":
      return view(pr, action.arm, state.sabotaged);
    case "toggleSabotage":
      return pr.sabotage ? view(pr, state.arm, !state.sabotaged) : state;
    case "liveStarted":
      return { ...state, pending: true };
    case "liveResult":
      return {
        ...state,
        review: action.result,
        mode: action.mode,
        pending: false,
      };
  }
}
