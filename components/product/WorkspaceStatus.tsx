"use client";

import { PhaseBadge } from "./LifeBadge";
import { useAuditPhase } from "./useAuditPhase";

export function WorkspaceStatus({ auditId }: { auditId: string }) {
  const { phase } = useAuditPhase(auditId);
  return <PhaseBadge phase={phase} />;
}
