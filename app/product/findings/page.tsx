import Link from "next/link";
import { listHeroFindings } from "@/lib/product/workspace";

export default function FindingsPage() {
  const findings = listHeroFindings();

  return (
    <>
      <p className="va-intro">
        Findings that still need a human decision, or that already have one.
        Catalog rows here are demo data, not a CooL verification result.
      </p>
      <div className="va-finding-cards">
        {findings.map((finding) => (
          <article key={finding.findingId} className="va-finding-card">
            <header>
              <Link href={`/product/audits/${finding.auditId}/findings/${finding.findingId}`}>
                {finding.findingId}
              </Link>
              <span className="va-badge review">{finding.severity}</span>
            </header>
            <h3>{finding.title}</h3>
            <p>
              {finding.auditTitle} · {finding.review} · {finding.controlId}{" "}
              <span className="va-demo">Demo data</span>
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
