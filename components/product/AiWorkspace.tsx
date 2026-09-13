"use client";

import Link from "next/link";
import { useState } from "react";
import { isWritableExecution } from "@/lib/product/localWorkspace";
import type { AiChatMessage, ProposedAction } from "@/lib/ai/types";
import { EvidenceUpload } from "./EvidenceUpload";
import { Term } from "./Term";
import { useWorkspace } from "./WorkspaceProvider";

const STARTERS = [
  { label: "Analyze evidence", prompt: "Analyze the uploaded evidence and summarize what it actually supports." },
  { label: "Find exceptions", prompt: "Which transactions or records appear to violate the policy?" },
  { label: "Summarize controls", prompt: "Which controls are present and which are missing evidence?" },
  { label: "Check compliance", prompt: "Check these records against the attached policy or required clauses." },
] as const;

export function AiWorkspace({ auditId }: { auditId: string }) {
  const workspace = useWorkspace();
  const executionId = workspace.selectedId(auditId);
  const execution = workspace.executions(auditId).find((item) => item.executionId === executionId) ?? null;
  const writable = isWritableExecution(execution);
  const evidence = executionId ? workspace.evidence(auditId, executionId) : [];
  const messages = executionId ? workspace.messages(auditId, executionId) : [];
  const actions = executionId ? workspace.actions(auditId, executionId) : [];
  const uploads = executionId
    ? workspace
        .activities(auditId, executionId)
        .filter((item) => item.type === "evidence.uploaded" || item.type === "evidence.added")
    : [];
  const auditTitle = workspace.localAudit(auditId)?.title ?? workspace.audits.find((item) => item.auditId === auditId)?.title;
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);

  async function ask(nextPrompt = prompt) {
    if (!execution || !writable) return;
    const question = nextPrompt.trim();
    if (!question) return;
    setBusy(true);
    setRunning("Retrieving evidence");
    setError(null);
    try {
      const prior: AiChatMessage[] = workspace
        .messages(auditId, execution.executionId)
        .map((item) => ({ role: item.role, content: item.content }));
      const response = await fetch("/api/product/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId,
          executionId: execution.executionId,
          auditTitle,
          prompt: question,
          prior,
          evidence: evidence.map((item) => ({
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
      workspace.applyAiTurn({
        auditId,
        executionId: execution.executionId,
        prompt: question,
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
      setPrompt("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "AI analysis is temporarily unavailable. Your audit workspace and existing records are safe.",
      );
    } finally {
      setBusy(false);
      setRunning(null);
    }
  }

  if (!execution) {
    return <p className="va-empty">Create an execution before asking VeriAudit.</p>;
  }

  return (
    <>
      <p className="va-lede">
        Chat is the working conversation. The <Term name="trace">trace</Term> is
        the record of work on {execution.executionId}.{" "}
        {writable ? "Unsealed." : execution.status === "closed" ? "Closed." : "Read-only."}
      </p>
      {!writable ? (
        <p className="va-empty">
          AI work belongs on an active execution. Closed and sealed records stay
          unchanged.
        </p>
      ) : (
        <EvidenceUpload auditId={auditId} executionId={execution.executionId} />
      )}
      <div className="va-ai-grid">
        <section className="va-section">
          <h2>Ask VeriAudit</h2>
          {messages.length === 0 ? (
            <p className="va-empty">
              {evidence.length === 0
                ? "Upload evidence or try sample audit data, then ask a question."
                : "Ask about the evidence attached to this execution. Chat explains the work. The trace records it."}
            </p>
          ) : (
            <ol className="va-chat">
              {messages.map((item) => (
                <li key={item.messageId}>
                  <strong>{item.role === "user" ? "You" : "VeriAudit"}</strong>
                  <p>{item.content}</p>
                  {item.role === "assistant" ? (
                    <>
                      <span className="meta">
                        {item.grounding === "insufficient" ? "Insufficient evidence" : item.grounding === "evidence-backed" ? "Evidence-backed" : item.mode === "mock" ? "Mock analysis" : "AI analysis"}
                        {" · Unsealed"}
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
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {writable ? (
            <div className="va-starters">
              {STARTERS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="va-chip"
                  disabled={busy}
                  onClick={() => {
                    setPrompt(item.prompt);
                    void ask(item.prompt);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="va-form">
            <label>
              Question
              <textarea
                value={prompt}
                rows={4}
                disabled={!writable || busy}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask what the evidence supports, and what still needs a human decision."
              />
            </label>
          </div>
          <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
            <button type="button" className="va-btn va-btn-primary" disabled={!writable || busy} onClick={() => void ask()}>
              {busy ? "Working…" : "Ask VeriAudit"}
            </button>
          </div>
          {error ? <p className="va-empty">{error}</p> : null}
        </section>
        <section className="va-section">
          <h2>Live trace</h2>
          <p className="va-empty">
            {execution.executionId}
            {writable
              ? ". Live actions on this execution are not sealed until the execution is closed and sealed."
              : execution.status === "sealed" || execution.status === "closed"
                ? ". This execution is closed. New AI work belongs on a later execution."
                : ". These actions are not cryptographically sealed."}
          </p>
          {running ? <p className="va-empty">● {running} · RUNNING</p> : null}
          {workspace
            .findings(auditId, execution.executionId)
            .some((item) => item.review === "pending") ? (
            <p className="va-empty">● Awaiting human review</p>
          ) : null}
          {uploads.length === 0 && actions.length === 0 && !running ? (
            <p className="va-empty">
              No structured actions yet. Retrieval, reads, analysis, and findings
              for this execution will appear here.
            </p>
          ) : (
            <ol className="va-spine">
              {uploads.map((item, index) => (
                <li key={item.activityId}>
                  <span className="va-spine-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="va-spine-dot" aria-hidden="true" />
                  <div className="va-spine-body">
                    <strong>✓ {item.title}</strong>
                    <span className="meta">COMPLETED · {item.detail} · Unsealed</span>
                  </div>
                </li>
              ))}
              {actions.map((item, index) => (
                <li key={item.actionId}>
                  <span className="va-spine-index">{String(uploads.length + index + 1).padStart(2, "0")}</span>
                  <span className="va-spine-dot" aria-hidden="true" />
                  <button
                    type="button"
                    className={`va-spine-body va-trace-item${openAction === item.actionId ? " is-open" : ""}`}
                    onClick={() => setOpenAction(openAction === item.actionId ? null : item.actionId)}
                  >
                    <strong>
                      {item.status === "started" ? "●" : item.status === "failed" ? "!" : "✓"} {item.title}
                    </strong>
                    <span className="meta">
                      {item.status.toUpperCase()}
                      {item.findingId ? ` · ${item.findingId}` : ""}
                      {" · Unsealed"}
                    </span>
                    {openAction === item.actionId ? (
                      <span className="meta">
                        {item.type}
                        {item.occurredAt ? ` · ${item.occurredAt.slice(11, 16)}` : ""}
                        {item.evidenceIds.length ? (
                          <>
                            {" · "}
                            {item.evidenceIds.map((id, i) => (
                              <Link key={id} href={`/product/audits/${auditId}/evidence/${id}`} onClick={(event) => event.stopPropagation()}>
                                {i ? `, ${id}` : id}
                              </Link>
                            ))}
                          </>
                        ) : null}
                        {item.findingId ? (
                          <>
                            {" · "}
                            <Link href={`/product/audits/${auditId}/findings/${item.findingId}`} onClick={(event) => event.stopPropagation()}>
                              Open finding
                            </Link>
                          </>
                        ) : null}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
