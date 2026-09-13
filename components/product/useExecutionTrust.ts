"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSealSnapshot } from "@/lib/product/productEvents";
import { isHeroOriginal } from "@/lib/product/localWorkspace";
import type { ExecutionSealBundle } from "@/lib/product/sealTypes";
import type { ProductVerification } from "@/lib/product/sealTypes";
import { useWorkspace } from "./WorkspaceProvider";

export function useExecutionTrust(auditId: string, executionId: string | null) {
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
        verified: true,
      }),
    })
      .then((response) => response.json())
      .then((body: { verification?: ProductVerification; error?: string }) => {
        if (cancelled) return;
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

  useEffect(() => {
    if (!executionId || !eligible) {
      setTamperAllowed(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/product/executions/${encodeURIComponent(executionId)}/verification`)
      .then((response) => response.json())
      .then((body: { tamperAllowed?: boolean }) => {
        if (!cancelled) setTamperAllowed(Boolean(body.tamperAllowed));
      })
      .catch(() => {
        if (!cancelled) setTamperAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, executionId]);

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
        body: JSON.stringify({ snapshot: snapshot(), verified: true }),
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
          verified: true,
        }),
      });
      const body = (await response.json()) as { verification?: ProductVerification; error?: string };
      if (!response.ok || !body.verification) {
        throw new Error(body.error ?? "Verification could not be completed.");
      }
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
