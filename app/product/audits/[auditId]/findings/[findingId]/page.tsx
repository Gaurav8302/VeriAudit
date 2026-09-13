import Link from "next/link";
import { Term } from "@/components/product/Term";
import { FindingDetailGate } from "@/components/product/FindingDetailGate";
import { LocalFindingDetail } from "@/components/product/LocalRecordDetail";
import { executionHref, executionTraceHref } from "@/lib/product/lineage";
import { loadAuditWorkspace } from "@/lib/product/load";

export const dynamic = "force-dynamic";

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ auditId: string; findingId: string }>;
}) {
  const { auditId, findingId } = await params;
  const workspace = await loadAuditWorkspace(auditId);
  const finding = workspace?.findings.find((item) => item.findingId === findingId);
  if (!workspace || !finding) {
    return <LocalFindingDetail auditId={auditId} findingId={findingId} />;
  }

  return (
    <FindingDetailGate auditId={auditId} findingId={findingId}>
      <p className="va-crumb">
        <Link href={`/product/audits/${auditId}/findings`}>← Findings</Link>
      </p>
      <p className="va-wip">Recorded finding · sample · not verified</p>
      <p className="va-lede">
        {finding.findingId} is a <Term name="finding">finding</Term> on{" "}
        {finding.auditTitle}. The text below is from the recorded engine
        result, not a live model call.
      </p>

      <dl className="va-detail">
        <div>
          <dt>Severity</dt>
          <dd>{finding.severity}</dd>
        </div>
        <div>
          <dt>Control</dt>
          <dd>{finding.controlId}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{finding.review}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>
            {workspace.audit.executionId ? (
              <Link href={executionHref(auditId, workspace.audit.executionId)}>
                Execution 001
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <ol className="va-path">
        <li>Finding</li>
        <li>Evidence</li>
        <li>Analysis</li>
        <li>Human review</li>
        <li>Decision</li>
        <li>Execution / Trace</li>
      </ol>

      {finding.description && (
        <section className="va-section">
          <h2>Recorded description</h2>
          <p className="va-note" style={{ padding: "1rem" }}>
            {finding.description}
          </p>
        </section>
      )}

      {finding.rationale && (
        <section className="va-section">
          <h2>Recorded rationale</h2>
          <p className="va-note" style={{ padding: "1rem" }}>
            {finding.rationale}
          </p>
        </section>
      )}

      <section className="va-section">
        <h2>Evidence</h2>
        <ul className="va-list">
          {finding.evidence.map((artifactId) => {
            const artifact = workspace.evidence.find((item) => item.artifactId === artifactId);
            return (
              <li key={artifactId}>
                <Link href={`/product/audits/${auditId}/evidence/${artifactId}`}>
                  <strong>{artifact?.title ?? artifactId}</strong>
                </Link>
                <span>{artifactId}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="va-section">
        <h2>Human review</h2>
        <p className="va-note" style={{ padding: "1rem" }}>
          {finding.reviewer ?? "Reviewer recorded on the hero run."}
          {finding.reviewNote ? ` — ${finding.reviewNote}` : ""}
        </p>
      </section>

      <section className="va-section">
        <h2>AI reasoning</h2>
        <p className="va-note" style={{ padding: "1rem" }}>
          <span className="va-wip">Work in progress</span>
          <br />
          This is a sample catalog finding. Live AI analysis is recorded on
          local executions in the workspace, not rewritten onto this sealed
          sample. The recorded deterministic assessment from reconstruction
          {workspace.assessment ? ` is: “${workspace.assessment}”` : " is not available on this row."}
        </p>
      </section>

      <p className="va-note">
        Inspect the{" "}
        <Link
          href={
            workspace.audit.executionId
              ? executionTraceHref(auditId, workspace.audit.executionId)
              : `/product/audits/${auditId}/trace`
          }
        >
          original trace
        </Link>{" "}
        to walk the recorded causal path.
      </p>
    </FindingDetailGate>
  );
}
