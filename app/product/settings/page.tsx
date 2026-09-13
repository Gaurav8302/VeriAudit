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
            <dd>Not connected</dd>
          </div>
        </dl>
      </section>
      <section className="va-section">
        <h2>Integrations</h2>
        <ul className="va-list">
          <li>
            <strong>CooL</strong>
            <span>Used by the guided demo to seal and verify executions. Not claimed here without receipts.</span>
          </li>
          <li>
            <strong>AI gateway</strong>
            <span>Will be connected in a later product phase when credentials are supplied.</span>
          </li>
          <li>
            <strong>Document ingestion</strong>
            <span>Being implemented. Uploads are not processed in this iteration.</span>
          </li>
        </ul>
      </section>
      <ClearLocalWorkspace />
    </>
  );
}
