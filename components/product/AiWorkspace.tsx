"use client";

import Link from "next/link";
import { useState } from "react";
import { findingReviewLabel, isWritableExecution } from "@/lib/product/localWorkspace";
import type { AiChatMessage, ProposedAction } from "@/lib/ai/types";
import { EvidenceUpload } from "./EvidenceUpload";
import { ProductExplainer } from "./ProductExplainer";
import { Term } from "./Term";
import { useWorkspace } from "./WorkspaceProvider";

const STARTERS = [
  { label: "Review the uploaded evidence", prompt: "Review the uploaded evidence and summarize what it actually supports." },
  { label: "Check this control", prompt: "Which controls are present and which are missing evidence?" },
  { label: "Find exceptions", prompt: "Which transactions or records appear to violate the attached policy?" },
  { label: "Compare these documents", prompt: "Compare these documents and note material mismatches that need human review." },
  { label: "Explain this finding", prompt: "Explain the most important exception in this evidence and what still needs a human decision." },
  { label: "Trace why this was flagged", prompt: "Trace why a transaction or record in this evidence would be flagged, using only the attached material." },
] as const;

function providerLabel(provider: string | null): string | null {
  if (!provider || provider === "mock") return null;
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "groq") return "Groq";
  if (provider === "nvidia") return "NVIDIA";
  return provider;
}

function actionKind(type: string): string {
  if (type === "SEARCH_EVIDENCE") return "Evidence retrieved";
  if (type === "READ_EVIDENCE") return "Evidence read";
  if (type === "ANALYZE_EVIDENCE") return "Evidence analyzed";
  if (type === "COMPARE_EVIDENCE") return "Documents compared";
  if (type === "CREATE_FINDING") return "Finding created";
  if (type === "UPDATE_FINDING") return "Finding update recorded";
  if (type === "SUMMARIZE") return "Summary";
  if (type === "REQUEST_HUMAN_REVIEW") return "Human review requested";
  return type.replace(/_/g, " ");
}

export function AiWorkspace({ auditId }: { auditId: string }) {
  const workspace = useWorkspace();
  const executionId = workspace.selectedId(auditId);
  const execution = workspace.executions(auditId).find((item) => item.executionId === executionId) ?? null;
  const writable = isWritableExecution(execution);
  const evidence = executionId ? workspace.evidence(auditId, executionId) : [];
  const messages = executionId ? workspace.messages(auditId, executionId) : [];
  const actions = executionId ? workspace.actions(auditId, executionId) : [];
  const findings = executionId ? workspace.findings(auditId, executionId) : [];
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
  const pendingFindings = findings.filter((item) => item.origin === "ai" && item.review === "pending");
  const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant") ?? null;

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
    return <p className="va-empty">Create an execution before asking the assistant.</p>;
  }

  return (
    <>
      <p className="va-lede">
        The <Term name="assistant">AI audit assistant</Term> performs assigned
        work. The live <Term name="trace">trace</Term> is the same execution:{" "}
        {execution.executionId}.{" "}
        {writable ? "Actions are recorded and unsealed." : execution.status === "closed" ? "Closed." : "Read-only."}
      </p>
      <ProductExplainer
        title="What is the AI doing?"
        body="The assistant analyzes the evidence you provide, performs audit tasks, and records the important actions it takes so the work can be reviewed later."
      />
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
          <h2>AI audit assistant</h2>
          <p className="va-empty">
            AI assists. Humans review. VeriAudit records the execution.
          </p>
          {messages.length === 0 ? (
            <p className="va-empty">
              {evidence.length === 0
                ? "Upload evidence or try sample audit data, then assign a task."
                : "What would you like me to check in the evidence attached to this execution?"}
            </p>
          ) : (
            <ol className="va-chat">
              {messages.map((item) => {
                const provider = providerLabel(item.provider);
                return (
                  <li key={item.messageId}>
                    <strong>{item.role === "user" ? "You" : "Assistant"}</strong>
                    <p>{item.content}</p>
                    {item.role === "assistant" ? (
                      <>
                        <span className="meta">
                          {item.grounding === "insufficient"
                            ? "Insufficient evidence"
                            : item.grounding === "evidence-backed"
                              ? "Evidence-backed"
                              : item.mode === "mock"
                                ? "Mock analysis"
                                : "AI analysis"}
                          {provider ? ` · ${provider}` : ""}
                          {item.model && item.model !== "unknown" && item.provider && item.provider !== "mock"
                            ? ` · ${item.model}`
                            : ""}
                          {" · Recorded to execution · Unsealed"}
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
                );
              })}
            </ol>
          )}
          {pendingFindings.length > 0 ? (
            <div className="va-ai-findings">
              {pendingFindings.map((finding) => (
                <p key={finding.findingId} className="va-ai-finding">
                  <strong>Potential exception</strong>
                  <span>
                    AI identified {finding.findingId}. {findingReviewLabel(finding.review)} — AI is not the
                    final authority.
                  </span>
                  <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>Review finding</Link>
                </p>
              ))}
            </div>
          ) : null}
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
              What would you like me to check?
              <textarea
                value={prompt}
                rows={4}
                disabled={!writable || busy}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask the assistant to review evidence, check a control, or find exceptions."
              />
            </label>
          </div>
          <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
            <button type="button" className="va-btn va-btn-primary" disabled={!writable || busy} onClick={() => void ask()}>
              {busy ? "AI working" : "Ask AI"}
            </button>
          </div>
          {error ? <p className="va-empty">{error}</p> : null}
        </section>
        <section className="va-section">
          <h2>Live execution trace</h2>
          <p className="va-empty">
            {execution.executionId}. What the assistant just did is recorded here.
            {writable
              ? " Recorded is not the same as cryptographically verified."
              : execution.status === "sealed" || execution.status === "closed"
                ? " This execution is closed. New AI work belongs on a later execution."
                : " These actions are not cryptographically sealed."}
          </p>
          {running ? (
            <p className="va-ai-progress">
              <strong>Analyzing evidence</strong>
              <span>→ {running}</span>
            </p>
          ) : null}
          {latestAssistant?.mode === "live" && latestAssistant.provider && latestAssistant.provider !== "mock" ? (
            <p className="va-empty">
              Request completed
              {providerLabel(latestAssistant.provider)
                ? ` · ${providerLabel(latestAssistant.provider)}`
                : ""}
              .
            </p>
          ) : null}
          {pendingFindings.length > 0 ? (
            <p className="va-empty">● Awaiting human review</p>
          ) : null}
          {uploads.length === 0 && actions.length === 0 && !running ? (
            <p className="va-empty">
              No structured actions yet. Retrieval, reads, analysis, and findings
              for this execution will appear here as the assistant works.
            </p>
          ) : (
            <ol className="va-spine">
              {uploads.map((item, index) => (
                <li key={item.activityId}>
                  <span className="va-spine-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="va-spine-dot" aria-hidden="true" />
                  <div className="va-spine-body">
                    <strong>✓ {item.title}</strong>
                    <span className="meta">
                      {item.occurredAt.slice(11, 16)} · COMPLETED · Recorded to execution · Unsealed
                    </span>
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
                      {item.status === "started" ? "→" : item.status === "failed" ? "!" : "✓"} {item.title}
                    </strong>
                    <span className="meta">
                      {item.occurredAt.slice(11, 16)} · {actionKind(item.type)} · {item.status.toUpperCase()}
                      {item.findingId ? ` · ${item.findingId}` : ""}
                      {item.status === "completed" ? " · Recorded to execution" : ""}
                      {" · Unsealed"}
                    </span>
                    {openAction === item.actionId ? (
                      <span className="meta">
                        {item.evidenceIds.length ? (
                          <>
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
                              Review finding
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
