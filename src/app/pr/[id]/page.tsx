import { notFound } from "next/navigation";

import { PrWorkspace } from "@/components/PrWorkspace";
import { readEnv } from "@/lib/env";
import { loadDemoPr } from "@/lib/fixtures";
import { PR_IDS, PrId } from "@/lib/schemas";

export const generateStaticParams = () => PR_IDS.map((id) => ({ id }));

export default async function PrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsed = PrId.safeParse((await params).id);
  if (!parsed.success) notFound();
  const pr = await loadDemoPr(parsed.data);
  return <PrWorkspace pr={pr} liveEnabled={readEnv().mode === "live"} />;
}
