import type { ReactNode } from "react";
import { WorkspaceHost } from "@/components/product/WorkspaceHost";
import { getWorkspaceAudit } from "@/lib/product/workspace";

export default async function AuditWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  return (
    <WorkspaceHost auditId={auditId} catalogAudit={getWorkspaceAudit(auditId)}>
      {children}
    </WorkspaceHost>
  );
}
