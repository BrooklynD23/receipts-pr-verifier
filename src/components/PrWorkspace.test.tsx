import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { loadDemoPr } from "../lib/fixtures";
import { labelFor } from "../lib/schemas";
import { fallbackReview, fetchLiveReview, PrWorkspace } from "./PrWorkspace";

describe("PrWorkspace", () => {
  it("renders pr-1 controls, status region and source label", async () => {
    const pr = await loadDemoPr("pr-1");
    const html = renderToStaticMarkup(
      <PrWorkspace pr={pr} liveEnabled={false} />,
    );
    expect(html).toContain("Reviewer arm");
    for (const t of [
      "A · diff only · P0",
      "B · diff only · P1",
      "C · diff + bundle · P0",
      "D · diff + bundle · P1",
    ]) {
      expect(html).toContain(t);
    }
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html).toContain("Sabotage: silence a test");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('role="status"');
    expect(html).toMatch(/RECORDED|SAMPLE — hand-authored/);
    expect(html).toContain("Requirement → evidence");
    expect(html).toContain("Diff");
  });

  it("pr-2 has no sabotage button", async () => {
    const pr = await loadDemoPr("pr-2");
    const html = renderToStaticMarkup(
      <PrWorkspace pr={pr} liveEnabled={false} />,
    );
    expect(html).not.toContain("Sabotage");
  });
});

describe("fetchLiveReview", () => {
  const sig = new AbortController().signal;
  const mk = async () => {
    const pr = await loadDemoPr("pr-1");
    return { pr, rec: pr.reviews.D! };
  };

  it("POSTs body and parses ok response", async () => {
    const { rec } = await mk();
    const body = { result: { ...rec, source: "live" }, mode: "live" };
    const f = vi.fn(async () => new Response(JSON.stringify(body)));
    const out = await fetchLiveReview("pr-1", "D", true, sig, f as never);
    expect(out?.mode).toBe("live");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/review");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(sig);
    expect(JSON.parse(init.body as string)).toEqual({
      prId: "pr-1",
      arm: "D",
      sabotaged: true,
    });
  });

  it("returns null on non-ok, bad shape, and abort", async () => {
    const non = vi.fn(async () => new Response("{}", { status: 429 }));
    expect(
      await fetchLiveReview("pr-1", "D", false, sig, non as never),
    ).toBeNull();
    const bad = vi.fn(async () => new Response('{"x":1}'));
    expect(
      await fetchLiveReview("pr-1", "D", false, sig, bad as never),
    ).toBeNull();
    const ab = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    expect(
      await fetchLiveReview("pr-1", "D", false, sig, ab as never),
    ).toBeNull();
  });

  it("fallbackReview relabels recorded", async () => {
    const { rec } = await mk();
    const fb = fallbackReview(rec);
    expect(fb.result.source).toBe("fallback");
    expect(fb.mode).toBe("fallback");
    expect(labelFor(fb.result.source)).toBe("FALLBACK — recorded");
  });
});
