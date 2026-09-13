import { AiWorkspace } from "@/components/product/AiWorkspace";

export default async function AuditAiPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  return <AiWorkspace auditId={auditId} />;
}
