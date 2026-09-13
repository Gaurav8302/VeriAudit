/**
 * Maps product-layer work to canonical event types for a future CooL seal.
 * These records are not receipts and are not verified.
 */
import type { LocalActivity, LocalAiAction, WorkspaceState } from "./localWorkspace";

export type CanonicalEventType =
  | "audit.started"
  | "evidence.ingested"
  | "evidence.read"
  | "ai.action.started"
  | "ai.action.completed"
  | "finding.created"
  | "finding.reviewed"
  | "audit.closed";

export interface CanonicalEvent {
  readonly type: CanonicalEventType;
  readonly executionId: string;
  readonly title: string;
  readonly occurredAt: string;
  readonly sealed: false;
}

const ACTIVITY_MAP: Partial<Record<LocalActivity["type"], CanonicalEventType>> = {
  "execution.opened": "audit.started",
  "evidence.added": "evidence.ingested",
  "evidence.uploaded": "evidence.ingested",
  "ai.action.started": "ai.action.started",
  "ai.action.completed": "ai.action.completed",
  "finding.created": "finding.created",
  "finding.reviewed": "finding.reviewed",
  "execution.closed": "audit.closed",
};

export function canonicalEventsFor(
  state: WorkspaceState,
  executionId: string,
): CanonicalEvent[] {
  return state.activities
    .filter((item) => item.executionId === executionId)
    .flatMap((item) => {
      const type = ACTIVITY_MAP[item.type];
      if (!type) return [];
      return [
        {
          type,
          executionId,
          title: item.title,
          occurredAt: item.occurredAt,
          sealed: false as const,
        },
      ];
    });
}

export function readActionsFor(actions: readonly LocalAiAction[]): LocalAiAction[] {
  return actions.filter((item) => item.type === "READ_EVIDENCE");
}
