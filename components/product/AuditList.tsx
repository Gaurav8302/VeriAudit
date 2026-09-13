"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { domainLabel, filterAudits, formatDay } from "@/lib/product/workspace";
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
              <th>Executions</th>
              <th>Findings</th>
              <th>Evidence</th>
              <th>Last activity</th>
              <th>Trace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((audit) => {
              const executions = workspace.executions(audit.auditId);
              const status = executions.length
                ? auditLifeStatus(executions)
                : audit.origin === "local"
                  ? "open"
                  : audit.hasEngineTrail
                    ? "recorded"
                    : "sample";
              const activity = latestActivity(audit.lastActivity, executions);
              const hasTrace = executions.some((item) => item.hasEngineTrail);
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
                  <td>{executions.length || audit.executionCount}</td>
                  <td>{audit.findingCount}</td>
                  <td>{audit.evidenceCount ?? 0}</td>
                  <td>{formatDay(activity)}</td>
                  <td>{hasTrace ? "Recorded" : "None yet"}</td>
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
