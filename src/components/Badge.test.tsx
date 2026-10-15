import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Badge as BadgeKind } from "../lib/schemas";
import { Badge } from "./Badge";

const CASES: [BadgeKind, string][] = [
  ["clean", "Clean"],
  ["flags", "Flags"],
  ["missing_evidence", "Missing evidence"],
];

describe("Badge", () => {
  it.each(CASES)("renders %s as %s with text and aria-label", (badge, text) => {
    const html = renderToStaticMarkup(<Badge badge={badge} />);
    expect(html).toContain(text);
    expect(html).toContain(`aria-label="Status: ${text}"`);
  });

  it.each(CASES)(
    "renders %s with an icon glyph, not color alone",
    (badge, _text) => {
      const html = renderToStaticMarkup(<Badge badge={badge} />);
      expect(html).toContain('aria-hidden="true"');
    },
  );
});
