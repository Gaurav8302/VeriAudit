"use client";

import Link from "next/link";
import { formatDay } from "@/lib/product/workspace";
import { phaseLabel } from "@/lib/product/workspacePhase";
import { heroConclusion } from "@/lib/product/workspace";
import { HERO_AUDIT_ID } from "@/lib/product/workspace";
import { useAuditPhase } from "./useAuditPhase";
import { useWorkspace } from "./WorkspaceProvider";

function activityLabel(type: string, title: string): string {
  if (type === "evidence.uploaded" || type === "evidence.added") return title || "Evidence ingested";
  if (type === "ai.action.started") return title || "AI analysis started";
  if (type === "ai.action.completed") return title || "AI analysis completed";
  if (type === "finding.created") return title || "Finding created";
  if (type === "finding.reviewed") return title || "Human review recorded";
  if (type === "audit.execution.started") return "Execution started";
  if (type === "audit.execution.closed") return "Execution closed";
  if (type === "audit.execution.sealed") return "Execution sealed";
  return title || type.replace(/[._]/g, " ");
}

export function LiveExecutionLedger({ auditId }: { auditId: string }) {
  const workspace = useWorkspace();
  const { execution, executions, activities, actions, findings, hasSeal, phase } = useAuditPhase(auditId);
  const hero = auditId === HERO_AUDIT_ID ? heroConclusion() : null;
  const pending = findings.filter((item) => item.review === "pending").length;
  const events = [...activities]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .slice(-6);

  if (!execution) {
    return (
      <aside className="va-ledger">
        <p className="va-kicker">Execution</p>
        <p className="va-empty">No execution yet.</p>
      </aside>
    );
  }

  return (
    <aside className="va-ledger">
      <p className="va-kicker">{execution.label}</p>
      <h2>{phaseLabel(phase)}</h2>
      <p className="va-ledger-meta">
        {execution.executionId}
        {hasSeal ? " · Sealed" : execution.status === "closed" ? " · Closed · Unsealed" : " · Unsealed"}
      </p>
      {events.length === 0 && actions.length === 0 ? (
        <p className="va-empty">No recorded events on this execution yet.</p>
      ) : (
        <ol className="va-ledger-list">
          {events.map((item) => (
            <li key={item.activityId}>
              <time>{item.occurredAt.slice(11, 16) || formatDay(item.occurredAt)}</time>
              <span>{activityLabel(item.type, item.title)}</span>
            </li>
          ))}
        </ol>
      )}
      {hero && execution.sequence === 1 ? (
        <p className="va-ledger-stats">
          {hero.controlsTested} controls · {hero.controlsPassed} passed · {hero.exceptions} exceptions
        </p>
      ) : (
        <p className="va-ledger-stats">
          {findings.length} {findings.length === 1 ? "finding" : "findings"}
          {pending ? ` · ${pending} awaiting review` : ""}
          {actions.length ? ` · ${actions.length} AI actions` : ""}
        </p>
      )}
      <Link href={`/product/audits/${auditId}/trace`}>View full activity</Link>
      {executions.length > 1 ? (
        <div className="va-lineage-mini">
          <p className="va-kicker">Execution history</p>
          {executions.map((item, index) => {
            const sealed = Boolean(workspace.sealFor(item.executionId));
            return (
              <div key={item.executionId}>
                {index > 0 ? <p className="va-reopen-join">↓ Reopened</p> : null}
                <p>
                  <strong>{item.label}</strong>{" "}
                  {sealed || item.status === "sealed"
                    ? "Sealed"
                    : item.status === "open"
                      ? "Active"
                      : item.status === "closed"
                        ? "Closed"
                        : "Recorded"}
                </p>
                <span>
                  {formatDay(item.createdAt)}
                  {item.parentExecutionId ? ` · Based on ${executions.find((parent) => parent.executionId === item.parentExecutionId)?.label ?? item.parentExecutionId}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}
