import Link from "next/link";

import { PrList, type PrListItem } from "../components/PrList";
import { badgeFor } from "../lib/checker/badge";
import { check } from "../lib/checker";
import { readEnv } from "../lib/env";
import { listDemoPrs } from "../lib/fixtures";

export default async function Home() {
  const prs = await listDemoPrs();
  const items: PrListItem[] = prs.map((pr) => {
    const findings = check(pr.diff, pr.bundle);
    return {
      id: pr.id,
      title: pr.title,
      badge: badgeFor(findings),
      findingCount: findings.length,
    };
  });
  const live = readEnv().mode === "live";
  return (
    <>
      <h1 className="text-2xl font-semibold">Receipts PR Verifier</h1>
      <p className="mt-2">
        Checks an agent&apos;s evidence bundle against the diff, then asks an
        independent reviewer for a requirement-to-evidence matrix.
      </p>
      <p role="note" className="mt-3 rounded bg-gray-100 px-3 py-2 text-sm">
        {live
          ? "Live mode — reviewer outputs come from Claude"
          : "Replay mode — reviewer outputs are recorded"}
      </p>
      <div className="mt-4">
        <PrList items={items} />
      </div>
      <p className="mt-4">
        <Link href="/results" className="underline">
          Detection results
        </Link>
      </p>
    </>
  );
}
