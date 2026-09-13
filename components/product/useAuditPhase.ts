"use client";

import {
  primaryWorkspaceAction,
  sealReadiness,
  workspacePhase,
} from "@/lib/product/workspacePhase";
import { useWorkspace } from "./WorkspaceProvider";

export function useAuditPhase(auditId: string) {
  const workspace = useWorkspace();
  const executions = workspace.executions(auditId);
  const selected = workspace.selectedId(auditId);
  const execution = executions.find((item) => item.executionId === selected) ?? executions[executions.length - 1] ?? null;
  const findings = execution ? workspace.findings(auditId, execution.executionId) : workspace.findings(auditId);
  const evidence = execution ? workspace.evidence(auditId, execution.executionId) : workspace.evidence(auditId);
  const activities = execution ? workspace.activities(auditId, execution.executionId) : [];
  const actions = execution ? workspace.actions(auditId, execution.executionId) : [];
  const hasSeal = Boolean(execution && workspace.sealFor(execution.executionId));
  const local = workspace.localAudit(auditId);
  const isCatalogSample = !local && (execution?.status === "sample" || (!execution && !local));
  const canReopen = workspace.canReopen(auditId);
  const phase = workspacePhase({
    execution,
    hasSeal,
    findings,
    isCatalogSample,
  });
  const readiness = sealReadiness({
    execution,
    hasSeal,
    findings,
    evidenceCount: evidence.length,
    activityCount: activities.length + actions.length,
  });
  return {
    execution,
    executions,
    findings,
    evidence,
    activities,
    actions,
    hasSeal,
    phase,
    readiness,
    canReopen,
    primary: primaryWorkspaceAction({ phase, hasSeal, canReopen }),
  };
}
