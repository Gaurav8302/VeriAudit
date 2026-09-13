import Link from "next/link";
import "@/components/marketing/marketing.css";

const AREAS = [
  { name: "Overview", note: "A workspace home for current engagements." },
  { name: "Audits", note: "Create, open, and reopen audit workspaces." },
  { name: "Executions", note: "Versioned runs. New work does not rewrite old work." },
  { name: "Evidence", note: "Documents and retrieved source material." },
  { name: "Findings", note: "Exceptions with a reason, a control, and a path back." },
  { name: "Traces", note: "Question → evidence → analysis → decision → verification." },
] as const;

export function ProductEntry() {
  return (
    <div className="product-entry">
      <header className="product-entry-bar">
        <div>
          <p className="chrome-mark">VeriAudit</p>
          <p className="chrome-place">Product workspace</p>
        </div>
        <nav className="chrome-actions" aria-label="Product">
          <Link href="/" className="text-btn">
            Landing
          </Link>
          <Link href="/demo" className="text-btn">
            Demo
          </Link>
        </nav>
      </header>

      <div className="product-entry-body">
        <aside className="product-entry-rail" aria-label="Future navigation">
          <p className="section-label">Workspace</p>
          <ul>
            {AREAS.map((item) => (
              <li key={item.name}>
                <span>{item.name}</span>
                <span className="product-entry-wip">Work in progress</span>
              </li>
            ))}
          </ul>
        </aside>

        <main className="product-entry-main">
          <p className="kicker">Product preview · Work in progress</p>
          <h1 className="display">This is the workspace we are building.</h1>
          <p className="lede">
            You have left the guided demonstration. This route is the product
            entry — not a second demo, and not a finished application.
          </p>
          <p className="lede lede-follow">
            Later iterations will add create-audit, evidence, findings,
            executions, TRACE, and an AI workspace. Those are not implemented
            here. There is no simulated model, and no fabricated analysis.
          </p>

          <section className="product-entry-grid">
            {AREAS.map((item) => (
              <article key={item.name}>
                <h2>{item.name}</h2>
                <p>{item.note}</p>
                <p className="product-entry-wip">Work in progress</p>
              </article>
            ))}
          </section>

          <div className="product-entry-actions">
            <Link href="/demo" className="primary tight link-btn">
              Start the interactive demo
            </Link>
            <Link href="/" className="text-btn">
              Back to VeriAudit
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
