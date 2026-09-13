"use client";

import Link from "next/link";
import { useState } from "react";
import { findingReviewLabel, isWritableExecution } from "@/lib/product/localWorkspace";
import type { AiChatMessage, ProposedAction } from "@/lib/ai/types";
import { domainLabel } from "@/lib/product/workspace";
import { EvidenceUpload } from "./EvidenceUpload";
import { ProductExplainer } from "./ProductExplainer";
import { Term } from "./Term";
import { useWorkspace } from "./WorkspaceProvider";

const STARTERS = [
  { label: "Review uploaded evidence", prompt: "Review the uploaded evidence and summarize what it actually supports." },
  { label: "Check this control", prompt: "Which controls are present and which are missing evidence?" },
  { label: "Find exceptions", prompt: "Which transactions or records appear to violate the attached policy?" },
  { label: "Explain this finding", prompt: "Explain the most important exception in this evidence and what still needs a human decision." },
  { label: "Trace why this transaction was flagged", prompt: "Trace why a transaction or record in this evidence would be flagged, using only the attached material." },
  { label: "Compare evidence", prompt: "Compare these documents and note material mismatches that need human review." },
  { label: "Summarize the execution", prompt: "Summarize the work already recorded on this execution and what still needs a human decision." },
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
  const messages = executionId ? workspace.messages(auditId, executionId) : [];
  const actions = executionId ? workspace.actions(auditId, executionId) : [];
  const findings = executionId ? workspace.findings(auditId, executionId) : [];
  const uploads = executionId
    ? workspace
        .activities(auditId, executionId)
        .filter((item) => item.type === "evidence.uploaded" || item.type === "evidence.added")
    : [];
  const local = workspace.localAudit(auditId);
  const audit = workspace.audits.find((item) => item.auditId === auditId);
  const auditTitle = local?.title ?? audit?.title;
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const pendingFindings = findings.filter((item) => item.origin === "ai" && item.review === "pending");
  const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant") ?? null;
  const fill = studio || compact;

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

  const conversation = (
    <>
      {messages.length === 0 ? (
        <div className="va-assistant-empty">
          <p className="va-kicker">AI audit assistant</p>
          <h2>What should we investigate?</h2>
          <p>
            {evidence.length === 0
              ? "Give evidence to the AI auditor, then ask it to begin."
              : "Ask VeriAudit to review the evidence attached to this execution."}
          </p>
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
          ) : (
            <p className="va-empty">This execution is closed. New AI work belongs on a later run.</p>
          )}
        </div>
      ) : (
        <ol className="va-chat">
          {messages.map((item) => {
            const provider = providerLabel(item.provider);
            return (
              <li key={item.messageId} className={item.role === "user" ? "is-user" : "is-assistant"}>
                <strong>{item.role === "user" ? "You" : "VeriAudit"}</strong>
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
            <div key={finding.findingId} className="va-ai-finding">
              <strong>Potential exception</strong>
              <span>
                {finding.findingId} — {finding.title}. {findingReviewLabel(finding.review)} — AI is not the
                final authority.
              </span>
              <div className="va-actions">
                <button
                  type="button"
                  className="va-btn va-btn-primary"
                  onClick={() => workspace.reviewFinding(finding.findingId, "accepted")}
                >
                  Accept
                </button>
                <button type="button" className="va-btn" onClick={() => workspace.reviewFinding(finding.findingId, "rejected")}>
                  Dismiss
                </button>
                <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>Review finding</Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {running ? (
        <p className="va-ai-progress">
          <strong>Investigating</strong>
          <span>→ {running}</span>
        </p>
      ) : null}
      {error ? <p className="va-empty">{error}</p> : null}
    </>
  );

  const composer = (
    <div className="va-composer">
      {evidenceOpen && writable ? (
        <EvidenceUpload
          auditId={auditId}
          executionId={execution.executionId}
          compact
          onDone={() => setEvidenceOpen(false)}
        />
      ) : null}
      {writable && messages.length > 0 ? (
        <div className="va-starters">
          {STARTERS.slice(0, 4).map((item) => (
            <button
              key={item.label}
              type="button"
              className="va-chip"
              disabled={busy}
              onClick={() => void ask(item.prompt)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="va-composer-row">
        <label className="va-composer-field">
          <span className="va-sr-only">Ask VeriAudit</span>
          <textarea
            value={prompt}
            rows={2}
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
        {writable ? (
          <button type="button" className="va-btn" onClick={() => setEvidenceOpen((value) => !value)}>
            {evidenceOpen ? "Close" : "+ Evidence"}
          </button>
        ) : null}
        <button type="button" className="va-btn va-btn-primary" disabled={!writable || busy} onClick={() => void ask()}>
          {busy ? "AI working" : "Ask AI"}
        </button>
      </div>
    </div>
  );

  if (studio || fill) {
    return (
      <section className="va-assistant" id="ai-assistant">
        <header className="va-assistant-head">
          <div>
            <p className="va-kicker">AI audit assistant</p>
            <h1>{auditTitle ?? "Audit workspace"}</h1>
            <p>
              {audit ? domainLabel(audit.domain) : local ? domainLabel(local.domain) : ""}
              {execution ? ` · ${execution.label}` : ""}
              {evidence.length ? ` · ${evidence.length} evidence` : " · no evidence yet"}
            </p>
          </div>
          <nav className="va-assistant-links" aria-label="Investigate">
            <Link href={`/product/audits/${auditId}/evidence`}>Evidence</Link>
            <Link href={`/product/audits/${auditId}/findings`}>Findings</Link>
            <Link href={`/product/audits/${auditId}/trace`}>Activity</Link>
          </nav>
        </header>
        <div className="va-assistant-thread">{conversation}</div>
        {composer}
      </section>
    );
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
        <section className="va-section" id="ai-assistant">
          <p className="va-kicker">AI audit assistant</p>
          <h2>What should we investigate?</h2>
          {conversation}
          {composer}
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
          {latestAssistant?.mode === "live" && latestAssistant.provider && latestAssistant.provider !== "mock" ? (
            <p className="va-empty">
              Request completed
              {providerLabel(latestAssistant.provider)
                ? ` · ${providerLabel(latestAssistant.provider)}`
                : ""}
              .
            </p>
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
