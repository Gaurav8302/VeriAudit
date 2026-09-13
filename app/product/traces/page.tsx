import Link from "next/link";
import { reconstructAudit } from "@/lib/search";
import { HERO_AUDIT_ID, HERO_EXECUTION_ID } from "@/lib/product/workspace";

export const dynamic = "force-dynamic";

export default async function TracesPage() {
  const reconstruction = await reconstructAudit(HERO_AUDIT_ID);
  const path =
    reconstruction && reconstruction.kind === "engine" && "why" in reconstruction
      ? reconstruction.why.path
      : [];

  return (
    <>
      <p className="va-intro">
        A TRACE is the recorded causal path — not a new explanation generated
        when someone later asks why. Receipts stay with the demo session, so
        this view is not labelled Sealed or Verified.
      </p>
      <p className="va-note">
        {HERO_EXECUTION_ID} · {HERO_AUDIT_ID} · Integrity in this view:{" "}
        <span className="va-badge muted">Not recorded</span>
      </p>

      {path.length > 0 ? (
        <section className="va-section">
          <h2>Recorded causal path</h2>
          <ol className="va-spine">
            {path.map((step, index) => (
              <li key={step.eventId}>
                <span className="va-spine-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="va-spine-dot" aria-hidden="true" />
                <div className="va-spine-body">
                  <strong>{step.title}</strong>
                  <span className="meta">{step.type}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="va-section">
          <h2>Traces</h2>
          <p className="va-empty">
            Work in progress. The hero trail could not be reconstructed in this
            request. Replay the demo to walk the sealed 9-stage spine.
          </p>
        </section>
      )}

      <p className="va-note">
        Open the hero{" "}
        <Link href={`/product/audits/${HERO_AUDIT_ID}/trace`}>audit workspace trace</Link>
        {" "}for the same reconstruction inside the case.{" "}
        <Link href="/demo">Replay the demo</Link> to verify CooL evidence.
      </p>
    </>
  );
}
