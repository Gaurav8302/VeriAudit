"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSealSnapshot } from "@/lib/product/productEvents";
import { isHeroOriginal } from "@/lib/product/localWorkspace";
import type { ExecutionSealBundle } from "@/lib/product/sealTypes";
import type { ProductVerification } from "@/lib/product/sealTypes";
import { useWorkspace } from "./WorkspaceProvider";

/**
 * Seal and verify state for one execution.
 *
 * Mount this once per execution via `ExecutionTrustProvider`. Two components
 * previously called it independently, which doubled every verification request
 * and, through `describeIdentity`, doubled a key derivation on page load.
 */
export function useExecutionTrustState(auditId: string, executionId: string | null) {
  const workspace = useWorkspace();
  const execution = executionId
    ? workspace.executions(auditId).find((item) => item.executionId === executionId) ?? null
    : null;
  const seal = executionId ? workspace.sealFor(executionId) : null;
  const [verification, setVerification] = useState<ProductVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"seal" | "verify" | "tamper" | null>(null);
  const [tamperAllowed, setTamperAllowed] = useState(false);

  const cacheKey = useMemo(
    () => (seal ? `${seal.executionId}:${seal.contentDigests.join(",")}` : ""),
    [seal],
  );

  const eligible = Boolean(execution && executionId && !isHeroOriginal(executionId) && !execution.hasEngineTrail);

  // Verification only runs for an execution that actually carries a seal. No
  // cryptographic work happens during ordinary AI, evidence, or review work.
  useEffect(() => {
    setVerification(null);
    if (!seal || !eligible || !executionId) return;
    let cancelled = false;
    setBusy("verify");
    fetch("/api/product/executions/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        snapshot: buildSealSnapshot(workspace.state, auditId, executionId),
        seal,
      }),
    })
      .then((response) => response.json())
      .then((body: { verification?: ProductVerification; error?: string; tamperAllowed?: boolean }) => {
        if (cancelled) return;
        setTamperAllowed(Boolean(body.tamperAllowed));
        if (body.verification) {
          setVerification(body.verification);
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
  }, [auditId, cacheKey, eligible, executionId, seal]);

  function snapshot() {
    if (!executionId) throw new Error("No execution selected.");
    return buildSealSnapshot(workspace.state, auditId, executionId);
  }

  async function sealExecution() {
    if (!executionId) return;
    setBusy("seal");
    setError(null);
    try {
      const response = await fetch("/api/product/executions/seal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: snapshot() }),
      });
      const body = (await response.json()) as { seal?: ExecutionSealBundle; error?: string };
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

  async function verifyExecution(nextSeal = seal, simulateTamper?: "payload") {
    if (!nextSeal || !executionId) return;
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
        }),
      });
      const body = (await response.json()) as {
        verification?: ProductVerification;
        error?: string;
        tamperAllowed?: boolean;
      };
      if (!response.ok || !body.verification) {
        throw new Error(body.error ?? "Verification could not be completed.");
      }
      setTamperAllowed(Boolean(body.tamperAllowed));
      setVerification(body.verification);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  return {
    execution,
    seal,
    verification,
    error,
    busy,
    tamperAllowed,
    eligible,
    verified: verification?.status === "verified",
    failed: verification?.status === "failed",
    sealExecution,
    verifyExecution,
  };
}

export type ExecutionTrustState = ReturnType<typeof useExecutionTrustState>;
