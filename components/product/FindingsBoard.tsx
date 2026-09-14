"use client";

import Link from "next/link";
import type { WorkspaceFinding } from "@/lib/product/workspace";
import { findingReviewLabel, isWritableExecution } from "@/lib/product/localWorkspace";
import { DemoMark } from "./LifeBadge";
import { useWorkspace } from "./WorkspaceProvider";

export function FindingsBoard({
  auditId,
  catalog,
}: {
  auditId: string;
  catalog: readonly WorkspaceFinding[];
}) {
  const workspace = useWorkspace();
  const executions = workspace.executions(auditId);
  const selected = workspace.selectedId(auditId);
  const originalId = executions[0]?.executionId;
  const showCatalog = Boolean(catalog.length && selected && selected === originalId);
  const local = selected ? workspace.findings(auditId, selected) : workspace.findings(auditId);
  const current = executions.find((item) => item.executionId === selected);
  const writable = isWritableExecution(current);

  function review(findingId: string, decision: "accepted" | "rejected") {
    try {
      workspace.reviewFinding(findingId, decision);
    } catch {
      // The workspace reducer throws if the execution is no longer writable.
    }
  }

  return (
    <>
      <p className="va-lede">
        A finding is an AI or reviewer exception. AI proposals start open and are never auto-approved.
      </p>
      {current ? (
        <p className="va-empty">Showing findings for {current.label}.</p>
      ) : null}
      {!showCatalog && local.length === 0 ? (
        <p className="va-empty">No findings recorded for this execution.</p>
      ) : (
        <div className="va-finding-cards">
          {showCatalog
            ? catalog.map((finding) => (
                <article key={finding.findingId} className="va-finding-card">
                  <header>
                    <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                      {finding.findingId}
                    </Link>
                    <span className="va-badge review">{finding.severity}</span>
                  </header>
                  <h3>{finding.title}</h3>
                  <p>
                    {finding.review} · {finding.controlId ?? "Control not recorded"} <DemoMark />
                  </p>
                </article>
              ))
            : null}
          {local.map((finding) => (
            <article key={finding.findingId} className="va-finding-card">
              <header>
                <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                  {finding.findingId}
                </Link>
                <span className={`va-badge ${finding.severity === "high" ? "review" : "muted"}`}>
                  {finding.severity}
                </span>
              </header>
              <h3>{finding.title}</h3>
              <p>
                {finding.origin === "ai" ? "AI proposal" : "User finding"} · {findingReviewLabel(finding.review)}
                {finding.evidenceIds.length ? ` · ${finding.evidenceIds.length} evidence` : ""}
              </p>
              {finding.review === "pending" && writable ? (
                <div className="va-actions">
                  <button
                    type="button"
                    className="va-btn va-btn-primary"
                    onClick={() => review(finding.findingId, "accepted")}
                  >
                    Accept finding
                  </button>
                  <button
                    type="button"
                    className="va-btn"
                    onClick={() => review(finding.findingId, "rejected")}
                  >
                    Dismiss
                  </button>
                  <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                    Review details
                  </Link>
                </div>
              ) : (
                <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                  {finding.review === "pending" ? "Review finding" : "Open finding"}
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
