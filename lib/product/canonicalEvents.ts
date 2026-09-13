/**
 * Maps product-layer work to canonical event types for a future or completed
 * CooL seal. These records are not receipts. `sealed` is only true after a
 * server seal bundle exists for the execution.
 */
import type { LocalActivity, LocalAiAction, WorkspaceState } from "./localWorkspace";
import type { ProductEventName } from "./sealTypes";

export type CanonicalEventType = ProductEventName;

export interface CanonicalEvent {
  readonly type: CanonicalEventType;
  readonly executionId: string;
  readonly title: string;
  readonly occurredAt: string;
  readonly sealed: boolean;
}

const ACTIVITY_MAP: Partial<Record<LocalActivity["type"], CanonicalEventType>> = {
  "execution.opened": "audit.execution.started",
  "evidence.added": "evidence.ingested",
  "evidence.uploaded": "evidence.ingested",
  "ai.action.started": "ai.action.started",
  "ai.action.completed": "ai.action.completed",
  "finding.created": "finding.created",
  "finding.reviewed": "finding.reviewed",
  "execution.closed": "audit.execution.closed",
};

export function canonicalEventsFor(
  state: WorkspaceState,
  executionId: string,
): CanonicalEvent[] {
  const sealed = Boolean(state.seals[executionId]);
  const fromActivities = state.activities
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
          sealed,
        },
      ];
    });
  const fromReads = state.actions
    .filter(
      (item) =>
        item.executionId === executionId &&
        item.type === "READ_EVIDENCE" &&
        item.status === "completed",
    )
    .map((item) => ({
      type: "evidence.read" as const,
      executionId,
      title: item.title,
      occurredAt: item.completedAt ?? item.occurredAt,
      sealed,
    }));
  return [...fromActivities, ...fromReads].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function readActionsFor(actions: readonly LocalAiAction[]): LocalAiAction[] {
  return actions.filter((item) => item.type === "READ_EVIDENCE");
}
