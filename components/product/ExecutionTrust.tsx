"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSealSnapshot } from "@/lib/product/productEvents";
import { isHeroOriginal, isWritableExecution } from "@/lib/product/localWorkspace";
import type { ProductVerification } from "@/lib/product/sealTypes";
import { useWorkspace } from "./WorkspaceProvider";

interface PolicyResponse {
  tamperAllowed?: boolean;
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "va-trust-pass" : "va-trust-fail"}>
      {ok ? "✓" : "✕"} {label}
    </li>
  );
}

export function ExecutionTrust({
  auditId,
  executionId,
}: {
  auditId: string;
  executionId: string;
}) {
  const workspace = useWorkspace();
  const execution = workspace.executions(auditId).find((item) => item.executionId === executionId) ?? null;
  const seal = workspace.sealFor(executionId);
  const [verification, setVerification] = useState<ProductVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"seal" | "verify" | "tamper" | null>(null);
  const [open, setOpen] = useState(false);
  const [tamperAllowed, setTamperAllowed] = useState(false);

  const cacheKey = useMemo(
    () => (seal ? `${seal.executionId}:${seal.contentDigests.join(",")}` : ""),
    [seal],
  );

  useEffect(() => {
    setVerification(null);
    if (!seal) return;
    let cancelled = false;
    setBusy("verify");
    fetch("/api/product/executions/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        snapshot: buildSealSnapshot(workspace.state, auditId, executionId),
        seal,
        verified: true,
      }),
    })
      .then((response) => response.json())
      .then((body: { verification?: ProductVerification; error?: string }) => {
        if (cancelled) return;
        if (body.verification) {
          setVerification(body.verification);
          setOpen(true);
          setError(null);
        } else {
          setError(body.error ?? "Verification could not be completed.");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Verification could not be completed.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [auditId, cacheKey, executionId, seal]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/product/executions/${encodeURIComponent(executionId)}/verification`)
      .then((response) => response.json())
      .then((body: PolicyResponse) => {
        if (!cancelled) setTamperAllowed(Boolean(body.tamperAllowed));
      })
      .catch(() => {
        if (!cancelled) setTamperAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [executionId]);

  if (!execution || isHeroOriginal(executionId) || execution.hasEngineTrail) {
    return null;
  }

  const snapshot = () => buildSealSnapshot(workspace.state, auditId, executionId);

  async function sealExecution() {
    setBusy("seal");
    setError(null);
    try {
      const response = await fetch("/api/product/executions/seal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: snapshot(), verified: true }),
      });
      const body = (await response.json()) as { seal?: Parameters<typeof workspace.attachSeal>[1]; error?: string };
      if (!response.ok || !body.seal) {
        throw new Error(body.error ?? "This execution could not be sealed.");
      }
      workspace.attachSeal(executionId, body.seal);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This execution could not be sealed.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyExecution(
    nextSeal = seal,
    simulateTamper?: "payload",
  ) {
    if (!nextSeal) return;
    setBusy(simulateTamper ? "tamper" : "verify");
    setError(null);
    try {
      const response = await fetch("/api/product/executions/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          snapshot: snapshot(),
          seal: nextSeal,
          simulateTamper,
          verified: true,
        }),
      });
      const body = (await response.json()) as {
        verification?: ProductVerification;
        error?: string;
      };
      if (!response.ok || !body.verification) {
        throw new Error(body.error ?? "Verification could not be completed.");
      }
      setVerification(body.verification);
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  const closed = execution.status === "closed" || execution.status === "sealed";
  const writable = isWritableExecution(execution);
  const verified = verification?.status === "verified";
  const failed = verification?.status === "failed";

  return (
    <section className="va-section va-trust">
      <h2>Execution trust</h2>
      <p className="va-empty">
        {execution.executionId}
        {writable ? " · Active · Unsealed" : null}
        {closed && !seal ? " · Closed · Unsealed" : null}
        {seal ? " · Closed · Sealed" : null}
        {verified ? " · Cryptographically verified" : null}
        {failed ? " · Verification failed" : null}
      </p>
      {verified ? (
        <>
          <p className="va-trust-status">VERIFIED</p>
          <p className="va-empty">
            The recorded execution matches its cryptographic evidence.
          </p>
          <p className="va-empty">{verification.claim}</p>
        </>
      ) : failed ? (
        <>
          <p className="va-trust-status is-fail">FAILED</p>
          <p className="va-empty">{verification.claim}</p>
        </>
      ) : seal ? (
        <p className="va-empty">
          Receipts are stored with this workspace. Verification is decided by
          the server, not by this page.
        </p>
      ) : closed ? (
        <p className="va-empty">
          Closing created the audit boundary. Sealing records the canonical
          events with CooL. Attestation and enclave evidence are not available
          in simulated mode.
        </p>
      ) : (
        <p className="va-empty">
          Work stays live until the execution is closed. Intermediate AI
          actions are not sealed automatically.
        </p>
      )}

      <div className="va-actions">
        {closed && !seal ? (
          <button type="button" className="va-btn va-btn-primary" onClick={sealExecution} disabled={busy !== null}>
            {busy === "seal" ? "Sealing…" : "Seal execution"}
          </button>
        ) : null}
        {seal ? (
          <button type="button" className="va-btn" onClick={() => void verifyExecution()} disabled={busy !== null}>
            {busy === "verify" ? "Verifying…" : "Verify execution"}
          </button>
        ) : null}
        {seal && tamperAllowed ? (
          <button
            type="button"
            className="va-btn"
            onClick={() => void verifyExecution(seal, "payload")}
            disabled={busy !== null}
          >
            {busy === "tamper" ? "Simulating…" : "Simulate historical tampering"}
          </button>
        ) : null}
        {verification ? (
          <button type="button" className="va-btn" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide verification" : "Show verification"}
          </button>
        ) : null}
      </div>
      {error ? <p className="va-empty">{error}</p> : null}
      {tamperAllowed && seal ? (
        <p className="va-empty">
          Tampering is a development control. It mutates a copy during
          verification and does not rewrite the stored execution.
        </p>
      ) : null}

      {open && verification ? (
        <div className="va-trust-panel">
          <h3>{verified ? "Cryptographically verified" : failed ? "Verification failed" : "Verification"}</h3>
          <p className="va-empty">
            CooL produced the cryptographic evidence. These checks confirm the
            recorded execution still matches that evidence.
          </p>
          <ul className="va-trust-list">
            <CheckRow ok={verification.checks.receiptAuthenticity} label="Receipt authenticity" />
            <CheckRow ok={verification.checks.trustedIdentity} label="Trusted VeriAudit identity" />
            <CheckRow ok={verification.checks.measurementPinned} label="Pinned software measurement" />
            <CheckRow ok={verification.checks.inclusion} label="Inclusion proof" />
            <CheckRow ok={verification.checks.executionIntegrity} label="Execution integrity" />
            <CheckRow ok={verification.checks.eventHistory} label="Event history consistent" />
          </ul>
          <p className="va-empty">
            {verification.eventsVerified} of {verification.eventsChecked} events verified
          </p>
          <p className="va-empty">
            Technical detail: CooL · ML-DSA-65 / Ed25519 · inclusion proof.
            Attestation, enclave, witnesses, and anchor are absent in simulated mode.
          </p>
          {verification.failures.length > 0 ? (
            <ul className="va-list">
              {verification.failures.slice(0, 6).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
