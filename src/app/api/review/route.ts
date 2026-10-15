import { check } from "@/lib/checker";
import { loadDemoPr } from "@/lib/fixtures";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { review } from "@/lib/reviewer";
import { effectiveDiff } from "@/lib/workspace";
import {
  ReviewRequest,
  ReviewResponse,
  type ErrorResponse,
} from "@/lib/schemas";

export const maxDuration = 60;

const MAX_BODY_BYTES = 1024;

// Per-instance fixed-window limiter; HUMAN-04's Vercel WAF rule is the real cap.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const fail = (
  body: ErrorResponse,
  status: number,
  headers?: HeadersInit,
): Response => Response.json(body, { status, headers });

export async function POST(req: Request): Promise<Response> {
  try {
    const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("application/json")) {
      return fail({ error: "unsupported media type" }, 415);
    }

    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return fail({ error: "body too large" }, 413);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail({ error: "invalid request" }, 400);
    }
    // Static error body: never echo the rejected input back to the caller.
    const parsed = ReviewRequest.safeParse(raw);
    if (!parsed.success) {
      return fail({ error: "invalid request" }, 400);
    }

    const rl = limiter.check(clientIp(req.headers));
    if (!rl.ok) {
      return fail({ error: "rate limited" }, 429, {
        "Retry-After": String(rl.retryAfterSec),
      });
    }

    const { prId, arm, sabotaged } = parsed.data;
    const pr = await loadDemoPr(prId);
    const diff = effectiveDiff(pr, sabotaged);
    const findings = check(diff, pr.bundle);
    const outcome = await review({ pr, arm, sabotaged, findings });

    return Response.json(ReviewResponse.parse(outcome));
  } catch (err) {
    // Name only: the message may carry key or prompt data.
    console.error(
      `review route error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return fail({ error: "internal error" }, 500);
  }
}
