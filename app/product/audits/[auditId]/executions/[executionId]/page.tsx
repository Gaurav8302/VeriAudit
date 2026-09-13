import { ExecutionDetail } from "@/components/product/ExecutionDetail";
import { loadAuditWorkspace } from "@/lib/product/load";

export const dynamic = "force-dynamic";

export default async function AuditExecutionPage({
  params,
}: {
  params: Promise<{ auditId: string; executionId: string }>;
}) {
  const { auditId, executionId } = await params;
  const workspace = await loadAuditWorkspace(auditId);

  return (
    <ExecutionDetail
      auditId={auditId}
      executionId={executionId}
      auditTitle={workspace?.audit.title ?? auditId}
      originalEvents={workspace?.events ?? []}
      originalSpine={workspace?.spine ?? []}
      findings={(workspace?.findings ?? []).map((finding) => ({
        findingId: finding.findingId,
        title: finding.title,
      }))}
    />
  );
}
