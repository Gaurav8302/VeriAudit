"use client";

import Link from "next/link";
import { useState } from "react";
import { isWritableExecution } from "@/lib/product/localWorkspace";
import { ReopenAudit } from "./ReopenAudit";
import { useAuditPhase } from "./useAuditPhase";
import { useWorkspace } from "./WorkspaceProvider";

export function WorkspaceCommand({ auditId }: { auditId: string }) {
  const workspace = useWorkspace();
  const { execution, primary, canReopen } = useAuditPhase(auditId);
  const writable = isWritableExecution(execution);
  const [closeError, setCloseError] = useState<string | null>(null);

  function closeCurrent() {
    if (!execution) return;
    try {
      workspace.closeExecution(auditId, execution.executionId);
      setCloseError(null);
    } catch (cause) {
      setCloseError(cause instanceof Error ? cause.message : "This execution could not be closed.");
    }
  }

  return (
    <div className="va-command">
      <div className="va-actions">
        {primary === "continue" ? (
          <a href="#ai-assistant" className="va-btn va-btn-primary">
            Continue audit
          </a>
        ) : null}
        {primary === "review" ? (
          <Link href={`/product/audits/${auditId}/findings`} className="va-btn va-btn-primary">
            Review
          </Link>
        ) : null}
        {primary === "seal" ? (
          <a href="#execution-seal" className="va-btn va-btn-primary" data-testid="seal-cta">
            Seal execution
          </a>
        ) : null}
        {primary === "verify" ? (
          <a href="#execution-seal" className="va-btn va-btn-primary">
            Verify execution
          </a>
        ) : null}
        {canReopen ? <ReopenAudit auditId={auditId} stayOnPage /> : null}
        {writable ? (
          <button type="button" className="va-btn" onClick={closeCurrent}>
            Close execution
          </button>
        ) : null}
        {writable ? (
          <Link href={`/product/audits/${auditId}/evidence`} className="va-btn">
            Add evidence
          </Link>
        ) : null}
      </div>
      {closeError ? <p className="va-empty">{closeError}</p> : null}
    </div>
  );
}
