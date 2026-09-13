/**
 * Product-level execution lineage.
 *
 * The hero original is a frozen catalog record. Reopening appends a new
 * execution. It never writes into the original. This is not CooL sealing and
 * does not invent events.
 */
import { resolveScenario } from "@/lib/audit/scenarios";
import { getWorkspaceAudit, HERO_AUDIT_ID, HERO_EXECUTION_ID } from "./workspace";

function declaredTrailLength(auditId: string): number | null {
  const scenario = resolveScenario(auditId);
  if (!scenario) return null;
  return (
    1 +
    scenario.artifacts.length * 2 +
    2 +
    scenario.controls.length +
    scenario.expected.findings +
    Object.keys(scenario.reviewPolicy.decisions).length +
    1
  );
}

export type ExecutionLife = "sealed" | "open" | "recorded" | "sample" | "closed";
export type AuditLife = ExecutionLife | "reopened" | "wip" | "review_required";

export interface ProductExecution {
  readonly executionId: string;
  readonly auditId: string;
  readonly sequence: number;
  readonly label: string;
  readonly createdAt: string;
  readonly status: ExecutionLife;
  readonly parentExecutionId: string | null;
  readonly eventCount: number | null;
  readonly findingCount: number;
  readonly hasEngineTrail: boolean;
  readonly immutable: boolean;
  readonly closedAt?: string | null;
}

export const HERO_ORIGINAL_CREATED_AT = "2026-09-15T09:00:00.000Z";
export const FIRST_REOPEN_AT = "2026-12-10T09:00:00.000Z";
export const HERO_ORIGINAL_EVENT_COUNT = 30;
export const HERO_ORIGINAL_FINDING_IDS = ["F-FIN-001", "F-FIN-002", "F-FIN-003"] as const;

export const HERO_ORIGINAL_EXECUTION: ProductExecution = Object.freeze({
  executionId: HERO_EXECUTION_ID,
  auditId: HERO_AUDIT_ID,
  sequence: 1,
  label: "Execution 001",
  createdAt: HERO_ORIGINAL_CREATED_AT,
  status: "sealed",
  parentExecutionId: null,
  eventCount: HERO_ORIGINAL_EVENT_COUNT,
  findingCount: HERO_ORIGINAL_FINDING_IDS.length,
  hasEngineTrail: true,
  immutable: true,
});

export function snapshotExecution(execution: ProductExecution) {
  return {
    executionId: execution.executionId,
    auditId: execution.auditId,
    sequence: execution.sequence,
    createdAt: execution.createdAt,
    status: execution.status,
    parentExecutionId: execution.parentExecutionId,
    eventCount: execution.eventCount,
    findingCount: execution.findingCount,
    hasEngineTrail: execution.hasEngineTrail,
    immutable: execution.immutable,
  };
}

export const HERO_ORIGINAL_SNAPSHOT = Object.freeze(snapshotExecution(HERO_ORIGINAL_EXECUTION));

export function catalogExecutions(auditId: string): ProductExecution[] {
  if (auditId === HERO_AUDIT_ID) return [HERO_ORIGINAL_EXECUTION];
  const audit = getWorkspaceAudit(auditId);
  if (!audit?.executionId) return [];
  return [
    {
      executionId: audit.executionId,
      auditId,
      sequence: 1,
      label: "Execution 001",
      createdAt: audit.openedAt,
      status: audit.hasEngineTrail ? "recorded" : "sample",
      parentExecutionId: null,
      eventCount: declaredTrailLength(auditId),
      findingCount: audit.findingCount,
      hasEngineTrail: audit.hasEngineTrail,
      immutable: true,
    },
  ];
}

export function mergeExecutions(
  auditId: string,
  extras: readonly ProductExecution[] = [],
): ProductExecution[] {
  const base = catalogExecutions(auditId);
  const originalId = base[0]?.executionId;
  const children = extras.filter(
    (item) => item.auditId === auditId && item.executionId !== originalId,
  );
  return [...base, ...children].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime !== 0 ? byTime : a.sequence - b.sequence;
  });
}

export function reopenTimestamp(sequence: number): string {
  const day = 8 + sequence;
  return `2026-12-${String(day).padStart(2, "0")}T09:00:00.000Z`;
}

export function reopenAudit(
  auditId: string,
  extras: readonly ProductExecution[] = [],
  createdAt?: string,
): ProductExecution {
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    throw new Error("Only engine-backed catalog audits can be reopened this way.");
  }

  const current = mergeExecutions(auditId, extras);
  const original = current[0];
  if (!original) {
    throw new Error("The original execution is missing.");
  }
  if (auditId === HERO_AUDIT_ID) {
    const hero = current.find((item) => item.executionId === HERO_EXECUTION_ID);
    if (!hero) {
      throw new Error("The original execution is missing.");
    }
    if (JSON.stringify(snapshotExecution(hero)) !== JSON.stringify(HERO_ORIGINAL_SNAPSHOT)) {
      throw new Error("The original sealed execution cannot be changed.");
    }
  }

  const parent = current[current.length - 1]!;
  const sequence = current.length + 1;
  const code = scenario.eventCode.split("-")[0] ?? "FIN";
  return {
    executionId: `EXEC-${code}-2026-12-${String(sequence).padStart(3, "0")}`,
    auditId,
    sequence,
    label: `Execution ${String(sequence).padStart(3, "0")}`,
    createdAt: createdAt ?? reopenTimestamp(sequence),
    status: "open",
    parentExecutionId: parent.executionId,
    eventCount: 0,
    findingCount: 0,
    hasEngineTrail: false,
    immutable: false,
  };
}

export function applyReopen(
  auditId: string,
  extras: readonly ProductExecution[],
  createdAt?: string,
): { readonly next: ProductExecution; readonly extras: ProductExecution[] } {
  const next = reopenAudit(auditId, extras, createdAt);
  return { next, extras: [...extras, next] };
}

export function getExecution(
  auditId: string,
  executionId: string,
  extras: readonly ProductExecution[] = [],
): ProductExecution | null {
  return mergeExecutions(auditId, extras).find((item) => item.executionId === executionId) ?? null;
}

export function lifeLabel(status: AuditLife): string {
  if (status === "sealed") return "Sealed";
  if (status === "open") return "Active";
  if (status === "closed") return "Closed";
  if (status === "review_required") return "Review required";
  if (status === "reopened") return "Reopened";
  if (status === "recorded") return "Recorded";
  if (status === "wip") return "WIP";
  return "Sample";
}

export function auditLifeStatus(
  executions: readonly ProductExecution[],
  pendingReview = false,
): AuditLife {
  const hasOpen = executions.some((item) => item.status === "open");
  const hasFinal = executions.some((item) => item.status === "sealed" || item.status === "recorded");
  if (hasOpen && pendingReview) return "review_required";
  if (hasOpen && hasFinal) return "reopened";
  if (hasOpen) return "open";
  if (executions.some((item) => item.status === "closed") && !hasOpen) return "closed";
  if (executions.some((item) => item.status === "sealed")) return "sealed";
  if (executions.some((item) => item.status === "recorded")) return "recorded";
  if (executions.length === 0) return "wip";
  return "sample";
}

export function parentOf(
  execution: ProductExecution,
  executions: readonly ProductExecution[],
): ProductExecution | null {
  if (!execution.parentExecutionId) return null;
  return executions.find((item) => item.executionId === execution.parentExecutionId) ?? null;
}

export function latestActivity(
  fallback: string,
  executions: readonly ProductExecution[],
): string {
  return executions.reduce(
    (latest, item) => (item.createdAt > latest ? item.createdAt : latest),
    fallback,
  );
}

export function canReopen(auditId: string): boolean {
  return Boolean(resolveScenario(auditId));
}

export function executionHref(auditId: string, executionId: string): string {
  return `/product/audits/${auditId}/executions/${executionId}`;
}

export function executionTraceHref(auditId: string, executionId: string): string {
  return `/product/audits/${auditId}/executions/${executionId}/trace`;
}
