"use client";

import Link from "next/link";
import { formatDay, heroConclusion, HERO_AUDIT_ID } from "@/lib/product/workspace";
import type { AuditWorkspaceData } from "@/lib/product/load";
import { Term } from "./Term";
import { AskVeriAudit } from "./AskVeriAudit";
import { WorkspaceActions } from "./WorkspaceActions";
import { useWorkspace } from "./WorkspaceProvider";

export function AuditOverview({
  auditId,
  catalog,
}: {
  auditId: string;
  catalog: AuditWorkspaceData | null;
}) {
  const workspace = useWorkspace();
  const local = workspace.localAudit(auditId);
  const executions = workspace.executions(auditId);
  const localFindings = workspace.findings(auditId);
  const localEvidence = workspace.evidence(auditId);
  const selected = workspace.selectedId(auditId);
  const current = executions.find((item) => item.executionId === selected);
  const hero = auditId === HERO_AUDIT_ID ? heroConclusion() : catalog?.conclusion;
  const title = catalog?.audit.title ?? local?.title ?? auditId;

  if (!catalog && !local && workspace.ready) {
    return (
      <p className="va-empty">
        This audit is not in this workspace.{" "}
        <Link href="/product/audits">Return to audits</Link>.
      </p>
    );
  }

  return (
    <>
      <p className="va-lede">
        An <Term name="audit">audit</Term> is the long-lived workspace. An{" "}
        <Term name="execution">execution</Term> is one recorded run inside it.
        You are currently looking at {current?.label ?? "no execution yet"}.
      </p>
      <WorkspaceActions auditId={auditId} />
      <dl className="va-detail">
        <div>
          <dt>Audit ID</dt>
          <dd>{auditId}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{formatDay(catalog?.audit.openedAt ?? local?.createdAt ?? "")}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{(catalog?.evidence.length ?? 0) + localEvidence.length}</dd>
        </div>
        <div>
          <dt>Findings</dt>
          <dd>{(catalog?.findings.length ?? 0) + localFindings.length}</dd>
        </div>
      </dl>

      {hero && (
        <section className="va-section">
          <h2>Summary</h2>
          <div className="va-stats">
            <div>
              <strong>{hero.controlsTested}</strong>
              <span>Tested</span>
            </div>
            <div>
              <strong>{hero.controlsPassed}</strong>
              <span>Passed</span>
            </div>
            <div>
              <strong>{hero.exceptions}</strong>
              <span>Exceptions</span>
            </div>
            <div>
              <strong>{hero.humanReviews}</strong>
              <span>Reviews</span>
            </div>
          </div>
          <p className="va-empty">
            {hero.controlsTested} tested · {hero.controlsPassed} passed · {hero.exceptions}{" "}
            exceptions. These figures are the authored sample result.
          </p>
        </section>
      )}

      {local && (
        <section className="va-section">
          <h2>Workspace</h2>
          <p className="va-empty">
            {local.description || "No description yet."}
            {local.reference ? ` Reference: ${local.reference}.` : ""} This local
            audit is open and unsealed.
          </p>
        </section>
      )}

      {(catalog?.findings.length || localFindings.length) ? (
        <section className="va-section">
          <h2>Findings</h2>
          <table className="va-table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>Execution</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {catalog?.findings.map((finding) => (
                <tr key={finding.findingId}>
                  <td>
                    <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                      {finding.findingId}
                    </Link>
                    <span className="meta">{finding.title}</span>
                  </td>
                  <td>Execution 001</td>
                  <td>{finding.review}</td>
                </tr>
              ))}
              {localFindings.map((finding) => (
                <tr key={finding.findingId}>
                  <td>
                    <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                      {finding.findingId}
                    </Link>
                    <span className="meta">{finding.title}</span>
                  </td>
                  <td>{executions.find((item) => item.executionId === finding.executionId)?.label ?? finding.executionId}</td>
                  <td>{finding.status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="va-empty">No findings recorded for this execution yet.</p>
      )}

      <AskVeriAudit auditId={auditId} />
      {!hero && !local && (
        <p className="va-note">
          Open <Link href={`/product/audits/${HERO_AUDIT_ID}`}>{title}</Link> is a
          catalog row without a computed conclusion.
        </p>
      )}
    </>
  );
}
