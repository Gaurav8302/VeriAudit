import Link from "next/link";

export function AskVeriAudit({ auditId }: { auditId?: string }) {
  return (
    <section className="va-section">
      <h2>AI audit assistant</h2>
      <p className="va-empty">
        The assistant analyzes attached evidence, performs assigned audit tasks,
        and records those actions on the execution. Chat explains the work. The
        trace is the record.
      </p>
      {auditId ? (
        <p className="va-empty">
          <Link href={`/product/audits/${auditId}/ai`}>Open the AI assistant</Link>
          . Work on an open execution is recorded as unsealed actions, not as
          CooL receipts.
        </p>
      ) : (
        <p className="va-wip">AI analysis · available inside an open execution</p>
      )}
    </section>
  );
}
