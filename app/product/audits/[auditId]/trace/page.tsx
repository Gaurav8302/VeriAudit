import { TracePage } from "@/components/product/TracePage";
import { loadAuditWorkspace } from "@/lib/product/load";

export const dynamic = "force-dynamic";

export default async function AuditTracePage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const workspace = await loadAuditWorkspace(auditId);
  return (
    <TracePage
      auditId={auditId}
      auditTitle={workspace?.audit.title ?? auditId}
      selectedExecutionId={null}
      originalSpine={workspace?.spine ?? []}
      originalEvents={workspace?.events ?? []}
    />
  );
}
