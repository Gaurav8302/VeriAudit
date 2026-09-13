import { isHeroOriginal, isWritableExecution, type LocalFinding } from "./localWorkspace";
import type { ProductExecution } from "./lineage";

export type WorkspacePhase =
  | "active"
  | "review"
  | "ready_to_seal"
  | "sealed"
  | "reopened"
  | "recorded"
  | "sample";

export function phaseLabel(phase: WorkspacePhase): string {
  if (phase === "active") return "Active";
  if (phase === "review") return "Review";
  if (phase === "ready_to_seal") return "Ready to seal";
  if (phase === "sealed") return "Sealed";
  if (phase === "reopened") return "Reopened";
  if (phase === "recorded") return "Recorded";
  return "Demo data";
}

export function hasPendingReview(findings: readonly LocalFinding[]): boolean {
  return findings.some((item) => item.review === "pending");
}

export function canSealOnServer(execution: ProductExecution | null, hasSeal: boolean): boolean {
  if (!execution || hasSeal) return false;
  if (isHeroOriginal(execution.executionId) || execution.hasEngineTrail) return false;
  return execution.status === "closed" || execution.status === "sealed";
}

export function sealReadiness(input: {
  execution: ProductExecution | null;
  hasSeal: boolean;
  findings: readonly LocalFinding[];
  evidenceCount: number;
  activityCount: number;
}): {
  readonly canRequestSeal: boolean;
  readonly checks: readonly { readonly ok: boolean; readonly required: boolean; readonly label: string }[];
} {
  const { execution, hasSeal, findings, evidenceCount, activityCount } = input;
  const closed = Boolean(execution && (execution.status === "closed" || execution.status === "sealed"));
  const sealable = canSealOnServer(execution, hasSeal);
  const eventsExist = activityCount > 0;
  const reviewsDone = !hasPendingReview(findings);
  const checks = [
    { ok: closed, required: true, label: "Execution is closed" },
    { ok: eventsExist, required: true, label: "Recorded events exist" },
    { ok: evidenceCount > 0, required: false, label: "Evidence is attached" },
    { ok: reviewsDone, required: true, label: "Findings have required human decisions" },
    { ok: sealable, required: true, label: "CooL sealing is available for this execution" },
  ] as const;
  return {
    canRequestSeal: sealable && eventsExist && reviewsDone,
    checks,
  };
}

export function workspacePhase(input: {
  execution: ProductExecution | null;
  hasSeal: boolean;
  findings: readonly LocalFinding[];
  isCatalogSample: boolean;
}): WorkspacePhase {
  const { execution, hasSeal, findings, isCatalogSample } = input;
  if (!execution) return isCatalogSample ? "sample" : "active";
  if (hasSeal) return "sealed";
  const pending = hasPendingReview(findings);
  const writable = isWritableExecution(execution);
  if (pending && (writable || canSealOnServer(execution, hasSeal))) return "review";
  if (writable && (execution.parentExecutionId || execution.sequence > 1)) return "reopened";
  if (writable) return "active";
  if (canSealOnServer(execution, hasSeal)) return "ready_to_seal";
  if (execution.status === "sealed") return "sealed";
  if (execution.hasEngineTrail || execution.status === "recorded") return "recorded";
  if (isCatalogSample) return "sample";
  return "recorded";
}

export function primaryWorkspaceAction(input: {
  phase: WorkspacePhase;
  hasSeal: boolean;
  canReopen: boolean;
}): "continue" | "review" | "seal" | "verify" | "reopen" | null {
  const { phase, hasSeal, canReopen } = input;
  if (phase === "active" || phase === "reopened") return "continue";
  if (phase === "review") return "review";
  if (phase === "ready_to_seal") return "seal";
  if (phase === "sealed" && hasSeal) return "verify";
  if (canReopen) return "reopen";
  return null;
}
