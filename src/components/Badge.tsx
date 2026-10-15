import type { Badge as BadgeKind } from "../lib/schemas";

// Text + glyph (not color alone); bg-100/text-900 pairs are ≥4.5:1 contrast.
const STYLES: Record<
  BadgeKind,
  { text: string; glyph: string; colors: string }
> = {
  clean: { text: "Clean", glyph: "✓", colors: "bg-green-100 text-green-900" },
  flags: { text: "Flags", glyph: "⚠", colors: "bg-red-100 text-red-900" },
  missing_evidence: {
    text: "Missing evidence",
    glyph: "?",
    colors: "bg-amber-100 text-amber-900",
  },
};

export function Badge({ badge }: { badge: BadgeKind }) {
  const { text, glyph, colors } = STYLES[badge];
  return (
    <span
      aria-label={`Status: ${text}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      <span aria-hidden="true">{glyph}</span>
      {text}
    </span>
  );
}
