"use client";

import Link from "next/link";
import { useState } from "react";
import { isWritableExecution } from "@/lib/product/localWorkspace";
import type { AiChatMessage, ProposedAction } from "@/lib/ai/types";
import { EvidenceUpload } from "./EvidenceUpload";
import { Term } from "./Term";
import { useWorkspace } from "./WorkspaceProvider";

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
  const [prompt, setPrompt] = useState(
    "Check the revenue transactions against the policy and identify anything that needs human review.",
  );
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);

  async function ask() {
    if (!execution || !writable) return;
    const question = prompt.trim();
    if (!question) return;
    setBusy(true);
    setRunning("Asking VeriAudit");
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
          prompt: question,
          prior,
          evidence: evidence.map((item) => ({
            evidenceId: item.artifactId,
            title: item.title,
            kind: item.kind,
            filename: item.filename,
            extraction: item.extraction,
            textExcerpt: item.textExcerpt,
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
              Ask about the evidence attached to this execution. Chat explains
              the work. The trace records it.
            </p>
          ) : (
            <ol className="va-chat">
              {messages.map((item) => (
                <li key={item.messageId}>
                  <strong>{item.role === "user" ? "You" : "VeriAudit"}</strong>
                  <p>{item.content}</p>
                  {item.role === "assistant" ? (
                    <span className="meta">
                      {item.mode === "mock" ? "Mock analysis" : "AI analysis"}
                      {" · Unsealed"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          <div className="va-form">
            <label>
              Question
              <textarea
                value={prompt}
                rows={4}
                disabled={!writable || busy}
                onChange={(event) => setPrompt(event.target.value)}
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
            {execution.executionId}. These actions are not cryptographically
            sealed.
          </p>
          {running ? <p className="va-empty">● {running} · RUNNING</p> : null}
          {workspace
            .findings(auditId, execution.executionId)
            .some((item) => item.review === "pending") ? (
            <p className="va-empty">● Awaiting human review</p>
          ) : null}
          {uploads.length === 0 && actions.length === 0 && !running ? (
            <p className="va-empty">
              No structured actions yet. Uploads, reads, analysis, and findings
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
                        {item.evidenceIds.length ? ` · Evidence ${item.evidenceIds.join(", ")}` : ""}
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
