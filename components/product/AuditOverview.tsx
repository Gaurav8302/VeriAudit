"use client";

import Link from "next/link";
import { findingReviewLabel, isWritableExecution } from "@/lib/product/localWorkspace";
import type { AuditWorkspaceData } from "@/lib/product/load";
import { HERO_AUDIT_ID } from "@/lib/product/workspace";
import { AiWorkspace } from "./AiWorkspace";
import { DemoMark } from "./LifeBadge";
import { LiveExecutionLedger } from "./LiveExecutionLedger";
import { SealPanel } from "./SealPanel";
import { useAuditPhase } from "./useAuditPhase";
import { useWorkspace } from "./WorkspaceProvider";

export function AuditOverview({
  auditId,
  catalog,
}: {
  auditId: string;
  catalog: AuditWorkspaceData | null;
}) {
  const workspace = useWorkspace();
  const { execution, findings, evidence, phase } = useAuditPhase(auditId);
  const local = workspace.localAudit(auditId);
  const writable = isWritableExecution(execution);
  const catalogEvidence = execution?.sequence === 1 ? catalog?.evidence ?? [] : [];
  const catalogFindings = execution?.sequence === 1 ? catalog?.findings ?? [] : [];
  const showCatalog = auditId === HERO_AUDIT_ID || (!local && Boolean(catalog));

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
      {local?.description ? <p className="va-lede">{local.description}</p> : null}

      <div className="va-stage">
        <AiWorkspace auditId={auditId} compact />
        <LiveExecutionLedger auditId={auditId} />
      </div>

      <div className="va-rail-grid">
        <section className="va-panel-quiet">
          <h2>Evidence available to AI</h2>
          {evidence.length > 0 || catalogEvidence.length > 0 ? (
            <ul className="va-list">
              {evidence.map((item) => (
                <li key={item.artifactId}>
                  <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                    <strong>{item.filename ?? item.title}</strong>
                  </Link>
                  <span>
                    {item.kind}
                    {item.fingerprint ? ` · ${item.fingerprint.slice(0, 10)}` : ""}
                    {item.extraction === "text" ? " · Ready" : ""}
                  </span>
                </li>
              ))}
              {evidence.length === 0
                ? catalogEvidence.map((item) => (
                    <li key={item.artifactId}>
                      <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                        <strong>{item.title}</strong>
                      </Link>
                      <span>
                        {item.kind} <DemoMark />
                      </span>
                    </li>
                  ))
                : null}
            </ul>
          ) : (
            <p className="va-empty">
              No evidence on this execution yet.
              {writable ? " Add evidence, then ask the assistant to review it." : ""}
            </p>
          )}
          {writable ? (
            <p className="va-inline-row">
              <Link href={`/product/audits/${auditId}/evidence`}>Add evidence</Link>
              {" · "}
              <a href="#ai-assistant">Ask AI to review</a>
            </p>
          ) : null}
        </section>

        <section className="va-panel-quiet">
          <h2>Findings</h2>
          {findings.length === 0 && catalogFindings.length === 0 ? (
            <p className="va-empty">No findings on this execution yet.</p>
          ) : (
            <ul className="va-list">
              {findings.map((finding) => (
                <li key={finding.findingId}>
                  <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                    <strong>
                      {finding.findingId} — {finding.title}
                    </strong>
                  </Link>
                  <span>
                    {finding.severity} · {findingReviewLabel(finding.review)}
                    {finding.origin === "ai" ? " · AI proposal" : ""}
                  </span>
                </li>
              ))}
              {findings.length === 0
                ? catalogFindings.map((finding) => (
                    <li key={finding.findingId}>
                      <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                        <strong>
                          {finding.findingId} — {finding.title}
                        </strong>
                      </Link>
                      <span>
                        {finding.review} <DemoMark />
                      </span>
                    </li>
                  ))
                : null}
            </ul>
          )}
        </section>
      </div>

      {phase === "ready_to_seal" || phase === "sealed" ? (
        <div id="execution-seal">
          <SealPanel auditId={auditId} confirmOpen={phase === "ready_to_seal"} />
        </div>
      ) : showCatalog && execution?.hasEngineTrail ? (
        <p className="va-empty">
          This catalog execution is recorded for orientation. It is not a live CooL seal.
        </p>
      ) : null}
    </div>
  );
}
