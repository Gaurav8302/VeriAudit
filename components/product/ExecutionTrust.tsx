"use client";

import { ExecutionTrustProvider } from "./ExecutionTrustProvider";
import { SealPanel } from "./SealPanel";

export function ExecutionTrust({
  auditId,
  executionId,
}: {
  auditId: string;
  executionId: string;
}) {
  return (
    <ExecutionTrustProvider auditId={auditId} executionId={executionId}>
      <SealPanel auditId={auditId} />
    </ExecutionTrustProvider>
  );
}
