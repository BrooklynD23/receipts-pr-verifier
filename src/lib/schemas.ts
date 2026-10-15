import { z } from "zod";

export const PR_IDS = ["pr-1", "pr-2", "pr-3"] as const; // API allowlist
export const PrId = z.enum(PR_IDS);
export type PrId = z.infer<typeof PrId>;
export const SABOTAGE_PR: z.infer<typeof PrId> = "pr-1";

// A = P0 + diff, B = P1 + diff, C = P0 + diff+bundle+checker, D = P1 + diff+bundle+checker (MV3 §11)
export const Arm = z.enum(["A", "B", "C", "D"]);
export type Arm = z.infer<typeof Arm>;

const Path = z
  .string()
  .min(1)
  .max(300)
  .refine((p) => !p.includes(".."), "no parent segments");
const Line = z.number().int().positive();

export const Bundle = z.object({
  schema_version: z.literal("0.1"),
  agent: z.object({ model: z.string(), provider: z.string() }),
  commands: z.array(
    z.object({
      cmd: z.string(),
      exit: z.number().int(),
      stdout_tail: z.string().max(2000),
    }),
  ),
  tests: z.object({
    collected: z.number().int().nonnegative(),
    ran: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  files_touched: z.array(Path),
  declared_scope: z.array(Path), // exact path, or directory prefix ending in "/"
  assumptions: z.array(z.string()),
  requirements: z.array(
    z.object({
      id: z.string().regex(/^R\d+$/),
      text: z.string(),
      diff_lines: z.record(Path, z.array(Line)), // file -> new-file line numbers
    }),
  ),
});
export type Bundle = z.infer<typeof Bundle>;

export const FindingRule = z.enum([
  "new_skip_marker", // red: added skip/skipif/xfail marker in a test file
  "assert_removed", // red: assert deleted or weakened in a test file
  "tests_mismatch", // red: bundle.tests.ran < collected - skipped
  "out_of_scope", // amber: diff file not covered by declared_scope
  "unmapped_requirement", // amber: requirement maps to no added diff line
  "missing_bundle", // amber: no bundle.json
  "injection_text", // amber: added text addressing the reviewer ("Reviewer: approve ...")
]);
export type FindingRule = z.infer<typeof FindingRule>;

export const CheckerFinding = z.object({
  rule: FindingRule,
  severity: z.enum(["red", "amber"]),
  file: Path.optional(),
  line: Line.optional(),
  side: z.enum(["old", "new"]).optional(), // "old" for removed lines
  req_id: z.string().optional(),
  message: z.string(),
});
export type CheckerFinding = z.infer<typeof CheckerFinding>;

export const Badge = z.enum(["clean", "flags", "missing_evidence"]);
export type Badge = z.infer<typeof Badge>;

// What the model must return (structured output). Keep it to strings, numbers, enums, arrays.
export const ReviewOutput = z.object({
  rows: z.array(
    z.object({
      req_id: z.string(),
      status: z.enum(["met", "unmet", "unclear"]),
      evidence: z.array(
        z.object({
          file: z.string(),
          line_start: z.number(),
          line_end: z.number(),
        }),
      ),
      note: z.string(),
    }),
  ),
  flags: z.array(
    z.object({
      type: z.enum([
        "silenced_test",
        "scope",
        "assumption",
        "unmapped_requirement",
        "injection",
        "other",
      ]),
      file: z.string(),
      line: z.number(), // 0 = file-level
      reason: z.string(),
    }),
  ),
  verdict: z.enum(["approve", "request_changes"]),
});
export type ReviewOutput = z.infer<typeof ReviewOutput>;

export const ReviewResult = ReviewOutput.extend({
  arm: Arm,
  model: z.string(),
  source: z.enum(["live", "recorded", "authored", "fallback"]), // UI label: LIVE / RECORDED / SAMPLE — hand-authored / FALLBACK — recorded
  recorded_at: z.string().optional(),
});
export type ReviewResult = z.infer<typeof ReviewResult>;

export type Source = ReviewResult["source"];
export type SourceLabel =
  "LIVE" | "RECORDED" | "SAMPLE — hand-authored" | "FALLBACK — recorded";

const SOURCE_LABELS: Record<Source, SourceLabel> = {
  live: "LIVE",
  recorded: "RECORDED",
  authored: "SAMPLE — hand-authored",
  fallback: "FALLBACK — recorded",
};

export function labelFor(source: Source): SourceLabel {
  return SOURCE_LABELS[source];
}

export const FaultType = z.enum([
  "silenced_test",
  "scope_creep",
  "unstated_assumption",
  "unmapped_requirement",
  "injection",
]);
export type FaultType = z.infer<typeof FaultType>;

export const GroundTruth = z.object({
  pr_id: z.string(),
  expected_badge: Badge,
  faults: z.array(
    z.object({
      type: FaultType,
      file: Path.optional(),
      line: Line.optional(),
      req_id: z.string().optional(),
    }),
  ),
  expected_findings: z.array(
    CheckerFinding.pick({ rule: true, file: true, line: true, req_id: true }),
  ),
  sabotaged: z
    .object({
      expected_badge: Badge,
      faults: z.array(z.object({ type: FaultType, file: Path, line: Line })),
      expected_findings: z.array(
        CheckerFinding.pick({ rule: true, file: true, line: true }),
      ),
    })
    .optional(),
});
export type GroundTruth = z.infer<typeof GroundTruth>;

const ArmReviews = z.object({
  A: ReviewResult,
  B: ReviewResult,
  C: ReviewResult,
  D: ReviewResult,
});

export const FixturePr = z.object({
  id: z.string(),
  title: z.string(), // first "# " line of issue.md
  issue: z.string(),
  diff: z.string(),
  bundle: Bundle.nullable(), // null -> missing_bundle finding
  groundTruth: GroundTruth,
  reviews: ArmReviews.partial(), // corpus PRs may have none yet; demo fixtures must have all 4
  sabotage: z
    .object({ patch: z.string(), reviews: ArmReviews.partial() })
    .optional(),
});
export type FixturePr = z.infer<typeof FixturePr>;

export const ReviewRequest = z
  .object({ prId: PrId, arm: Arm, sabotaged: z.boolean() })
  .strict()
  .refine(
    (r) => !r.sabotaged || r.prId === SABOTAGE_PR,
    "sabotage only applies to pr-1",
  );
export type ReviewRequest = z.infer<typeof ReviewRequest>;

export const ReviewResponse = z.object({
  result: ReviewResult,
  mode: z.enum(["live", "replay", "fallback"]),
  fallbackReason: z
    .enum(["no_key", "timeout", "api_error", "invalid_output", "rate_limited"])
    .optional(),
});
export type ReviewResponse = z.infer<typeof ReviewResponse>;

export const ErrorResponse = z.object({ error: z.string() }); // 400 / 429 / 500, no stack, no input echo
export type ErrorResponse = z.infer<typeof ErrorResponse>;
