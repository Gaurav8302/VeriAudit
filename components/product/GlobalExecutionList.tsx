"use client";

import Link from "next/link";
import {
  domainLabel,
  formatDay,
  type WorkspaceExecution,
} from "@/lib/product/workspace";
import { executionHref } from "@/lib/product/lineage";
import { useWorkspace } from "./WorkspaceProvider";
import { LifeBadge } from "./LifeBadge";

export function GlobalExecutionList({ catalog }: { catalog: WorkspaceExecution[] }) {
  const workspace = useWorkspace();
  const localRows = workspace.audits
    .filter((audit) => audit.origin === "local")
    .flatMap((audit) =>
      workspace.executions(audit.auditId).map((item) => ({
        audit,
        item,
      })),
    );
  const extraRows = workspace.catalog.flatMap((audit) =>
    workspace
      .extras(audit.auditId)
      .map((item) => ({ audit, item })),
  );

  return (
    <section className="va-section">
      <h2>Executions</h2>
      <table className="va-table">
        <thead>
          <tr>
            <th>Execution</th>
            <th>Audit</th>
            <th>Domain</th>
            <th>Started</th>
            <th>Status</th>
            <th>Trace</th>
          </tr>
        </thead>
        <tbody>
          {catalog.map((item) => (
            <tr key={item.executionId}>
              <td>
                <Link
                  href={
                    item.hasEngineTrail
                      ? executionHref(item.auditId, item.executionId)
                      : `/product/audits/${item.auditId}`
                  }
                >
                  {item.executionId}
                </Link>
                <span className="meta">{item.note}</span>
              </td>
              <td>{item.auditTitle}</td>
              <td>{domainLabel(item.domain)}</td>
              <td>{formatDay(item.startedAt)}</td>
              <td>
                <LifeBadge
                  status={
                    item.auditId === "AUD-FIN-2026-09"
                      ? "sealed"
                      : item.hasEngineTrail
                        ? "recorded"
                        : "sample"
                  }
                />
              </td>
              <td>{item.hasEngineTrail ? "Recorded" : "None yet"}</td>
            </tr>
          ))}
          {extraRows.map(({ audit, item }) => (
            <tr key={item.executionId}>
              <td>
                <Link href={executionHref(item.auditId, item.executionId)}>{item.label}</Link>
                <span className="meta">Later execution on {audit.title}</span>
              </td>
              <td>{audit.title}</td>
              <td>{domainLabel(audit.domain)}</td>
              <td>{formatDay(item.createdAt)}</td>
              <td>
                <LifeBadge status={item.status} />
              </td>
              <td>{item.hasEngineTrail ? "Recorded" : "Unsealed"}</td>
            </tr>
          ))}
          {localRows.map(({ audit, item }) => (
            <tr key={item.executionId}>
              <td>
                <Link href={executionHref(item.auditId, item.executionId)}>{item.label}</Link>
                <span className="meta">Local workspace execution</span>
              </td>
              <td>{audit.title}</td>
              <td>{domainLabel(audit.domain)}</td>
              <td>{formatDay(item.createdAt)}</td>
              <td>
                <LifeBadge status={item.status} />
              </td>
              <td>Unsealed</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
