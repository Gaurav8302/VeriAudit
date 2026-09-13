import Link from "next/link";
import { SampleExport } from "@/components/product/SampleExport";
import { listEngineEvidence } from "@/lib/product/workspace";

export default function TestDataPage() {
  const artifacts = listEngineEvidence();

  return (
    <>
      <p className="va-intro">
        Not ready to upload your own data? Use the sample audits and these
        authored files to explore the workspace. This is not an export of
        sealed CooL receipts.
      </p>
      <div className="va-actions">
        <SampleExport />
        <Link href="/product/audits" className="va-btn">
          Open sample audits
        </Link>
      </div>
      <section className="va-section">
        <h2>Upload samples</h2>
        <p className="va-empty">
          Use these files in Ask VeriAudit. They are sample records, not sealed
          receipts.
        </p>
        <table className="va-table">
          <thead>
            <tr>
              <th>File</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Q3 General Ledger
                <span className="meta">CSV</span>
              </td>
              <td>
                <a href="/product-samples/q3-general-ledger.csv" download>
                  Download
                </a>
              </td>
            </tr>
            <tr>
              <td>
                Revenue Recognition Policy
                <span className="meta">TXT</span>
              </td>
              <td>
                <a href="/product-samples/revenue-recognition-policy.txt" download>
                  Download
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section className="va-section">
        <h2>Download authored evidence</h2>
        <table className="va-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Audit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((item) => (
              <tr key={item.artifactId}>
                <td>
                  {item.title}
                  <span className="meta">{item.artifactId}.txt</span>
                </td>
                <td>{item.auditTitle}</td>
                <td>
                  <Link href={`/api/product/testdata?id=${item.artifactId}`}>Download</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
