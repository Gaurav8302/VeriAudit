"use client";

import Link from "next/link";
import { formatDay } from "@/lib/product/workspace";
import {
  executionHref,
  parentOf,
  type ProductExecution,
} from "@/lib/product/lineage";
import { useAuditExecutions, useWorkspace } from "./LineageProvider";
import { ExecutionLineage } from "./ExecutionLineage";
import { ActivityTimeline } from "./ActivityTimeline";
import { LifeBadge } from "./LifeBadge";
import { TraceEvents, type TraceEventRow } from "./TraceEvents";

export function TraceWorkbench({
  auditId,
  auditTitle,
  selectedExecutionId,
  originalSpine,
  originalEvents,
}: {
  auditId: string;
  auditTitle: string;
  selectedExecutionId: string;
  originalSpine: readonly { eventId: string; title: string; type: string }[];
  originalEvents: readonly TraceEventRow[];
}) {
  const workspace = useWorkspace();
  const { executions } = useAuditExecutions(auditId);
  const selected =
    executions.find((item) => item.executionId === selectedExecutionId) ?? executions[0] ?? null;
  const original = executions[0] ?? null;
  const parent = selected ? parentOf(selected, executions) : null;
  const later = executions.find((item) => item.parentExecutionId === selected?.executionId);

  if (!selected) {
    return (
      <p className="va-empty">This catalog row has no execution to attach a trace to.</p>
    );
  }

  const isOriginal = original && selected.executionId === original.executionId;
  const isSealed = selected.status === "sealed";
  const showOriginal = Boolean(isOriginal && original?.hasEngineTrail && originalEvents.length > 0);

  return (
    <>
      {executions.length > 1 && (
        <section className="va-section">
          <h2>How the trails connect</h2>
          <p className="va-empty">
            A new trail is a new execution inside the same audit. It is not a
            new audit, and it does not rewrite the earlier execution.
          </p>
          <ExecutionLineage
            auditId={auditId}
            executions={executions}
            selectedId={selected.executionId}
            sealedIds={executions.filter((item) => workspace.sealFor(item.executionId)).map((item) => item.executionId)}
          />
        </section>
      )}

      <section className="va-section">
        <h2>{isSealed ? "Sealed execution" : "Unsealed execution"}</h2>
        <div className="va-empty">
          {isSealed ? (
            <>
              <p>
                This execution was completed and sealed on {formatDay(selected.createdAt)}.
              </p>
              {later ? (
                <p>
                  A later execution was opened on {formatDay(later.createdAt)}. The
                  original record remains unchanged.
                </p>
              ) : (
                <p>This is the original recorded trail for {auditTitle}.</p>
              )}
            </>
          ) : (
            <>
              {parent ? (
                <>
                  <p>Reopened from</p>
                  <p>{auditTitle}</p>
                  <p>{parent.label}</p>
                </>
              ) : (
                <p>This execution is open. No sealed events belong to it yet.</p>
              )}
              <p>
                Status: <LifeBadge status={selected.status} />
              </p>
            </>
          )}
        </div>
        <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
          <Link href={executionHref(auditId, selected.executionId)} className="va-btn">
            Back to {selected.label}
          </Link>
          <Link href={`/product/audits/${auditId}/executions`} className="va-btn">
            All executions
          </Link>
        </div>
      </section>

      {showOriginal ? (
        <>
          {originalSpine.length > 0 && (
            <section className="va-section">
              <h2>Recorded causal path</h2>
              <ol className="va-spine">
                {originalSpine.map((step, index) => (
                  <li key={step.eventId}>
                    <span className="va-spine-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="va-spine-dot" aria-hidden="true" />
                    <div className="va-spine-body">
                      <strong>{step.title}</strong>
                      <span className="meta">{step.type}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <TraceEvents
            events={originalEvents}
            executionLabel={selected.label}
            executionStatus="Sealed"
          />
        </>
      ) : (
        <>
          <section className="va-section">
            <h2>Trace</h2>
            <p className="va-empty">
              No sealed events yet. Activity performed during this execution will
              appear here. Status: unsealed.
            </p>
          </section>
          <ActivityTimeline
            auditId={auditId}
            executionId={selected.executionId}
            label={selected.label}
          />
        </>
      )}
    </>
  );
}

export function TraceSwitcher({
  auditId,
  selectedExecutionId,
}: {
  auditId: string;
  selectedExecutionId?: string;
}) {
  const { executions } = useAuditExecutions(auditId);
  if (executions.length < 2) return null;
  return (
    <nav className="va-actions" aria-label="Choose a trace">
      {executions.map((execution: ProductExecution) => (
        <Link
          key={execution.executionId}
          href={`/product/audits/${auditId}/executions/${execution.executionId}/trace`}
          className={`va-btn${selectedExecutionId === execution.executionId ? " va-btn-primary" : ""}`}
        >
          {execution.label} trace
        </Link>
      ))}
    </nav>
  );
}
