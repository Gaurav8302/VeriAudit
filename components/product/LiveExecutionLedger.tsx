"use client";

import Link from "next/link";
import { formatDay, heroConclusion, HERO_AUDIT_ID } from "@/lib/product/workspace";
import { findingReviewLabel } from "@/lib/product/localWorkspace";
import { phaseLabel } from "@/lib/product/workspacePhase";
import { ExecutionSwitcher } from "./ExecutionSwitcher";
import { SealPanel } from "./SealPanel";
import { WorkspaceCommand } from "./WorkspaceCommand";
import { useAuditPhase } from "./useAuditPhase";
import { useWorkspace } from "./WorkspaceProvider";

function activityMark(type: string, title: string): { done: boolean; label: string } {
  if (type === "evidence.uploaded" || type === "evidence.added") {
    return { done: true, label: title || "Evidence ingested" };
  }
  if (type === "ai.action.started" || type === "ai.action.completed") {
    return { done: type === "ai.action.completed", label: title || "AI action" };
  }
  if (type === "finding.created") return { done: true, label: title || "Finding created" };
  if (type === "finding.reviewed") return { done: true, label: title || "Human review" };
  if (type === "execution.closed") return { done: true, label: "Execution closed" };
  if (type === "execution.opened") return { done: true, label: "Execution opened" };
  return { done: true, label: title || type.replace(/[._]/g, " ") };
}

export function LiveExecutionLedger({
  auditId,
  title,
  domain,
}: {
  auditId: string;
  title?: string;
  domain?: string;
}) {
  const workspace = useWorkspace();
  const { execution, executions, activities, actions, findings, evidence, hasSeal, phase } = useAuditPhase(auditId);
  const hero = auditId === HERO_AUDIT_ID ? heroConclusion() : null;
  const pending = findings.filter((item) => item.review === "pending");
  const events = [...activities]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .slice(-8);

  if (!execution) {
    return (
      <aside className="va-rail" aria-label="Execution">
        <p className="va-kicker">Execution</p>
        <p className="va-empty">No execution yet.</p>
      </aside>
    );
  }

  return (
    <aside className="va-rail" aria-label="Execution">
      <header className="va-rail-head">
        <p className="va-kicker">Execution</p>
        <h2>{execution.label.replace("Execution ", "")}</h2>
        <p className="va-rail-status">{phaseLabel(phase)}</p>
        {title ? (
          <p className="va-rail-meta">
            {domain ? `${domain} · ` : ""}
            {title}
          </p>
        ) : null}
      </header>

      <div className="va-rail-stats">
        {hero && execution.sequence === 1 ? (
          <>
            <p>
              <strong>{hero.controlsTested}</strong> controls
            </p>
            <p>
              <strong>{hero.findings}</strong> findings
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>{evidence.length}</strong> evidence
            </p>
            <p>
              <strong>{findings.length}</strong> findings
            </p>
          </>
        )}
      </div>

      <WorkspaceCommand auditId={auditId} placement="rail" />

      <ol className="va-rail-events">
        {events.length === 0 && actions.length === 0 ? (
          <li className="is-empty">Waiting for the first AI action.</li>
        ) : (
          events.map((item) => {
            const mark = activityMark(item.type, item.title);
            return (
              <li key={item.activityId}>
                <span aria-hidden="true">{mark.done ? "●" : "○"}</span>
                <span>{mark.label}</span>
              </li>
            );
          })
        )}
        {pending.length > 0 ? (
          <li>
            <span aria-hidden="true">○</span>
            <span>Review pending</span>
          </li>
        ) : null}
      </ol>

      {findings.length > 0 ? (
        <div className="va-rail-block">
          <p className="va-kicker">Findings</p>
          <ul>
            {findings.slice(0, 4).map((finding) => (
              <li key={finding.findingId}>
                <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                  {finding.findingId}
                </Link>
                <span>{findingReviewLabel(finding.review)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div id="execution-seal">
        <SealPanel auditId={auditId} confirmOpen={phase === "ready_to_seal"} compact />
      </div>

      {executions.length > 1 ? (
        <div className="va-rail-block">
          <p className="va-kicker">History</p>
          {executions.map((item, index) => {
            const sealed = Boolean(workspace.sealFor(item.executionId));
            return (
              <div key={item.executionId}>
                {index > 0 ? <p className="va-reopen-join">↓ Reopened</p> : null}
                <p>
                  <strong>{item.label}</strong>{" "}
                  {sealed || item.status === "sealed" ? "Sealed" : item.status === "open" ? "Active" : "Closed"}
                </p>
                <span>{formatDay(item.createdAt)}</span>
              </div>
            );
          })}
          <ExecutionSwitcher auditId={auditId} />
        </div>
      ) : null}

      <Link className="va-rail-more" href={`/product/audits/${auditId}/trace`}>
        View full activity
      </Link>
    </aside>
  );
}
