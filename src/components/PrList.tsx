import Link from "next/link";

import type { Badge as BadgeKind } from "../lib/schemas";
import { Badge } from "./Badge";

export type PrListItem = {
  id: string;
  title: string;
  badge: BadgeKind;
  findingCount: number;
};

export function PrList({ items }: { items: PrListItem[] }) {
  if (items.length === 0) {
    return <p>No PRs</p>;
  }
  return (
    <ul className="divide-y divide-gray-200">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/pr/${item.id}`}
            className="flex items-center gap-3 px-2 py-3 hover:bg-gray-50"
          >
            <span className="flex-1">{item.title}</span>
            <Badge badge={item.badge} />
            <span className="text-sm text-gray-700">
              {item.findingCount}{" "}
              {item.findingCount === 1 ? "finding" : "findings"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
