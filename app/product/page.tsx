import Link from "next/link";
import { RecentAiActivity } from "@/components/product/RecentAiActivity";
import {
  domainLabel,
  featuredAudits,
  formatDay,
  listHeroFindings,
  listWorkspaceExecutions,
  recentActivity,
  recordLabel,
} from "@/lib/product/workspace";

export default function OverviewPage() {
  const audits = featuredAudits();
  const executions = listWorkspaceExecutions().slice(0, 6);
  const findings = listHeroFindings();
  const activity = recentActivity(8);

  return (
    <>
      <p className="va-wip">Work in progress</p>
      <p className="va-intro va-home-pitch">
        Run AI-assisted audit work while keeping every meaningful execution
        traceable. The assistant analyzes evidence you attach. Humans review
        findings. VeriAudit records the execution so it can be inspected later.
      </p>
      <p className="va-empty">
        Sample audits below are for orientation. Nothing here is
        cryptographically verified unless a product execution has been sealed
        and the server has confirmed it, or you complete the guided demo and
        hold a receipt.
      </p>

      <div className="va-actions">
        <Link href="/product/audits/new" className="va-btn va-btn-primary">
          Create Audit
        </Link>
        <Link href="/product/audits" className="va-btn">
          Inspect Audits
        </Link>
        <Link href="/product/data" className="va-btn">
          Download sample data
        </Link>
      </div>

      <RecentAiActivity />

      <div className="va-grid">
        <section className="va-panel">
          <h2>Active audits</h2>
          <table className="va-table">
            <thead>
              <tr>
                <th>Audit</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Findings</th>
                <th>Last activity</th>
                <th>Execution</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.auditId}>
                  <td>
                    <Link href={`/product/audits/${audit.auditId}`}>{audit.title}</Link>
                    <span className="meta">{audit.auditId}</span>
                  </td>
                  <td>{domainLabel(audit.domain)}</td>
                  <td>{audit.status.replace("_", " ")}</td>
                  <td>{audit.findingCount}</td>
                  <td>{formatDay(audit.lastActivity)}</td>
                  <td>{audit.executionId ?? "—"}</td>
                  <td>
                    <span className="va-badge sample">{recordLabel(audit.record)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="va-panel">
          <h2>Recent findings</h2>
          <ul className="va-list">
            {findings.map((finding) => (
              <li key={finding.findingId}>
                <Link href={`/product/audits/${finding.auditId}/findings/${finding.findingId}`}>
                  <strong>
                    {finding.findingId} — {finding.title}
                  </strong>
                </Link>
                <span>
                  {finding.controlId} · {finding.review} · Sample
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="va-section">
        <h2>Recent executions</h2>
        <table className="va-table">
          <thead>
            <tr>
              <th>Execution</th>
              <th>Audit</th>
              <th>Started</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((item) => (
              <tr key={item.executionId}>
                <td>
                  <Link
                    href={
                      item.hasEngineTrail
                        ? `/product/audits/${item.auditId}/executions`
                        : "/product/executions"
                    }
                  >
                    {item.executionId}
                  </Link>
                </td>
                <td>{item.auditTitle}</td>
                <td>{formatDay(item.startedAt)}</td>
                <td>
                  <span className="va-badge sample">{recordLabel(item.record)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="va-section">
        <h2>Recent activity</h2>
        <table className="va-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Type</th>
              <th>When</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item) => (
              <tr key={item.activityId}>
                <td>
                  {item.title}
                  <span className="meta">{item.auditId ?? "Workspace"}</span>
                </td>
                <td>{item.type.replace("_", " ")}</td>
                <td>{formatDay(item.occurredAt)}</td>
                <td>
                  <span className="va-badge sample">Sample</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
