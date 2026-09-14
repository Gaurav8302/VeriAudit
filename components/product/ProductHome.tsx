"use client";

import Link from "next/link";
import { HERO_AUDIT_ID, domainLabel, featuredAudits } from "@/lib/product/workspace";
import { SAMPLE_AUDIT_ID } from "@/lib/product/localWorkspace";
import { DemoMark, PhaseBadge } from "./LifeBadge";
import { RecentAiActivity } from "./RecentAiActivity";
import { StartSampleAudit } from "./StartSampleAudit";
import { useWorkspace } from "./WorkspaceProvider";
import { canSealOnServer, hasPendingReview, workspacePhase } from "@/lib/product/workspacePhase";

export function ProductHome() {
  const workspace = useWorkspace();
  const local = workspace.audits.filter((item) => item.origin === "local");
  const pending = workspace.state.findings.filter((item) => item.review === "pending");
  const ready = workspace.state.audits.flatMap((audit) => {
    const executions = workspace.executions(audit.auditId);
    return executions.filter((execution) => {
      const seal = workspace.sealFor(execution.executionId);
      const findings = workspace.findings(audit.auditId, execution.executionId);
      return (
        canSealOnServer(execution, Boolean(seal)) &&
        !hasPendingReview(findings) &&
        workspace.activities(audit.auditId, execution.executionId).length +
          workspace.actions(audit.auditId, execution.executionId).length >
          0
      );
    });
  });
  const samples = featuredAudits().slice(0, 4);
  const active = local.length ? local : workspace.audits.filter((item) => item.origin === "local");

  return (
    <>
      <section className="va-hero-block">
        <p className="va-kicker">VeriAudit product</p>
        <h2>AI-powered audit work. Every meaningful action traceable.</h2>
        <div className="va-actions">
          <StartSampleAudit />
          <Link href="/product/audits/new" className="va-btn">
            Create Audit
          </Link>
          <Link href="/product/audits" className="va-btn">
            Open Audits
          </Link>
        </div>
      </section>

      <div className="va-home-grid">
        <section className="va-panel-quiet">
          <h2>Active audits</h2>
          {!workspace.ready ? (
            <p className="va-empty">Loading recent audits…</p>
          ) : active.length === 0 ? (
            <p className="va-empty">No local audits yet. Create one to start an execution.</p>
          ) : (
            <ul className="va-list">
              {active.map((audit) => {
                const execution =
                  workspace.executions(audit.auditId).find(
                    (item) => item.executionId === workspace.selectedId(audit.auditId),
                  ) ?? workspace.executions(audit.auditId).at(-1) ?? null;
                const phase = workspacePhase({
                  execution,
                  hasSeal: Boolean(execution && workspace.sealFor(execution.executionId)),
                  findings: workspace.findings(audit.auditId),
                  isCatalogSample: false,
                });
                return (
                  <li key={audit.auditId}>
                    <Link href={`/product/audits/${audit.auditId}`}>
                      <strong>{audit.title}</strong>
                    </Link>
                    <span>
                      {domainLabel(audit.domain)} · {execution?.label ?? "No execution"} · {phase.replace("_", " ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <RecentAiActivity />

        <section className="va-panel-quiet">
          <h2>Findings requiring review</h2>
          {pending.length === 0 ? (
            <p className="va-empty">No AI findings awaiting a human decision.</p>
          ) : (
            <ul className="va-list">
              {pending.slice(0, 6).map((finding) => (
                <li key={finding.findingId}>
                  <Link href={`/product/audits/${finding.auditId}/findings/${finding.findingId}`}>
                    <strong>
                      {finding.findingId} — {finding.title}
                    </strong>
                  </Link>
                  <span>{finding.severity} · Pending</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="va-panel-quiet">
          <h2>Executions ready to seal</h2>
          {ready.length === 0 ? (
            <p className="va-empty">No closed local executions are ready to seal.</p>
          ) : (
            <ul className="va-list">
              {ready.map((execution) => (
                <li key={execution.executionId}>
                  <Link href={`/product/audits/${execution.auditId}`}>
                    <strong>{execution.label}</strong>
                  </Link>
                  <span>{execution.executionId}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="va-panel-quiet">
        <h2>
          Sample workspaces <DemoMark />
        </h2>
        <div className="va-audit-cards va-audit-cards-compact">
          <article className="va-audit-card">
            <header>
              <div>
                <Link href={`/product/audits/${SAMPLE_AUDIT_ID}`}>September Revenue Recognition Audit</Link>
                <p>Financial · Execution 001 · Active</p>
              </div>
              <PhaseBadge phase="active" />
            </header>
            <StartSampleAudit label="Start sample audit" />
          </article>
          {samples
            .filter((audit) => audit.auditId !== HERO_AUDIT_ID)
            .slice(0, 3)
            .map((audit) => (
              <article key={audit.auditId} className="va-audit-card">
                <header>
                  <div>
                    <Link href={`/product/audits/${audit.auditId}`}>{audit.title}</Link>
                    <p>{domainLabel(audit.domain)}</p>
                  </div>
                  <PhaseBadge phase="sample" />
                </header>
                <Link href={`/product/audits/${audit.auditId}`} className="va-btn">
                  Open demo data
                </Link>
              </article>
            ))}
        </div>
      </section>
    </>
  );
}
