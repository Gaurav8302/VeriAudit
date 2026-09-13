"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { domainLabel, filterAudits, formatRelative } from "@/lib/product/workspace";
import { auditLifeStatus, latestActivity } from "@/lib/product/lineage";
import { useWorkspace } from "./WorkspaceProvider";
import { LifeBadge } from "./LifeBadge";

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
      <section className="va-section">
        <h2>Audits</h2>
        <table className="va-table">
          <thead>
            <tr>
              <th>Audit</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Execution</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((audit) => {
              const executions = workspace.executions(audit.auditId);
              const findings = workspace.findings(audit.auditId);
              const pendingReview = findings.some((item) => item.review === "pending");
              const current =
                executions.find((item) => item.executionId === workspace.selectedId(audit.auditId)) ??
                executions[executions.length - 1] ??
                null;
              const status = executions.length
                ? auditLifeStatus(executions, pendingReview)
                : audit.origin === "local"
                  ? "open"
                  : audit.hasEngineTrail
                    ? "recorded"
                    : "sample";
              const activity = latestActivity(audit.lastActivity, executions);
              return (
                <tr key={audit.auditId}>
                  <td>
                    <Link href={`/product/audits/${audit.auditId}`}>{audit.title}</Link>
                    <span className="meta">{audit.auditId}</span>
                  </td>
                  <td>{domainLabel(audit.domain)}</td>
                  <td>
                    <LifeBadge status={status} />
                  </td>
                  <td>
                    {current ? (
                      <>
                        {current.label}
                        <span className="meta">{current.status === "open" ? "Active" : current.status === "closed" ? "Closed" : current.status === "sealed" ? "Sealed" : "Recorded"}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatRelative(activity)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="va-empty">
            No audits match that filter. Create an audit or open a sample
            workspace.
          </p>
        )}
      </section>
    </>
  );
}
