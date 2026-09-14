"use client";

import Link from "next/link";
import { useState } from "react";
import { findingReviewLabel, isSampleAudit } from "@/lib/product/localWorkspace";
import { SAMPLE_CONTROLS } from "@/lib/product/sampleAudit";
import { ExecutionSwitcher } from "./ExecutionSwitcher";
import { ExecutionTrustProvider, useExecutionTrust } from "./ExecutionTrustProvider";
import { SealPanel } from "./SealPanel";
import { WorkspaceCommand } from "./WorkspaceCommand";
import { useAuditPhase } from "./useAuditPhase";
import { useWorkspace } from "./WorkspaceProvider";

function CompactStatus({ phase, verified }: { phase: string; verified: boolean }) {
  if (verified) return <p className="va-rail-status is-verified">✓ CRYPTOGRAPHICALLY VERIFIED</p>;
  if (phase === "sealed") return <p className="va-rail-status is-sealed">✓ SEALED</p>;
  if (phase === "ready_to_seal") return <p className="va-rail-status is-ready">READY TO SEAL</p>;
  if (phase === "review") return <p className="va-rail-status">● ACTIVE · HUMAN REVIEW</p>;
  return <p className="va-rail-status">● ACTIVE</p>;
}

function liveSteps(input: {
  hasEvidence: boolean;
  analyzed: boolean;
  aiStarted: boolean;
  aiDone: boolean;
  findingProposed: boolean;
  reviewAccepted: boolean;
  reviewDismissed: boolean;
}) {
  const steps: { done: boolean; label: string }[] = [
    { done: input.hasEvidence, label: "Evidence added" },
    { done: input.analyzed, label: "Evidence analyzed" },
    { done: input.aiDone, label: "AI analysis completed" },
    { done: input.findingProposed, label: "Finding proposed" },
  ];
  if (input.reviewAccepted) steps.push({ done: true, label: "Human review accepted" });
  else if (input.reviewDismissed) steps.push({ done: true, label: "Human review dismissed" });
  else if (input.findingProposed) steps.push({ done: false, label: "Human review pending" });
  return steps;
}

export function LiveExecutionLedger({
  auditId,
  title,
  domain,
}: {
  auditId: string;
  title?: string;
  domain?: string;
}) {
  const { execution } = useAuditPhase(auditId);
  return (
    <ExecutionTrustProvider auditId={auditId} executionId={execution?.executionId ?? null}>
      <LedgerBody auditId={auditId} title={title} domain={domain} />
    </ExecutionTrustProvider>
  );
}

function LedgerBody({
  auditId,
  title,
  domain,
}: {
  auditId: string;
  title?: string;
  domain?: string;
}) {
  const workspace = useWorkspace();
  const { execution, executions, activities, actions, findings, evidence, hasSeal, phase } =
    useAuditPhase(auditId);
  const trust = useExecutionTrust();
  const [historyOpen, setHistoryOpen] = useState(false);

  const readyEvidence = evidence.filter((item) => item.processingStatus === "ready" && item.recorded);
  const pending = findings.filter((item) => item.review === "pending");
  const accepted = findings.some((item) => item.review === "accepted");
  const dismissed = findings.some((item) => item.review === "rejected" || item.review === "modified");
  const analyzed = actions.some(
    (item) =>
      (item.type === "ANALYZE_EVIDENCE" || item.type === "READ_EVIDENCE" || item.type === "COMPARE_EVIDENCE") &&
      item.status === "completed",
  );
  const aiStarted = actions.length > 0;
  const aiDone = actions.some((item) => item.status === "completed");
  const findingProposed =
    findings.length > 0 || activities.some((item) => item.type === "finding.created");
  const steps = liveSteps({
    hasEvidence: readyEvidence.length > 0,
    analyzed,
    aiStarted,
    aiDone,
    findingProposed,
    reviewAccepted: accepted && pending.length === 0,
    reviewDismissed: dismissed && pending.length === 0 && !accepted,
  });
  const showSeal =
    phase === "ready_to_seal" || phase === "sealed" || Boolean(trust.seal) || Boolean(trust.verified);

  if (!execution) {
    return (
      <aside className="va-rail" aria-label="Execution">
        <p className="va-kicker">Execution</p>
        <p className="va-empty">No execution yet.</p>
      </aside>
    );
  }

  return (
    <aside className="va-rail" aria-label="Execution">
      <header className="va-rail-head">
        <p className="va-kicker">Execution {String(execution.sequence).padStart(3, "0")}</p>
        <CompactStatus phase={phase} verified={Boolean(trust.verified)} />
        {domain ? <p className="va-rail-meta">{domain}</p> : null}
      </header>

      <section className="va-live-activity">
        <p className="va-kicker">Live activity</p>
        <ol className="va-rail-events" data-testid="live-activity">
          {steps.map((step) => (
            <li key={step.label} className={step.done ? "is-done" : "is-waiting"}>
              <span aria-hidden="true">{step.done ? "✓" : "○"}</span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
        {activities.length > 0 ? (
          <ol className="va-rail-log" data-testid="live-activity-log">
            {activities.slice(-8).map((item) => (
              <li key={item.activityId}>
                <span>{item.title}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="va-empty">Waiting for the first action on this execution.</p>
        )}
      </section>

      <div className="va-rail-stats">
        {isSampleAudit(auditId) ? (
          <>
            <p>
              <strong>{SAMPLE_CONTROLS.length}</strong> controls
            </p>
            <p>
              <strong>{findings.length}</strong> exceptions
            </p>
            <p>
              <strong>{pending.length}</strong> awaiting review
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>{readyEvidence.length}</strong> evidence
            </p>
            <p>
              <strong>{findings.length}</strong> findings
            </p>
            <p>
              <strong>{pending.length}</strong> awaiting review
            </p>
          </>
        )}
      </div>

      <Link className="va-rail-more" href={`/product/audits/${auditId}/trace`}>
        View full activity
      </Link>

      <WorkspaceCommand auditId={auditId} placement="rail" />

      {execution.status !== "open" && phase !== "ready_to_seal" && !hasSeal && pending.length > 0 ? (
        <p className="va-empty">Human review is still required before this execution can be sealed.</p>
      ) : null}

      {showSeal ? (
        <div id="execution-seal">
          <SealPanel auditId={auditId} confirmOpen={phase === "ready_to_seal"} compact />
        </div>
      ) : (
        <div id="execution-seal" hidden />
      )}

      {findings.length > 0 ? (
        <div className="va-rail-block">
          <p className="va-kicker">Findings</p>
          <ul>
            {findings.slice(0, 3).map((finding) => (
              <li key={finding.findingId}>
                <Link href={`/product/audits/${auditId}/findings/${finding.findingId}`}>
                  {finding.findingId}
                </Link>
                <span>{findingReviewLabel(finding.review)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details
        className="va-history"
        open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary>Execution history</summary>
        {historyOpen ? (
          <>
            {executions.map((item) => {
              const sealed = Boolean(workspace.sealFor(item.executionId));
              return (
                <p key={item.executionId}>
                  <strong>{item.label}</strong>{" "}
                  {sealed || item.status === "sealed"
                    ? "SEALED"
                    : item.status === "open"
                      ? "ACTIVE"
                      : "CLOSED"}
                  {item.parentExecutionId ? " · Based on prior execution" : ""}
                </p>
              );
            })}
            {executions.length > 1 ? <ExecutionSwitcher auditId={auditId} /> : null}
          </>
        ) : null}
      </details>
    </aside>
  );
}
