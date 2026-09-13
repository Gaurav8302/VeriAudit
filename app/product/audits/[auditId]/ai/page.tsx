import { AuditOverview } from "@/components/product/AuditOverview";
import { loadAuditWorkspace } from "@/lib/product/load";

export const dynamic = "force-dynamic";

export default async function AuditAiPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const catalog = await loadAuditWorkspace(auditId);
  return <AuditOverview auditId={auditId} catalog={catalog} />;
}
