"use client";

import { useEffect, useReducer, useRef } from "react";

import { parseDiff } from "../lib/diff";
import {
  Arm,
  labelFor,
  ReviewResponse,
  type FixturePr,
  type ReviewResult,
} from "../lib/schemas";
import { initState, reduce } from "../lib/workspace";
import { Badge } from "./Badge";
import { DiffView } from "./DiffView";
import { Matrix } from "./Matrix";

const ARM_LABELS: Record<Arm, string> = {
  A: "A · diff only · P0",
  B: "B · diff only · P1",
  C: "C · diff + bundle · P0",
  D: "D · diff + bundle · P1",
};

const LIVE_TIMEOUT_MS = 45_000;

export async function fetchLiveReview(
  prId: string,
  arm: Arm,
  sabotaged: boolean,
  signal: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<ReviewResponse | null> {
  try {
    const res = await fetchFn("/api/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prId, arm, sabotaged }),
      signal,
    });
    if (!res.ok) throw new Error("bad_status");
    return ReviewResponse.parse(await res.json());
  } catch (e) {
    // kind only, never the payload
    console.warn(
      "live review failed:",
      e instanceof Error ? e.name : "unknown",
    );
    return null;
  }
}

export const fallbackReview = (recorded: ReviewResult) => ({
  result: { ...recorded, source: "fallback" as const },
  mode: "fallback" as const,
});

export function PrWorkspace({
  pr,
  liveEnabled,
}: {
  pr: FixturePr;
  liveEnabled: boolean;
}) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initState>, a: Parameters<typeof reduce>[1]) =>
      reduce(s, a, pr),
    pr,
    (p) => initState(p),
  );
  const { arm, sabotaged, review, findings, badge, pending } = state;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!liveEnabled) return;
    let stale = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
    dispatch({ type: "liveStarted" });
    (async () => {
      const live = await fetchLiveReview(pr.id, arm, sabotaged, ctrl.signal);
      clearTimeout(timer);
      if (stale) return; // superseded by a newer change
      if (live) {
        dispatch({ type: "liveResult", result: live.result, mode: live.mode });
        return;
      }
      // Keep the recorded review, relabelled; with none, setArm clears pending.
      const rec = (sabotaged ? pr.sabotage?.reviews : pr.reviews)?.[arm];
      if (rec) {
        const fb = fallbackReview(rec);
        dispatch({ type: "liveResult", ...fb });
      } else {
        dispatch({ type: "setArm", arm });
      }
    })();
    return () => {
      stale = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [arm, sabotaged, liveEnabled, pr]);

  const sourceLabel = review ? labelFor(review.source) : null;

  return (
    <main className="mx-auto max-w-5xl p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{pr.title}</h1>
        <Badge badge={badge} />
      </header>

      <div className="my-4 flex flex-wrap items-start gap-4">
        <fieldset>
          <legend>Reviewer arm</legend>
          {Arm.options.map((a) => (
            <label key={a} className="mr-3 inline-flex items-center gap-1">
              <input
                type="radio"
                name="arm"
                value={a}
                checked={arm === a}
                onChange={() => dispatch({ type: "setArm", arm: a })}
              />
              {ARM_LABELS[a]}
            </label>
          ))}
        </fieldset>
        {pr.sabotage && (
          <button
            type="button"
            aria-pressed={sabotaged}
            className="rounded border px-3 py-1"
            onClick={() => dispatch({ type: "toggleSabotage" })}
          >
            {sabotaged ? "Undo sabotage" : "Sabotage: silence a test"}
          </button>
        )}
      </div>

      <p role="status" className="sr-only">
        Checker: {findings.length} findings, badge {badge}
      </p>

      <section aria-busy={pending} aria-labelledby="matrix-h">
        <h2 id="matrix-h">Requirement → evidence</h2>
        {review && sourceLabel && pr.bundle ? (
          <Matrix
            requirements={pr.bundle.requirements}
            review={review}
            findings={findings}
            sourceLabel={sourceLabel}
          />
        ) : (
          <p>No recorded review for this arm.</p>
        )}
      </section>

      <section aria-labelledby="diff-h">
        <h2 id="diff-h">Diff</h2>
        <DiffView files={parseDiff(state.diff)} findings={findings} />
      </section>
    </main>
  );
}
