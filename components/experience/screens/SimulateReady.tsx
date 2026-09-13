import { APPROVED_CLAIMS } from "@/lib/demo/copy";

export function SimulateReady({
  auditTitle,
  onStart,
}: {
  auditTitle: string;
  onStart: () => void;
}) {
  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Time</p>
        <h1 className="display">{APPROVED_CLAIMS.simulateLater}</h1>
        <p className="lede">
          The organization kept working. New audits opened. Reviews closed.
          Follow-ups accumulated. {auditTitle} became one record among many.
        </p>
        <p className="lede lede-follow">
          Nothing about that original execution has been pinned. Finding it again
          is the point.
        </p>
        <button type="button" className="primary" onClick={onStart}>
          Advance to 15 December 2026
        </button>
      </div>
      <aside className="side-panel contrast">
        <div className="era">
          <p className="section-label">September</p>
          <p className="era-stat">1</p>
          <p>important execution in view</p>
        </div>
        <div className="era later">
          <p className="section-label">December</p>
          <p className="era-stat">55</p>
          <p>activities · 14 audits · four domains</p>
        </div>
      </aside>
    </article>
  );
}
