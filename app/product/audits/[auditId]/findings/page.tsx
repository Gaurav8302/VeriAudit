import { FindingsBoard } from "@/components/product/FindingsBoard";
import { loadAuditWorkspace } from "@/lib/product/load";

export const dynamic = "force-dynamic";

export default async function AuditFindingsPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const workspace = await loadAuditWorkspace(auditId);
  return <FindingsBoard auditId={auditId} catalog={workspace?.findings ?? []} />;
}
