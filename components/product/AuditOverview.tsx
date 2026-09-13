"use client";

import Link from "next/link";
import { formatDay, heroConclusion, HERO_AUDIT_ID } from "@/lib/product/workspace";
import type { AuditWorkspaceData } from "@/lib/product/load";
import { findingReviewLabel, isWritableExecution } from "@/lib/product/localWorkspace";
import { Term } from "./Term";
import { AiWorkspace } from "./AiWorkspace";
import { WorkspaceActions } from "./WorkspaceActions";
import { useWorkspace } from "./WorkspaceProvider";
import { LifeBadge } from "./LifeBadge";

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
  const selected = workspace.selectedId(auditId);
  const current = executions.find((item) => item.executionId === selected);
  const localFindings = selected ? workspace.findings(auditId, selected) : workspace.findings(auditId);
  const localEvidence = selected ? workspace.evidence(auditId, selected) : workspace.evidence(auditId);
  const hero = auditId === HERO_AUDIT_ID ? heroConclusion() : catalog?.conclusion;
  const title = catalog?.audit.title ?? local?.title ?? auditId;
  const writable = isWritableExecution(current ?? null);

  if (!catalog && !local && workspace.ready) {
    return (
      <p className="va-empty">
        This audit is not in this workspace.{" "}
        <Link href="/product/audits">Return to audits</Link>.
      </p>
    );
  }

  return (
    <div className="va-workspace-canvas">
      <p className="va-lede">
        Humans perform this <Term name="audit">audit</Term>. AI assists. Every
        meaningful action is recorded on {current?.label ?? "this execution"}.
        {current?.status === "closed"
          ? " This execution is closed."
          : writable
            ? " This execution is active and unsealed."
            : " Historical work stays intact."}
      </p>
      <WorkspaceActions auditId={auditId} />
      <dl className="va-detail">
        <div>
          <dt>Audit</dt>
          <dd>{title}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>
            {current ? (
              <>
                {current.label} · {current.executionId}
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{current ? <LifeBadge status={current.status} /> : "—"}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{formatDay(catalog?.audit.openedAt ?? local?.createdAt ?? "")}</dd>
        </div>
      </dl>

      {hero && (
        <section className="va-section">
          <h2>Sealed sample result</h2>
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
            These figures belong to the sealed original. They are not a live AI
            result.
          </p>
        </section>
      )}

      {local ? (
        <section className="va-section">
          <h2>Scope</h2>
          <p className="va-empty">
            {local.description || "No description yet."}
            {local.period ? ` Period: ${local.period}.` : ""}
            {local.reference ? ` Reference: ${local.reference}.` : ""}
          </p>
        </section>
      ) : null}

      <AiWorkspace auditId={auditId} />

      <div className="va-rail-grid">
        <section className="va-section">
          <h2>Evidence on this execution</h2>
          {localEvidence.length > 0 ? (
            <ul className="va-list">
              {localEvidence.map((item) => (
                <li key={item.artifactId}>
                  <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                    <strong>{item.filename ?? item.title}</strong>
                  </Link>
                  <span>
                    {item.kind}
                    {item.fingerprint ? ` · ${item.fingerprint.slice(0, 8)}…` : ""}
                    {item.extraction === "text"
                      ? " · Ready"
                      : item.extraction === "unavailable"
                        ? " · Fingerprint only"
                        : " · Metadata"}
                  </span>
                </li>
              ))}
            </ul>
          ) : current?.sequence === 1 && catalog?.evidence.length ? (
            <ul className="va-list">
              {catalog.evidence.map((item) => (
                <li key={item.artifactId}>
                  <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                    <strong>{item.title}</strong>
                  </Link>
                  <span>{item.kind} · Sample</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="va-empty">
              No evidence uploaded yet. This is the evidence AI works against.
            </p>
          )}
        </section>
        <section className="va-section">
          <h2>Findings needing attention</h2>
          {localFindings.length === 0 && !catalog?.findings.length ? (
            <p className="va-empty">No findings on this execution yet.</p>
          ) : (
            <ul className="va-list">
              {localFindings.map((finding) => (
                <li key={finding.findingId}>
                  <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                    <strong>
                      {finding.findingId} — {finding.title}
                    </strong>
                  </Link>
                  <span>
                    {finding.severity} · {findingReviewLabel(finding.review)}
                  </span>
                </li>
              ))}
              {current?.sequence === 1 &&
                catalog?.findings.map((finding) => (
                  <li key={finding.findingId}>
                    <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                      <strong>
                        {finding.findingId} — {finding.title}
                      </strong>
                    </Link>
                    <span>{finding.review} · Sample</span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
