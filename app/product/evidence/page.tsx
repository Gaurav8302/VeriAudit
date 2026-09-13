import Link from "next/link";
import { listEngineEvidence } from "@/lib/product/workspace";

export default function EvidencePage() {
  const artifacts = listEngineEvidence();

  return (
    <>
      <p className="va-intro">
        These are authored artifacts from the locked scenarios. They were not
        uploaded here and have not been analysed by a live model.
      </p>
      <section className="va-section">
        <h2>Evidence</h2>
        <table className="va-table">
          <thead>
            <tr>
              <th>Artifact</th>
              <th>Kind</th>
              <th>Audit</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((item) => (
              <tr key={item.artifactId}>
                <td>
                    <Link href={`/product/audits/${item.auditId}/evidence/${item.artifactId}`}>
                      {item.title}
                    </Link>
                  <span className="meta">{item.artifactId}</span>
                </td>
                <td>{item.kind.replace("_", " ")}</td>
                <td>
                  <Link href={`/product/audits/${item.auditId}`}>{item.auditTitle}</Link>
                </td>
                <td>
                  <span className="va-badge sample">Sample</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="va-note">
        Download authored plaintext from Sample data. New uploads belong on an
        open execution in an audit workspace.
      </p>
    </>
  );
}
