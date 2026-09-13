import { formatDay, money } from "@/lib/demo/format";
import type { FindingView, ReviewView, RunPayload } from "@/lib/demo/payloads";

export function Result({
  run,
  onContinue,
}: {
  run: RunPayload;
  onContinue: () => void;
}) {
  const { audit, sealing } = run;
  const { summary, findings, reviews, conclusion } = audit;
  const primary = findings[0];
  const rest = findings.slice(1);

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">{formatDay(audit.openedAt)}</p>
        <h1 className="display">{audit.title}</h1>
        <p className="lede">{audit.period}</p>

        <div className="counts" aria-label="Audit result">
          <div>
            <span className="count-value">{summary.controlsTested}</span>
            <span className="count-label">Controls tested</span>
          </div>
          <div>
            <span className="count-value pass">{summary.controlsPassed}</span>
            <span className="count-label">Passed</span>
          </div>
          <div>
            <span className="count-value exception">{summary.exceptions}</span>
            <span className="count-label">Exceptions</span>
          </div>
        </div>

        {primary && <PrimaryFinding finding={primary} />}

        <p className="conclusion">{conclusion.statement}</p>

        {sealing.error && (
          <p className="note">
            The audit completed. Cryptographic evidence was not recorded for this
            session.
          </p>
        )}

        <button type="button" className="primary" onClick={onContinue}>
          Fast forward 3 months
        </button>
      </div>

      <aside className="side-panel">
        <p className="section-label">Other exceptions</p>
        {rest.map((finding) => (
          <article key={finding.findingId} className="finding compact">
            <p className="finding-id">
              {finding.findingId}
              <span className="sep"> · </span>
              {finding.controlId}
              {finding.amountUsd != null && (
                <>
                  <span className="sep"> · </span>
                  {money(finding.amountUsd)}
                </>
              )}
            </p>
            <h3>{finding.title}</h3>
          </article>
        ))}

        <p className="section-label">Human review</p>
        <ul className="review-line">
          {reviews.map((review) => (
            <li key={review.reviewId}>
              <strong>{review.decision}</strong>
              <span>
                {review.findingId} — {review.reviewer.name}
              </span>
            </li>
          ))}
        </ul>
        <p className="side-copy">{reviewSummary(reviews, findings)}</p>
      </aside>
    </article>
  );
}

function reviewSummary(reviews: readonly ReviewView[], findings: readonly FindingView[]): string {
  const accepted = reviews.filter((review) => review.decision === "accepted").length;
  const modified = reviews.filter((review) => review.decision === "modified").length;
  const rejected = reviews.filter((review) => review.decision === "rejected").length;
  const pending = findings.filter((finding) => finding.status === "open").length;
  const parts: string[] = [];
  if (accepted) parts.push(`${accepted} accepted`);
  if (modified) parts.push(`${modified} modified`);
  if (rejected) parts.push(`${rejected} rejected`);
  if (pending) parts.push(`${pending} still awaiting a person`);
  if (parts.length === 0) return "No human review was required for this result.";
  return `${parts.join(". ")}. The AI was not treated as automatically correct.`;
}

function PrimaryFinding({ finding }: { finding: FindingView }) {
  return (
    <article className="primary-finding">
      <p className="section-label">Material exception</p>
      {finding.amountUsd != null && (
        <p className="money">{money(finding.amountUsd)}</p>
      )}
      <h2>{finding.title}</h2>
      <p>{finding.description}</p>
      <p className="finding-id">
        {finding.findingId}
        <span className="sep"> · </span>
        {finding.controlId}
        <span className="sep"> · </span>
        {finding.severity}
      </p>
    </article>
  );
}
