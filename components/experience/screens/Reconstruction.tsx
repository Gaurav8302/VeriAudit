"use client";

import { useState } from "react";
import { formatDay, money } from "@/lib/demo/format";
import type { ReconstructionPayload } from "@/lib/demo/payloads";

export function Reconstruction({
  reconstruction,
  loading,
  error,
  onRetry,
  onOpenTrail,
}: {
  reconstruction: ReconstructionPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenTrail: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (error) {
    return (
      <article className="frame">
        <p className="kicker">Record</p>
        <h1 className="display">The execution could not be opened.</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="primary" onClick={onRetry}>
          Try again
        </button>
      </article>
    );
  }

  if (loading || !reconstruction) {
    return (
      <article className="frame">
        <p className="kicker">Record</p>
        <h1 className="display">Opening the original execution.</h1>
        <p className="note">Reconstructing from the recorded trail. Not asking the model again.</p>
      </article>
    );
  }

  if (reconstruction.kind === "catalog" || !reconstruction.hasEngineTrail) {
    return (
      <article className="frame">
        <p className="kicker">Historical feed</p>
        <h1 className="display">{reconstruction.auditId}</h1>
        <p className="lede">
          {reconstruction.why?.note ??
            "This audit is historical feed data. It has no engine trail and no cryptographic evidence."}
        </p>
        <p className="note">Integrity: {reconstruction.integrity.status.replace(/-/g, " ")}</p>
      </article>
    );
  }

  const findings = reconstruction.findings ?? [];
  const reviews = reconstruction.reviews ?? [];
  const evidence = listedEvidence(reconstruction);
  const conclusion = reconstruction.conclusion ?? reconstruction.why?.conclusion;
  const audit = reconstruction.audit as { title?: string; period?: string; openedAt?: string } | undefined;
  const primary = findings[0];

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Original execution found</p>
        <h1 className="display">{audit?.title ?? reconstruction.auditId}</h1>
        <p className="lede">
          {audit?.openedAt ? formatDay(audit.openedAt) : null}
        </p>
        <p className="found-id">{reconstruction.auditId}</p>
        <p className="found-id">{reconstruction.executionId}</p>
        <p className="lede lede-follow">
          This is the recorded execution. It has not been rerun. No new explanation
          has been generated.
        </p>

        {primary && (
          <article className="primary-finding">
            <p className="section-label">Primary finding</p>
            {primary.amountUsd != null && <p className="money">{money(primary.amountUsd)}</p>}
            <h2>{primary.title}</h2>
            <p>
              {primary.findingId}
              <span className="sep"> · </span>
              {primary.controlId}
              <span className="sep"> · </span>
              evidence → control → finding → review
            </p>
          </article>
        )}

        {conclusion && <p className="conclusion">{conclusion.statement}</p>}

        <button type="button" className="primary" onClick={onOpenTrail}>
          View the execution trail
        </button>
      </div>

      <aside className="side-panel">
        <p className="section-label">Evidence in scope</p>
        <ul className="plain evidence-list">
          {evidence.map((item) => (
            <li key={item.artifactId}>
              <button
                type="button"
                className="text-btn block"
                onClick={() => setOpenId(openId === item.artifactId ? null : item.artifactId)}
              >
                <span className="mono faint">{item.artifactId}</span>
                <span>{item.title}</span>
              </button>
              {openId === item.artifactId && item.content && (
                <pre className="excerpt">{excerpt(item.content)}</pre>
              )}
            </li>
          ))}
        </ul>

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
      </aside>
    </article>
  );
}

function listedEvidence(reconstruction: ReconstructionPayload) {
  if (reconstruction.evidence?.length) {
    return reconstruction.evidence.map((item) => ({
      artifactId: item.artifactId,
      title: item.title,
      content: item.content,
    }));
  }
  return (reconstruction.why?.evidence ?? []).map((item) => ({
    artifactId: item.artifactId,
    title: item.title,
    content: undefined as string | undefined,
  }));
}

function excerpt(content: string): string {
  return content.split("\n").slice(0, 8).join("\n");
}
