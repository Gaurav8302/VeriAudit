"use client";

import { auditLifeStatus } from "@/lib/product/lineage";
import { useAuditExecutions } from "./LineageProvider";
import { LifeBadge } from "./LifeBadge";

export function WorkspaceStatus({ auditId }: { auditId: string }) {
  const { executions } = useAuditExecutions(auditId);
  return <LifeBadge status={auditLifeStatus(executions)} />;
}
