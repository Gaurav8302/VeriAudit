"use client";

import { createContext, useContext } from "react";
import { useExecutionTrustState, type ExecutionTrustState } from "./useExecutionTrust";

const ExecutionTrustContext = createContext<ExecutionTrustState | null>(null);

/**
 * One seal/verify instance per execution. The rail and the seal panel share it
 * so a workspace render issues a single verification request.
 */
export function ExecutionTrustProvider({
  auditId,
  executionId,
  children,
}: {
  auditId: string;
  executionId: string | null;
  children: React.ReactNode;
}) {
  const value = useExecutionTrustState(auditId, executionId);
  return <ExecutionTrustContext.Provider value={value}>{children}</ExecutionTrustContext.Provider>;
}

export function useExecutionTrust(): ExecutionTrustState {
  const value = useContext(ExecutionTrustContext);
  if (!value) {
    throw new Error("useExecutionTrust must be used inside ExecutionTrustProvider");
  }
  return value;
}
