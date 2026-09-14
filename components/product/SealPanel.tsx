"use client";

import { useState } from "react";
import { sealReadiness } from "@/lib/product/workspacePhase";
import { useAuditPhase } from "./useAuditPhase";
import { useExecutionTrust } from "./ExecutionTrustProvider";

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "va-trust-pass" : "va-trust-fail"}>
      {ok ? "✓" : "✕"} {label}
    </li>
  );
}

export function SealPanel({
  auditId,
  confirmOpen = false,
  compact = false,
}: {
  auditId: string;
  confirmOpen?: boolean;
  compact?: boolean;
}) {
  const { execution, findings, evidence, activities, actions, hasSeal, readiness } = useAuditPhase(auditId);
  const trust = useExecutionTrust();
  const [confirm, setConfirm] = useState(confirmOpen);
  const [details, setDetails] = useState(false);
  const checks = readiness.checks.length ? readiness.checks : sealReadiness({
    execution,
    hasSeal,
    findings,
    evidenceCount: evidence.length,
    activityCount: activities.length + actions.length,
  }).checks;

  if (!execution || !trust.eligible) return null;

  const verified = trust.verified;
  const failed = trust.failed;

  return (
    <section className={compact ? "va-seal is-compact" : "va-seal"}>
      <p className="va-kicker">{verified || trust.seal ? "Cryptographic evidence" : "Ready to seal"}</p>
      {verified ? (
        <>
          <h2>✓ CRYPTOGRAPHICALLY VERIFIED</h2>
          <p>{execution.label}. CooL receipts match the recorded execution.</p>
          <ul className="va-crypto">
            <li>ML-DSA-65</li>
            <li>Ed25519</li>
            <li>Merkle inclusion proof</li>
            <li>Measurement pinning</li>
            <li>Trusted signing key</li>
            <li>Append-only history</li>
          </ul>
        </>
      ) : failed ? (
        <>
          <h2>Verification failed</h2>
          <p>{trust.verification?.claim ?? "The server did not confirm this execution."}</p>
        </>
      ) : trust.seal ? (
        <>
          <h2>✓ SEALED</h2>
          <p>
            {execution.label}. Cryptographic evidence created.
            Verification is decided by the server, not this page.
          </p>
          <ul className="va-crypto">
            <li>ML-DSA-65</li>
            <li>Ed25519</li>
            <li>Merkle inclusion proof</li>
            <li>Measurement pinning</li>
            <li>Trusted signing key</li>
            <li>Append-only history</li>
          </ul>
        </>
      ) : execution.status === "closed" ? (
        <>
          <h2>READY TO SEAL</h2>
          <p>The execution is complete and required human reviews have been recorded.</p>
        </>
      ) : null}

      {confirm && !trust.seal ? (
        <div className="va-seal-confirm">
          <p className="va-kicker">Pre-seal checks</p>
          <ul className="va-trust-list">
            {checks.map((item) => (
              <CheckRow key={item.label} ok={item.ok} label={item.label} />
            ))}
          </ul>
          {!readiness.canRequestSeal ? (
            <p className="va-empty">
              Seal Execution stays unavailable until every required check passes.
              The server will also refuse catalog, hero, open, or already-sealed executions.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="va-actions">
        {!trust.seal && (execution.status === "closed" || execution.status === "sealed") ? (
          confirm ? (
            <button
              type="button"
              className="va-btn va-btn-primary"
              data-testid="seal-execution"
              onClick={() => void trust.sealExecution()}
              disabled={trust.busy !== null || !readiness.canRequestSeal}
            >
              {trust.busy === "seal" ? "Sealing…" : "Seal execution"}
            </button>
          ) : (
            <button type="button" className="va-btn va-btn-primary" onClick={() => setConfirm(true)}>
              Review seal
            </button>
          )
        ) : null}
        {trust.seal ? (
          <button
            type="button"
            className="va-btn va-btn-primary"
            data-testid="verify-execution"
            onClick={() => void trust.verifyExecution()}
            disabled={trust.busy !== null}
          >
            {trust.busy === "verify" ? "Verifying…" : "Verify execution"}
          </button>
        ) : null}
        {trust.seal && trust.tamperAllowed ? (
          <button
            type="button"
            className="va-btn"
            onClick={() => void trust.verifyExecution(trust.seal, "payload")}
            disabled={trust.busy !== null}
          >
            {trust.busy === "tamper" ? "Simulating…" : "Simulate historical tampering"}
          </button>
        ) : null}
        {trust.verification ? (
          <button type="button" className="va-btn" onClick={() => setDetails((value) => !value)}>
            {details ? "Hide verification" : "Show verification"}
          </button>
        ) : null}
      </div>
      {trust.error ? <p className="va-empty">{trust.error}</p> : null}

      {details && trust.verification ? (
        <div className="va-trust-panel">
          <h3>
            {verified ? "✓ CRYPTOGRAPHICALLY VERIFIED" : failed ? "Verification failed" : "Verification"}
          </h3>
          <ul className="va-trust-list">
            <CheckRow ok={trust.verification.checks.receiptAuthenticity} label="Receipt authenticity" />
            <CheckRow ok={trust.verification.checks.trustedIdentity} label="Trusted VeriAudit identity" />
            <CheckRow ok={trust.verification.checks.measurementPinned} label="Pinned software measurement" />
            <CheckRow ok={trust.verification.checks.inclusion} label="Inclusion proof" />
            <CheckRow ok={trust.verification.checks.executionIntegrity} label="Execution integrity" />
            <CheckRow ok={trust.verification.checks.eventHistory} label="Event history consistent" />
          </ul>
          <p className="va-empty">
            {trust.verification.eventsVerified} of {trust.verification.eventsChecked} events verified
          </p>
          {trust.verification.failures.length > 0 ? (
            <ul className="va-list">
              {trust.verification.failures.slice(0, 6).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
