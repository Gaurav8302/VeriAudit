"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { domainLabel, filterAudits, formatRelative } from "@/lib/product/workspace";
import { latestActivity } from "@/lib/product/lineage";
import { DemoMark, PhaseBadge } from "./LifeBadge";
import { useWorkspace } from "./WorkspaceProvider";
import { primaryWorkspaceAction, workspacePhase } from "@/lib/product/workspacePhase";

export function AuditList() {
  const [query, setQuery] = useState("");
  const workspace = useWorkspace();
  const rows = useMemo(() => filterAudits(query, workspace.audits), [query, workspace.audits]);

  return (
    <>
      <label className="va-filter">
        <span>Search audits</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, id, domain…"
        />
      </label>
      <div className="va-audit-cards">
        {rows.map((audit) => {
          const executions = workspace.executions(audit.auditId);
          const findings = workspace.findings(audit.auditId);
          const current =
            executions.find((item) => item.executionId === workspace.selectedId(audit.auditId)) ??
            executions[executions.length - 1] ??
            null;
          const hasSeal = Boolean(current && workspace.sealFor(current.executionId));
          const local = workspace.localAudit(audit.auditId);
          const phase = workspacePhase({
            execution: current,
            hasSeal,
            findings: current ? workspace.findings(audit.auditId, current.executionId) : findings,
            isCatalogSample: !local && (current?.status === "sample" || !current),
          });
          const activity = latestActivity(audit.lastActivity, executions);
          const action = primaryWorkspaceAction({
            phase,
            hasSeal,
            canReopen: workspace.canReopen(audit.auditId),
          });
          return (
            <article key={audit.auditId} className={`va-audit-card is-${phase}`}>
              <header>
                <div>
                  <Link href={`/product/audits/${audit.auditId}`}>{audit.title}</Link>
                  <p>
                    {domainLabel(audit.domain)}
                    {current ? ` · ${current.label}` : ""}
                  </p>
                </div>
                <PhaseBadge phase={phase} />
              </header>
              <p>
                {findings.length} {findings.length === 1 ? "finding" : "findings"}
                {" · "}
                {formatRelative(activity)}
                {!local ? (
                  <>
                    {" · "}
                    <DemoMark />
                  </>
                ) : null}
              </p>
              <Link href={`/product/audits/${audit.auditId}`} className="va-btn va-btn-primary">
                {action === "seal"
                  ? "Seal execution"
                  : action === "verify"
                    ? "Verify execution"
                    : action === "review"
                      ? "Review"
                      : "Open audit"}
              </Link>
            </article>
          );
        })}
      </div>
      {rows.length === 0 && (
        <p className="va-empty">
          No audits match that filter. Create an audit or open a sample workspace.
        </p>
      )}
    </>
  );
}
