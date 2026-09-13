import { ClearLocalWorkspace } from "@/components/product/ClearLocalWorkspace";

export default function SettingsPage() {
  return (
    <>
      <p className="va-wip">Work in progress</p>
      <section className="va-section">
        <h2>Workspace</h2>
        <dl className="va-detail">
          <div>
            <dt>Name</dt>
            <dd>VeriAudit preview</dd>
          </div>
          <div>
            <dt>Product status</dt>
            <dd>Early workspace</dd>
          </div>
          <div>
            <dt>Authentication</dt>
            <dd>Not implemented</dd>
          </div>
          <div>
            <dt>AI providers</dt>
            <dd>Server-side gateway. Keys stay on the server.</dd>
          </div>
        </dl>
      </section>
      <section className="va-section">
        <h2>Integrations</h2>
        <ul className="va-list">
          <li>
            <strong>CooL</strong>
            <span>
              Used by the guided demo and by closed product executions. The
              browser does not decide verified.
            </span>
          </li>
          <li>
            <strong>AI gateway</strong>
            <span>Connected for workspace analysis when credentials are present.</span>
          </li>
          <li>
            <strong>Document ingestion</strong>
            <span>Text, CSV, and JSON extract in the product workspace. XLSX remains fingerprint-only.</span>
          </li>
        </ul>
      </section>
      <ClearLocalWorkspace />
    </>
  );
}
