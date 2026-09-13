"use client";

import { useState } from "react";
import { isWritableExecution } from "@/lib/product/localWorkspace";
import { useWorkspace } from "./WorkspaceProvider";
import { EvidenceForm } from "./EvidenceForm";
import { FindingForm } from "./FindingForm";
import { ReopenAudit } from "./ReopenAudit";

export function WorkspaceActions({
  auditId,
  primary = "work",
}: {
  auditId: string;
  primary?: "work" | "reopen";
}) {
  const workspace = useWorkspace();
  const executions = workspace.executions(auditId);
  const selected = executions.find((item) => item.executionId === workspace.selectedId(auditId)) ?? null;
  const writable = isWritableExecution(selected);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [findingOpen, setFindingOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  function closeCurrent() {
    if (!selected) return;
    try {
      workspace.closeExecution(auditId, selected.executionId);
      setCloseError(null);
    } catch (cause) {
      setCloseError(cause instanceof Error ? cause.message : "This execution could not be closed.");
    }
  }

  return (
    <>
      <div className="va-actions">
        {workspace.canReopen(auditId) ? <ReopenAudit auditId={auditId} stayOnPage /> : null}
        {writable ? (
          <button type="button" className={primary === "work" ? "va-btn va-btn-primary" : "va-btn"} onClick={closeCurrent}>
            Close execution
          </button>
        ) : null}
        <button
          type="button"
          className="va-btn"
          onClick={() => setEvidenceOpen(true)}
          disabled={!writable}
        >
          Add evidence
        </button>
        <button
          type="button"
          className="va-btn"
          onClick={() => setFindingOpen(true)}
          disabled={!writable}
        >
          Add finding
        </button>
      </div>
      {closeError ? <p className="va-empty">{closeError}</p> : null}
      {!writable ? (
        <p className="va-empty">
          {selected?.status === "closed"
            ? `${selected.label} is closed. Reopen the audit to start a new execution. The closed record stays unchanged.`
            : "New evidence and findings belong on an open execution. Reopen the audit or create an execution first. The original sealed record stays unchanged."}
        </p>
      ) : (
        <p className="va-empty">
          Adding work to {selected?.label}. These actions are recorded as local
          activity. They are not sealed.
        </p>
      )}
      {evidenceOpen && selected ? (
        <EvidenceForm
          auditId={auditId}
          executionId={selected.executionId}
          onClose={() => setEvidenceOpen(false)}
        />
      ) : null}
      {findingOpen && selected ? (
        <FindingForm
          auditId={auditId}
          executionId={selected.executionId}
          onClose={() => setFindingOpen(false)}
        />
      ) : null}
    </>
  );
}
