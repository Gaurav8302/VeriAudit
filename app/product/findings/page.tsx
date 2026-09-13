import Link from "next/link";
import { listHeroFindings } from "@/lib/product/workspace";

export default function FindingsPage() {
  const findings = listHeroFindings();

  return (
    <>
      <p className="va-intro">
        The future path is Finding → Evidence → Analysis → Review → Execution /
        Trace. Live AI reasoning is not connected in this product phase.
      </p>
      <section className="va-section">
        <h2>Hero findings</h2>
        <table className="va-table">
          <thead>
            <tr>
              <th>Finding</th>
              <th>Audit</th>
              <th>Severity</th>
              <th>Review</th>
              <th>Evidence</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.findingId}>
                <td>
                    <Link href={`/product/audits/${finding.auditId}/findings/${finding.findingId}`}>
                      {finding.findingId}
                    </Link>
                  <span className="meta">{finding.title}</span>
                </td>
                <td>{finding.auditTitle}</td>
                <td>{finding.severity}</td>
                <td>{finding.review}</td>
                <td>{finding.evidence.join(", ")}</td>
                <td>
                  <span className="va-badge sample">Sample</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="va-note">
        These three findings are the computed hero exceptions from the
        financial scenario. They are labelled Sample here because this view
        did not re-verify CooL receipts.
      </p>
    </>
  );
}
