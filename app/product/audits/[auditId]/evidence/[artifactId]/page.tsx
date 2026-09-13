import Link from "next/link";
import { Term } from "@/components/product/Term";
import { LocalEvidenceDetail } from "@/components/product/LocalRecordDetail";
import { loadAuditWorkspace, relatedFindings } from "@/lib/product/load";
import { getArtifactContent } from "@/lib/product/workspace";

export const dynamic = "force-dynamic";

export default async function EvidenceDetailPage({
  params,
}: {
  params: Promise<{ auditId: string; artifactId: string }>;
}) {
  const { auditId, artifactId } = await params;
  const workspace = await loadAuditWorkspace(auditId);
  const item = workspace?.evidence.find((artifact) => artifact.artifactId === artifactId);
  if (!workspace || !item) {
    return <LocalEvidenceDetail auditId={auditId} artifactId={artifactId} />;
  }
  const related = relatedFindings(artifactId, workspace.findings);
  const file = getArtifactContent(artifactId);

  return (
    <>
      <p className="va-crumb">
        <Link href={`/product/audits/${auditId}/evidence`}>← Evidence</Link>
      </p>
      <p className="va-wip">Sample artifact · not analysed live</p>
      <p className="va-lede">
        {item.title} is one of the artifacts used during this{" "}
        <Term name="audit">audit</Term>. Downloading it does not run AI analysis.
      </p>
      <dl className="va-detail">
        <div>
          <dt>Artifact</dt>
          <dd>{item.artifactId}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{item.kind.replace("_", " ")}</dd>
        </div>
        <div>
          <dt>Audit</dt>
          <dd>{item.auditTitle}</dd>
        </div>
        <div>
          <dt>Record</dt>
          <dd>
            <span className="va-badge sample">Sample</span>
          </dd>
        </div>
      </dl>
      {related.length > 0 && (
        <section className="va-section">
          <h2>Related findings</h2>
          <ul className="va-list">
            {related.map((finding) => (
              <li key={finding.findingId}>
                <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                  <strong>
                    {finding.findingId} — {finding.title}
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {file && (
        <section className="va-section">
          <h2>Authored contents</h2>
          <pre className="va-pre">{file.text}</pre>
        </section>
      )}
      <p className="va-note">
        <Link href={`/api/product/testdata?id=${artifactId}`}>Download plaintext</Link>
      </p>
    </>
  );
}
