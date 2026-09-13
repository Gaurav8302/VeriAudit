"use client";

import Link from "next/link";
import type { WorkspaceFinding } from "@/lib/product/workspace";
import { findingReviewLabel } from "@/lib/product/localWorkspace";
import { Term } from "./Term";
import { WorkspaceActions } from "./WorkspaceActions";
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

  return (
    <>
      <p className="va-lede">
        A <Term name="finding">finding</Term> is an exception that still needs a
        human decision. AI proposals start open and are never auto-approved.
      </p>
      <WorkspaceActions auditId={auditId} />
      {current ? (
        <p className="va-empty">
          Showing findings for {current.label}. Switch executions to inspect
          another run.
        </p>
      ) : null}
      {!showCatalog && local.length === 0 ? (
        <p className="va-empty">No findings recorded for this execution.</p>
      ) : (
        <section className="va-section">
          <h2>Findings</h2>
          <table className="va-table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Evidence</th>
                <th>Execution</th>
              </tr>
            </thead>
            <tbody>
              {showCatalog &&
                catalog.map((finding) => (
                <tr key={finding.findingId}>
                  <td>
                    <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                      {finding.findingId}
                    </Link>
                    <span className="meta">{finding.title}</span>
                  </td>
                  <td>{finding.severity}</td>
                  <td>{finding.review}</td>
                  <td>{finding.evidence.join(", ")}</td>
                  <td>
                    <Link
                      href={
                        executions[0]
                          ? `/product/audits/${auditId}/executions/${executions[0].executionId}`
                          : `/product/audits/${auditId}/executions`
                      }
                    >
                      Execution 001
                    </Link>
                  </td>
                </tr>
              ))}
              {local.map((finding) => (
                <tr key={finding.findingId}>
                  <td>
                    <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                      {finding.findingId}
                    </Link>
                    <span className="meta">{finding.title}</span>
                  </td>
                  <td>{finding.severity}</td>
                  <td>{findingReviewLabel(finding.review)}</td>
                  <td>{finding.evidenceIds.join(", ") || "—"}</td>
                  <td>
                    <Link href={`/product/audits/${auditId}/executions/${finding.executionId}`}>
                      {executions.find((item) => item.executionId === finding.executionId)?.label ??
                        finding.executionId}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
