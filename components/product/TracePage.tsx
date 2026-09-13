"use client";

import { TraceSwitcher, TraceWorkbench } from "./TraceWorkbench";
import { useWorkspace } from "./WorkspaceProvider";
import type { TraceEventRow } from "./TraceEvents";

export function TracePage({
  auditId,
  auditTitle,
  selectedExecutionId,
  originalSpine,
  originalEvents,
}: {
  auditId: string;
  auditTitle: string;
  selectedExecutionId: string | null;
  originalSpine: readonly { eventId: string; title: string; type: string }[];
  originalEvents: readonly TraceEventRow[];
}) {
  const workspace = useWorkspace();
  const selected = selectedExecutionId ?? workspace.selectedId(auditId) ?? workspace.executions(auditId)[0]?.executionId;
  const title = workspace.localAudit(auditId)?.title ?? auditTitle;

  if (!selected) {
    return (
      <p className="va-empty">
        No sealed events yet. Activity performed during this execution will
        appear here.
      </p>
    );
  }

  return (
    <>
      <p className="va-lede">
        What exactly happened on this execution. Expand an event for actor, type,
        time, and related evidence or findings. Recorded is not the same as
        sealed. Sealed is not the same as verified.
      </p>
      <TraceSwitcher auditId={auditId} selectedExecutionId={selected} />
      <TraceWorkbench
        auditId={auditId}
        auditTitle={title}
        selectedExecutionId={selected}
        originalSpine={originalSpine}
        originalEvents={originalEvents}
      />
    </>
  );
}
