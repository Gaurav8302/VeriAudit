import Link from "next/link";

export function AskVeriAudit({ auditId }: { auditId?: string }) {
  return (
    <section className="va-section">
      <h2>Ask VeriAudit</h2>
      <p className="va-empty">
        Future versions will let auditors interact with AI while every
        meaningful analysis action becomes part of the execution record.
      </p>
      {auditId ? (
        <p className="va-empty">
          <Link href={`/product/audits/${auditId}/ai`}>Open the AI workspace</Link>
          . Work on an open execution is recorded as unsealed actions, not as
          CooL receipts.
        </p>
      ) : (
        <p className="va-wip">AI analysis · available inside an open execution</p>
      )}
    </section>
  );
}
