"use client";

import { SealPanel } from "./SealPanel";

export function ExecutionTrust({
  auditId,
}: {
  auditId: string;
  executionId: string;
}) {
  return <SealPanel auditId={auditId} />;
}
