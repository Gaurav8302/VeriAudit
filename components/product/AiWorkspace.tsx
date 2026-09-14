"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  findingReviewLabel,
  isSampleAudit,
  isWritableExecution,
  type LocalEvidence,
  type LocalFinding,
} from "@/lib/product/localWorkspace";
import type { AiChatMessage, ProposedAction } from "@/lib/ai/types";
import type { AiWorkspaceContext } from "@/lib/ai/context";
import { domainLabel } from "@/lib/product/workspace";
import { SAMPLE_AUDIT_SCOPE, SAMPLE_CONTROLS, SAMPLE_QUESTIONS } from "@/lib/product/sampleAudit";
import { EvidenceUpload } from "./EvidenceUpload";
import { useWorkspace } from "./WorkspaceProvider";

const GENERAL_STARTERS: readonly string[] = [
  "Review the uploaded evidence.",
  "Find exceptions.",
  "Check controls.",
  "Explain this finding.",
  "Trace why this transaction was flagged.",
];

/** Only stages the client actually performs are shown. */
type Stage = "preparing" | "investigating" | "recording";

function providerLabel(provider: string | null): string | null {
  if (!provider || provider === "mock") return null;
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "groq") return "Groq";
  if (provider === "nvidia") return "NVIDIA";
  return provider;
}

function evidenceStateLabel(item: LocalEvidence): { mark: string; text: string; className: string } {
  if (item.processingStatus === "uploading") {
    return { mark: "●", text: "Uploading", className: "is-uploading" };
  }
  if (item.processingStatus === "processing") {
    return { mark: "●", text: "Processing", className: "is-uploading" };
  }
  if (item.processingStatus === "failed") {
    return { mark: "✕", text: item.processingError ?? "Upload failed", className: "is-failed" };
  }
  return { mark: "✓", text: "Ready", className: "is-ready" };
}

function FindingCard({
  auditId,
  executionLabel,
  finding,
  evidenceItems,
  recorded,
  reviewRecorded,
  writable,
  onReview,
  reviewError,
  reviewBusy,
}: {
  auditId: string;
  executionLabel: string;
  finding: LocalFinding;
  evidenceItems: readonly { id: string; title: string }[];
  recorded: boolean;
  reviewRecorded: boolean;
  writable: boolean;
  onReview: (findingId: string, review: "accepted" | "rejected") => void;
  reviewError: string | null;
  reviewBusy: boolean;
}) {
  const complete = finding.review !== "pending";
  const accepted = finding.review === "accepted";

  return (
    <article
      id={`finding-${finding.findingId}`}
      className={`va-finding-card${complete ? " is-complete" : ""}`}
      data-testid="finding-card"
    >
      <p className="va-kicker">{complete ? "Human review complete" : "Proposed finding"}</p>
      <h3>
        {finding.findingId}
        <span>{finding.title}</span>
      </h3>
      <p className="va-finding-severity">{finding.severity.toUpperCase()}</p>
      {finding.description ? <p>{finding.description}</p> : null}
      {evidenceItems.length > 0 ? (
        <ul className="va-finding-evidence">
          {evidenceItems.map((item) => (
            <li key={item.id}>✓ {item.title}</li>
          ))}
        </ul>
      ) : null}
      {complete ? (
        <div className="va-review-state is-done">
          <strong data-testid="review-state">
            {accepted ? "✓ ACCEPTED BY HUMAN REVIEW" : `✓ ${findingReviewLabel(finding.review).toUpperCase()} BY HUMAN REVIEW`}
          </strong>
          {reviewRecorded ? <p className="meta">Recorded to {executionLabel}</p> : null}
          <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>View event</Link>
        </div>
      ) : (
        <div className="va-review-state">
          <strong>HUMAN REVIEW REQUIRED</strong>
          <p>
            The AI proposed this finding. A human must decide before the execution can be sealed.
          </p>
          {writable ? (
            <div className="va-actions">
              <button
                type="button"
                className="va-btn va-btn-primary"
                data-testid="accept-finding"
                disabled={reviewBusy}
                onClick={() => onReview(finding.findingId, "accepted")}
              >
                Accept finding
              </button>
              <button
                type="button"
                className="va-btn"
                data-testid="dismiss-finding"
                disabled={reviewBusy}
                onClick={() => onReview(finding.findingId, "rejected")}
              >
                Dismiss
              </button>
              <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>Review details</Link>
            </div>
          ) : (
            <p className="va-empty">This execution is closed. Human review belongs on an active run.</p>
          )}
          {reviewError ? <p className="va-review-error">{reviewError}</p> : null}
        </div>
      )}
      {recorded ? <p className="meta">● Recorded to {executionLabel}</p> : null}
    </article>
  );
}

export function AiWorkspace({
  auditId,
  compact = false,
  studio = false,
}: {
  auditId: string;
  compact?: boolean;
  studio?: boolean;
}) {
  const workspace = useWorkspace();
  const executionId = workspace.selectedId(auditId);
  const execution = workspace.executions(auditId).find((item) => item.executionId === executionId) ?? null;
  const writable = isWritableExecution(execution);
  const evidence = executionId ? workspace.evidence(auditId, executionId) : [];
  const ready = evidence.filter((item) => item.processingStatus === "ready" && item.recorded);
  const pendingEvidence = evidence.filter(
    (item) => item.processingStatus === "uploading" || item.processingStatus === "processing",
  );
  const messages = executionId ? workspace.messages(auditId, executionId) : [];
  const findings = executionId ? workspace.findings(auditId, executionId) : [];
  const activities = executionId ? workspace.activities(auditId, executionId) : [];
  const local = workspace.localAudit(auditId);
  const audit = workspace.audits.find((item) => item.auditId === auditId);
  const auditTitle = local?.title ?? audit?.title;
  const domain = local?.domain ?? audit?.domain;

  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const busy = stage !== null;
  const sample = isSampleAudit(auditId);
  const starters = sample ? SAMPLE_QUESTIONS : GENERAL_STARTERS;
  const evidenceTitles = useMemo(
    () => Object.fromEntries(evidence.map((item) => [item.artifactId, item.title])),
    [evidence],
  );

  // Keep the newest turn in view without moving the composer.
  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, stage]);

  useEffect(() => {
    const pending = findings.find((item) => item.review === "pending");
    if (!pending) return;
    const card = document.getElementById(`finding-${pending.findingId}`);
    card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [findings]);

  function buildContext(): AiWorkspaceContext {
    return {
      auditId,
      auditTitle,
      domain: domain ? domainLabel(domain) : undefined,
      period: local?.period ?? audit?.period ?? null,
      objective: sample ? SAMPLE_AUDIT_SCOPE.objective : local?.description ?? null,
      executionId: execution?.executionId,
      executionLabel: execution?.label,
      executionStatus: execution?.status,
      controls: sample
        ? SAMPLE_CONTROLS.map((item) => ({
            controlId: item.controlId,
            title: item.title,
            requirement: item.requirement,
          }))
        : [],
      findings: findings.map((item) => ({
        findingId: item.findingId,
        title: item.title,
        severity: item.severity,
        review: item.review,
      })),
      recentEvents: activities.slice(-10).map((item) => `${item.occurredAt.slice(11, 16)} ${item.title}: ${item.detail}`),
    };
  }

  async function ask(nextPrompt = prompt) {
    if (!execution || !writable || busy) return;
    const question = nextPrompt.trim();
    if (!question) return;

    setError(null);
    setPrompt("");
    // Record the question first so the conversation shows it immediately.
    workspace.beginAiTurn({ auditId, executionId: execution.executionId, prompt: question });
    setStage("preparing");

    const prior: AiChatMessage[] = workspace
      .messages(auditId, execution.executionId)
      .filter((item) => item.content !== question || item.role !== "user")
      .map((item) => ({ role: item.role, content: item.content }));

    try {
      setStage("investigating");
      const response = await fetch("/api/product/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId,
          executionId: execution.executionId,
          auditTitle,
          prompt: question,
          prior,
          context: buildContext(),
          // Only server-confirmed, readable evidence is sent as context.
          evidence: ready.map((item) => ({
            evidenceId: item.artifactId,
            title: item.title,
            kind: item.kind,
            filename: item.filename,
            extraction: item.extraction,
            textExcerpt: item.chunks.length ? null : item.textExcerpt,
            chunks: item.chunks,
          })),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        reply?: string;
        actions?: ProposedAction[];
        provider?: "openrouter" | "groq" | "nvidia" | "mock";
        model?: string;
        requestId?: string | null;
        status?: "ok" | "unavailable";
        mode?: "live" | "mock";
        grounding?: "evidence-backed" | "insufficient" | null;
        confidence?: "high" | "medium" | "low" | "none" | null;
        evidenceReferences?: {
          evidenceId: string;
          chunkId: string;
          label: string;
          excerpt: string;
        }[];
      };
      if (!response.ok) throw new Error(payload.error ?? "AI analysis is temporarily unavailable.");
      setStage("recording");
      workspace.completeAiTurn({
        auditId,
        executionId: execution.executionId,
        reply: payload.reply ?? "",
        actions: payload.actions ?? [],
        provider: payload.provider ?? "mock",
        model: payload.model ?? "unknown",
        requestId: payload.requestId ?? null,
        mode: payload.mode ?? "mock",
        status: payload.status ?? "unavailable",
        grounding: payload.grounding ?? null,
        confidence: payload.confidence ?? null,
        references: payload.evidenceReferences ?? [],
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "AI analysis is temporarily unavailable. Your audit workspace and existing records are safe.";
      setError(message);
      // The failure is part of the conversation, not a silent dead end.
      workspace.failAiTurn({ auditId, executionId: execution.executionId, message });
    } finally {
      setStage(null);
    }
  }

  function reviewFinding(findingId: string, review: "accepted" | "rejected") {
    if (reviewBusy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      workspace.reviewFinding(findingId, review);
    } catch (cause) {
      setReviewError(
        cause instanceof Error
          ? `Human review could not be saved. ${cause.message} Try again.`
          : "Human review could not be saved. Try again.",
      );
    } finally {
      setReviewBusy(false);
    }
  }

  if (!execution) {
    return <p className="va-empty">Create an execution before asking the assistant.</p>;
  }

  const evidenceStrip =
    evidence.length === 0 ? null : (
      <div className="va-evidence-strip" data-testid="evidence-strip">
        <ul>
          {evidence.map((item) => {
            const state = evidenceStateLabel(item);
            return (
              <li key={item.artifactId} className={state.className}>
                <span aria-hidden="true">{state.mark}</span>
                <strong>{item.filename ?? item.title}</strong>
                <span className="meta">{state.text}</span>
              </li>
            );
          })}
        </ul>
        <p className="va-evidence-summary">
          {ready.length > 0 ? (
            <strong data-testid="evidence-ready-count">
              ✓ {ready.length} evidence artifact{ready.length === 1 ? "" : "s"} ready
            </strong>
          ) : pendingEvidence.length > 0 ? (
            <strong>● Preparing {pendingEvidence.length} artifact{pendingEvidence.length === 1 ? "" : "s"}</strong>
          ) : (
            <strong>No evidence ready</strong>
          )}
          <Link href={`/product/audits/${auditId}/evidence`}>View evidence</Link>
          {ready.length > 0 && writable ? (
            <button
              type="button"
              className="va-btn va-btn-quiet"
              disabled={busy}
              onClick={() => void ask("Review the uploaded revenue evidence.")}
            >
              Ask AI to review
            </button>
          ) : null}
        </p>
      </div>
    );

  const emptyState = (
    <div className="va-assistant-empty">
      <p className="va-kicker">AI audit assistant</p>
      <h2>Review evidence, investigate controls, and explain findings.</h2>
      {ready.length === 0 ? (
        <>
          <p>Give the assistant evidence, then ask it to begin.</p>
          {writable ? (
            <EvidenceUpload auditId={auditId} executionId={execution.executionId} compact autoSample={sample} />
          ) : (
            <p className="va-empty">This execution is closed. New AI work belongs on a later run.</p>
          )}
        </>
      ) : (
        <p>
          {ready.length} evidence artifact{ready.length === 1 ? "" : "s"} ready. Ask a question below.
        </p>
      )}
      {writable ? (
        <div className="va-starters">
          {starters.map((item) => (
            <button
              key={item}
              type="button"
              className="va-chip"
              disabled={busy}
              onClick={() => void ask(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const conversation = (
    <>
      {messages.length === 0 ? (
        emptyState
      ) : (
        <ol className="va-chat">
          {messages.map((item) => {
            const provider = providerLabel(item.provider);
            // Findings created during this turn share its timestamp.
            const lastAssistant = messages.filter((row) => row.role === "assistant").at(-1);
            const exact = findings.filter((finding) => finding.createdAt === item.occurredAt);
            const unmatched =
              item.messageId === lastAssistant?.messageId
                ? findings.filter(
                    (finding) =>
                      finding.origin === "ai" &&
                      !messages.some((row) => row.role === "assistant" && row.occurredAt === finding.createdAt),
                  )
                : [];
            const turnFindings =
              item.role === "assistant"
                ? [...new Map([...exact, ...unmatched].map((finding) => [finding.findingId, finding])).values()]
                : [];
            return (
              <li key={item.messageId} className={item.role === "user" ? "is-user" : "is-assistant"}>
                <strong>{item.role === "user" ? "You" : "VeriAudit"}</strong>
                <p>{item.content}</p>
                {item.role === "assistant" ? (
                  <>
                    <span className="meta">
                      {item.grounding === "insufficient"
                        ? "Evidence incomplete"
                        : item.grounding === "evidence-backed"
                          ? "Evidence-backed"
                          : item.mode === "mock"
                            ? "Mock analysis"
                            : "AI analysis"}
                      {provider ? ` · ${provider}` : ""}
                      {item.model && item.model !== "unknown" && item.provider && item.provider !== "mock"
                        ? ` · ${item.model}`
                        : ""}
                    </span>
                    {item.references.length > 0 ? (
                      <ul className="va-ref-list">
                        {item.references.map((ref) => (
                          <li key={`${item.messageId}-${ref.chunkId}`}>
                            <Link href={`/product/audits/${auditId}/evidence/${ref.evidenceId}#${ref.chunkId}`}>
                              {ref.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {turnFindings.map((finding) => (
                      <FindingCard
                        key={finding.findingId}
                        auditId={auditId}
                        executionLabel={execution.label}
                        finding={finding}
                        evidenceItems={finding.evidenceIds.map((id) => ({
                          id,
                          title: evidenceTitles[id] ?? id,
                        }))}
                        recorded={activities.some(
                          (activity) =>
                            activity.type === "finding.created" && activity.subjectId === finding.findingId,
                        )}
                        reviewRecorded={activities.some(
                          (activity) =>
                            activity.type === "finding.reviewed" && activity.subjectId === finding.findingId,
                        )}
                        writable={writable}
                        onReview={reviewFinding}
                        reviewError={reviewError}
                        reviewBusy={reviewBusy}
                      />
                    ))}
                  </>
                ) : null}
              </li>
            );
          })}
          {stage ? (
            <li className="is-assistant is-pending" data-testid="ai-pending">
              <strong>VeriAudit</strong>
              <p className="va-ai-thinking">● Investigating…</p>
              <ul className="va-ai-stages">
                <li className={stage === "preparing" ? "is-active" : "is-done"}>
                  {stage === "preparing" ? "●" : "✓"} Preparing {ready.length} evidence artifact
                  {ready.length === 1 ? "" : "s"}
                </li>
                <li
                  className={
                    stage === "investigating" ? "is-active" : stage === "recording" ? "is-done" : "is-idle"
                  }
                >
                  {stage === "investigating" ? "●" : stage === "recording" ? "✓" : "○"} Investigating with the
                  audit model
                </li>
                <li className={stage === "recording" ? "is-active" : "is-idle"}>
                  {stage === "recording" ? "●" : "○"} Recording actions to {execution.label}
                </li>
              </ul>
            </li>
          ) : null}
        </ol>
      )}
      {error ? <p className="va-review-error">{error}</p> : null}
    </>
  );

  const composer = (
    <div className="va-composer">
      {evidenceStrip}
      {evidenceOpen && writable ? (
        <EvidenceUpload
          auditId={auditId}
          executionId={execution.executionId}
          compact
          onDone={() => setEvidenceOpen(false)}
        />
      ) : null}
      <div className="va-composer-row">
        {writable ? (
          <button
            type="button"
            className="va-btn"
            data-testid="toggle-evidence"
            onClick={() => setEvidenceOpen((value) => !value)}
          >
            {evidenceOpen ? "Close" : "+ Add evidence"}
          </button>
        ) : null}
        <label className="va-composer-field">
          <span className="va-sr-only">Ask VeriAudit</span>
          <textarea
            value={prompt}
            rows={2}
            data-testid="ask-veriaudit"
            disabled={!writable || busy}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask VeriAudit..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="va-btn va-btn-primary"
          data-testid="send-prompt"
          disabled={!writable || busy}
          onClick={() => void ask()}
        >
          {busy ? "Working" : "Send"}
        </button>
      </div>
      {!writable ? (
        <p className="va-empty">
          This execution is closed. New AI work belongs on a later execution.
        </p>
      ) : null}
    </div>
  );

  return (
    <section className="va-assistant" id="ai-assistant">
      <header className="va-assistant-head">
        <div>
          <p className="va-kicker">AI audit assistant</p>
          <h1>{auditTitle ?? "Audit workspace"}</h1>
          <p>
            {domain ? domainLabel(domain) : ""}
            {execution ? ` · ${execution.label}` : ""}
            {ready.length ? ` · ${ready.length} evidence ready` : " · no evidence yet"}
          </p>
        </div>
      </header>
      <div className="va-assistant-thread" ref={threadRef}>
        {conversation}
      </div>
      {composer}
    </section>
  );
}
