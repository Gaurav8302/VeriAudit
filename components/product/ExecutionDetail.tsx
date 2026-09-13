"use client";

import Link from "next/link";
import { formatDay } from "@/lib/product/workspace";
import {
  executionTraceHref,
  parentOf,
} from "@/lib/product/lineage";
import { useEffect } from "react";
import { ActivityTimeline } from "./ActivityTimeline";
import { ExecutionLineage } from "./ExecutionLineage";
import { LifeBadge } from "./LifeBadge";
import { TraceEvents, type TraceEventRow } from "./TraceEvents";
import { WorkspaceActions } from "./WorkspaceActions";
import { useAuditExecutions, useWorkspace } from "./WorkspaceProvider";

export function ExecutionDetail({
  auditId,
  executionId,
  auditTitle,
  originalEvents,
  originalSpine,
  findings,
}: {
  auditId: string;
  executionId: string;
  auditTitle: string;
  originalEvents: readonly TraceEventRow[];
  originalSpine: readonly { eventId: string; title: string; type: string }[];
  findings: readonly { findingId: string; title: string }[];
}) {
  const workspace = useWorkspace();
  const { executions, ready } = useAuditExecutions(auditId);
  useEffect(() => {
    if (!ready) return;
    if (workspace.selectedId(auditId) !== executionId) {
      workspace.select(auditId, executionId);
    }
  }, [auditId, executionId, ready, workspace]);
  const execution = executions.find((item) => item.executionId === executionId) ?? null;
  const localFindings = workspace.findings(auditId, executionId);
  const parent = execution ? parentOf(execution, executions) : null;
  const later = executions.find((item) => item.parentExecutionId === executionId);

  if (ready && !execution) {
    return (
      <p className="va-empty">
        That execution is not part of this audit.{" "}
        <Link href={`/product/audits/${auditId}/executions`}>Return to executions</Link>.
      </p>
    );
  }

  if (!execution) {
    return <p className="va-empty">Loading execution…</p>;
  }

  const isSealed = execution.status === "sealed";
  const showEngineTrace = Boolean(execution.hasEngineTrail && originalEvents.length > 0);

  return (
    <>
      <p className="va-crumb">
        <Link href={`/product/audits/${auditId}/executions`}>← Executions</Link>
      </p>
      <header className="va-workspace-head">
        <div>
          <h2>{execution.label}</h2>
          <p>
            {auditTitle} · {formatDay(execution.createdAt)} · {execution.executionId}
          </p>
        </div>
        <LifeBadge status={execution.status} />
      </header>

      {isSealed ? (
        <section className="va-section">
          <h2>Sealed execution</h2>
          <p className="va-empty">
            This execution was completed and sealed on {formatDay(execution.createdAt)}.
            {later
              ? ` A later execution was opened on ${formatDay(later.createdAt)}. The original record remains unchanged.`
              : " The original record remains unchanged if this audit is reopened later."}
          </p>
        </section>
      ) : execution.status === "closed" ? (
        <section className="va-section">
          <h2>Closed execution</h2>
          <p className="va-empty">
            {execution.label} closed on {formatDay(execution.closedAt ?? execution.createdAt)}.
            This record cannot be edited. Reopen the audit to start a later
            execution. Status: unsealed — not cryptographically verified.
          </p>
        </section>
      ) : (
        <section className="va-section">
          <h2>{parent ? "Rework execution" : "Active execution"}</h2>
          {parent ? (
            <div className="va-empty">
              <p>Reopened from</p>
              <p>{auditTitle}</p>
              <p>{parent.label}</p>
            </div>
          ) : (
            <p className="va-empty">This execution is active. Activity here is local product work.</p>
          )}
          <p className="va-empty">
            Status: unsealed. These activities have not been cryptographically
            sealed.
          </p>
        </section>
      )}

      <dl className="va-detail">
        <div>
          <dt>{execution.hasEngineTrail ? "Events" : "Actions"}</dt>
          <dd>{execution.eventCount ?? "—"}</dd>
        </div>
        <div>
          <dt>Findings</dt>
          <dd>{execution.findingCount}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>
            {formatDay(execution.createdAt)}
            {execution.closedAt ? ` · Closed ${formatDay(execution.closedAt)}` : ""}
          </dd>
        </div>
        <div>
          <dt>Connection</dt>
          <dd>{parent ? `Reopened from ${parent.label}` : "Original execution"}</dd>
        </div>
      </dl>

      <div className="va-actions">
        <Link href={executionTraceHref(auditId, execution.executionId)} className="va-btn">
          Open {isSealed ? "original" : "current"} trace
        </Link>
        <Link href={`/product/audits/${auditId}/executions`} className="va-btn">
          All executions
        </Link>
      </div>

      {executions.length > 1 && (
        <section className="va-section">
          <h2>How this connects</h2>
          <ExecutionLineage
            auditId={auditId}
            executions={executions}
            selectedId={execution.executionId}
          />
        </section>
      )}

      {showEngineTrace && findings.length > 0 && (
        <section className="va-section">
          <h2>Findings from this execution</h2>
          <ul className="va-list">
            {findings.map((finding) => (
              <li key={finding.findingId}>
                <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                  <strong>
                    {finding.findingId} — {finding.title}
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showEngineTrace && originalSpine.length > 0 && (
        <section className="va-section">
          <h2>Trace preview</h2>
          <ol className="va-spine">
            {originalSpine.slice(0, 9).map((step, index) => (
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
          <p className="va-empty">
            <Link href={executionTraceHref(auditId, execution.executionId)}>
              Inspect the full original trace
            </Link>
          </p>
        </section>
      )}

      {showEngineTrace && (
        <TraceEvents
          events={originalEvents}
          executionLabel={execution.label}
          executionStatus="Sealed"
        />
      )}

      {!isSealed && (
        <>
          <WorkspaceActions auditId={auditId} />
          {localFindings.length > 0 && (
            <section className="va-section">
              <h2>Findings from this execution</h2>
              <ul className="va-list">
                {localFindings.map((finding) => (
                  <li key={finding.findingId}>
                    <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                      <strong>
                        {finding.findingId} — {finding.title}
                      </strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ActivityTimeline
            auditId={auditId}
            executionId={execution.executionId}
            label={execution.label}
          />
        </>
      )}
    </>
  );
}
