import { EvidenceBoard } from "@/components/product/EvidenceBoard";
import { loadAuditWorkspace } from "@/lib/product/load";

export const dynamic = "force-dynamic";

export default async function AuditEvidencePage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const workspace = await loadAuditWorkspace(auditId);
  return <EvidenceBoard auditId={auditId} catalog={workspace?.evidence ?? []} />;
}
