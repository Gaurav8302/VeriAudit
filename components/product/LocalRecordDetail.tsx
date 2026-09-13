"use client";

import Link from "next/link";
import { formatDay } from "@/lib/product/workspace";
import { findingReviewLabel } from "@/lib/product/localWorkspace";
import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";

export function LocalEvidenceDetail({
  auditId,
  artifactId,
}: {
  auditId: string;
  artifactId: string;
}) {
  const workspace = useWorkspace();
  const item = workspace.evidence(auditId).find((evidence) => evidence.artifactId === artifactId);
  const execution = workspace.executions(auditId).find((entry) => entry.executionId === item?.executionId);

  if (!workspace.ready) return <p className="va-empty">Loading evidence…</p>;
  if (!item) {
    return (
      <p className="va-empty">
        That evidence is not in this workspace.{" "}
        <Link href={`/product/audits/${auditId}/evidence`}>Return to evidence</Link>.
      </p>
    );
  }

  return (
    <>
      <p className="va-crumb">
        <Link href={`/product/audits/${auditId}/evidence`}>← Evidence</Link>
      </p>
      <p className="va-wip">
        {item.sample ? "Sample evidence · not an uploaded file" : "Uploaded evidence · unsealed"}
      </p>
      <p className="va-lede">
        {item.sample
          ? `${item.title} was added to this audit as metadata only.`
          : `${item.title} is attached to this execution.`}
      </p>
      <dl className="va-detail">
        <div>
          <dt>Evidence</dt>
          <dd>{item.artifactId}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{item.kind}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{item.source || "—"}</dd>
        </div>
        <div>
          <dt>Filename</dt>
          <dd>{item.filename ?? "—"}</dd>
        </div>
        <div>
          <dt>Fingerprint</dt>
          <dd>{item.fingerprint ? `${item.fingerprint.slice(0, 16)}…` : "—"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{item.processingStatus === "failed" ? "Failed" : item.processingStatus === "processing" ? "Processing" : "Ready"}</dd>
        </div>
        <div>
          <dt>Extraction</dt>
          <dd>
            {item.extraction === "text"
              ? "Text extracted"
              : item.extraction === "unavailable"
                ? "Fingerprint only — text was not extracted"
                : "Metadata only"}
          </dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>
            <Link href={`/product/audits/${auditId}/executions/${item.executionId}`}>
              {execution?.label ?? item.executionId}
            </Link>
          </dd>
        </div>
      </dl>
      <section className="va-section">
        <h2>Description</h2>
        <p className="va-empty">{item.description || "No description yet."}</p>
      </section>
      {item.chunks.length > 0 ? (
        <section className="va-section">
          <h2>Addressable chunks</h2>
          <ul className="va-list">
            {item.chunks.map((chunk) => (
              <li key={chunk.chunkId} id={chunk.chunkId}>
                <strong>{chunk.chunkId}</strong>
                <span>{chunk.locator}</span>
                <p className="va-empty">{chunk.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : item.textExcerpt ? (
        <section className="va-section">
          <h2>Extracted text</h2>
          <p className="va-empty">{item.textExcerpt}</p>
        </section>
      ) : null}
      <p className="va-empty">
        Added {formatDay(item.createdAt)}
        {item.byteSize ? ` · ${item.byteSize.toLocaleString()} bytes` : ""}. This
        file is attached to the execution AI is working against.
      </p>
    </>
  );
}

export function LocalFindingDetail({
  auditId,
  findingId,
}: {
  auditId: string;
  findingId: string;
}) {
  const workspace = useWorkspace();
  const finding = workspace.findings(auditId).find((item) => item.findingId === findingId);
  const execution = workspace.executions(auditId).find((entry) => entry.executionId === finding?.executionId);
  const related = workspace.evidence(auditId).filter((item) => finding?.evidenceIds.includes(item.artifactId));
  const originAction = finding
    ? workspace.actions(auditId, finding.executionId).find((item) => item.actionId === finding.originatingActionId)
    : null;
  const [note, setNote] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (!workspace.ready) return <p className="va-empty">Loading finding…</p>;
  if (!finding) {
    return (
      <p className="va-empty">
        That finding is not in this workspace.{" "}
        <Link href={`/product/audits/${auditId}/findings`}>Return to findings</Link>.
      </p>
    );
  }

  return (
    <>
      <p className="va-crumb">
        <Link href={`/product/audits/${auditId}/findings`}>← Findings</Link>
      </p>
      <p className="va-wip">
        {finding.origin === "ai" ? `AI proposal · ${findingReviewLabel(finding.review)} · unsealed` : "User finding · unsealed"}
      </p>
      <p className="va-lede">
        {finding.findingId} — {finding.title}
      </p>
      <dl className="va-detail">
        <div>
          <dt>Finding ID</dt>
          <dd>{finding.findingId}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>{finding.severity}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{findingReviewLabel(finding.review)}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>
            <Link href={`/product/audits/${auditId}/executions/${finding.executionId}`}>
              {execution?.label ?? finding.executionId}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Origin</dt>
          <dd>{finding.origin === "ai" ? "AI analysis" : "User"}</dd>
        </div>
        <div>
          <dt>Originating action</dt>
          <dd>
            {originAction ? (
              <>
                {originAction.type}
                {" · "}
                {originAction.title}
              </>
            ) : (
              finding.originatingActionId ?? "—"
            )}
          </dd>
        </div>
      </dl>
      <section className="va-section">
        <h2>Description</h2>
        <p className="va-empty">{finding.description || "No description yet."}</p>
      </section>
      <section className="va-section">
        <h2>Related evidence</h2>
        {related.length === 0 ? (
          <p className="va-empty">No related evidence attached.</p>
        ) : (
          <ul className="va-list">
            {related.map((item) => {
              const chunks = item.chunks.filter((chunk) => finding.chunkIds.includes(chunk.chunkId));
              return (
                <li key={item.artifactId}>
                  <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                    <strong>{item.title}</strong>
                  </Link>
                  <span>{item.filename ?? item.artifactId}</span>
                  {chunks.map((chunk) => (
                    <p key={chunk.chunkId} className="va-empty">
                      <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}#${chunk.chunkId}`}>
                        {chunk.locator}
                      </Link>
                      {" — "}
                      {chunk.text.slice(0, 180)}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {finding.reviewNote ? (
        <section className="va-section">
          <h2>Human note</h2>
          <p className="va-empty">{finding.reviewNote}</p>
        </section>
      ) : null}
      <section className="va-section">
        <h2>Review finding</h2>
        <div className="va-form">
          <label>
            Modification note
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Required when you modify the AI proposal."
            />
          </label>
        </div>
        <div className="va-actions">
          {(["accepted", "modified", "rejected"] as const).map((review) => (
            <button
              key={review}
              type="button"
              className="va-btn"
              onClick={() => {
                try {
                  workspace.reviewFinding(finding.findingId, review, note);
                  setReviewError(null);
                } catch (cause) {
                  setReviewError(cause instanceof Error ? cause.message : "Review could not be recorded.");
                }
              }}
            >
              {review === "accepted" ? "Accept" : review === "modified" ? "Modify" : "Reject"}
            </button>
          ))}
        </div>
        {reviewError ? <p className="va-empty">{reviewError}</p> : null}
      </section>
      <p className="va-empty">Human review is separate from the AI proposal. This finding is unsealed.</p>
    </>
  );
}
