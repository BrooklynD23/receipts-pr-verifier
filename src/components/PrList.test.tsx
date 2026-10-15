import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Badge as BadgeKind } from "../lib/schemas";
import { PrList } from "./PrList";

const ITEMS: {
  id: string;
  title: string;
  badge: BadgeKind;
  findingCount: number;
}[] = [
  { id: "pr-1", title: "Skip flaky tests", badge: "flags", findingCount: 2 },
  { id: "pr-2", title: "Add retry helper", badge: "clean", findingCount: 0 },
  {
    id: "pr-3",
    title: "Bundle-less change",
    badge: "missing_evidence",
    findingCount: 1,
  },
];

describe("PrList", () => {
  it("renders a link per item to /pr/<id>", () => {
    const html = renderToStaticMarkup(<PrList items={ITEMS} />);
    expect(html).toContain("<ul");
    expect((html.match(/<a /g) ?? []).length).toBe(3);
    for (const item of ITEMS) {
      expect(html).toContain(`href="/pr/${item.id}"`);
      expect(html).toContain(item.title);
    }
  });

  it("renders each item's badge and finding count", () => {
    const html = renderToStaticMarkup(<PrList items={ITEMS} />);
    expect(html).toContain('aria-label="Status: Flags"');
    expect(html).toContain('aria-label="Status: Clean"');
    expect(html).toContain('aria-label="Status: Missing evidence"');
    expect(html).toContain("2 findings");
    expect(html).toContain("0 findings");
    expect(html).toContain("1 finding");
  });

  it("renders an empty state instead of a list", () => {
    const html = renderToStaticMarkup(<PrList items={[]} />);
    expect(html).toContain("No PRs");
    expect(html).not.toContain("<ul");
  });
});
