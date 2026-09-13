"use client";

import { useState } from "react";
import { sealReadiness } from "@/lib/product/workspacePhase";
import { useAuditPhase } from "./useAuditPhase";
import { useExecutionTrust } from "./useExecutionTrust";

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
}: {
  auditId: string;
  confirmOpen?: boolean;
}) {
  const { execution, findings, evidence, activities, actions, hasSeal, readiness } = useAuditPhase(auditId);
  const trust = useExecutionTrust(auditId, execution?.executionId ?? null);
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
    <section className="va-seal">
      <p className="va-kicker">Execution trust</p>
      {verified ? (
        <>
          <h2>✓ Sealed · Verified</h2>
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
          <h2>Sealed · Not verified</h2>
          <p>{trust.verification?.claim ?? "The server did not confirm this execution."}</p>
        </>
      ) : trust.seal ? (
        <>
          <h2>✓ Sealed</h2>
          <p>
            {execution.label}. CooL receipts created. Verification is decided by
            the server, not this page.
          </p>
        </>
      ) : execution.status === "closed" ? (
        <>
          <h2>Seal {execution.label}</h2>
          <p>Sealing creates cryptographic evidence for this recorded execution.</p>
        </>
      ) : (
        <>
          <h2>Unsealed</h2>
          <p>Work stays live until this execution is closed. AI actions are recorded, not sealed.</p>
        </>
      )}

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
            {verified ? "Cryptographically verified" : failed ? "Verification failed" : "Verification"}
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
