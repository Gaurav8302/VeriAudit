import { TracePage } from "@/components/product/TracePage";
import { loadAuditWorkspace } from "@/lib/product/load";

export const dynamic = "force-dynamic";

export default async function ExecutionTracePage({
  params,
}: {
  params: Promise<{ auditId: string; executionId: string }>;
}) {
  const { auditId, executionId } = await params;
  const workspace = await loadAuditWorkspace(auditId);
  return (
    <TracePage
      auditId={auditId}
      auditTitle={workspace?.audit.title ?? auditId}
      selectedExecutionId={executionId}
      originalSpine={workspace?.spine ?? []}
      originalEvents={workspace?.events ?? []}
    />
  );
}
