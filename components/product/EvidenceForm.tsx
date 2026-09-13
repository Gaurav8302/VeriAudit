"use client";

import { useState } from "react";
import { EVIDENCE_TYPES } from "@/lib/product/localWorkspace";
import { useWorkspace } from "./WorkspaceProvider";

export function EvidenceForm({
  auditId,
  executionId,
  onClose,
}: {
  auditId: string;
  executionId: string;
  onClose: () => void;
}) {
  const workspace = useWorkspace();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof EVIDENCE_TYPES)[number]>("Ledger");
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      workspace.addEvidence({ auditId, executionId, title, kind, source, description, reference });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add evidence.");
    }
  }

  return (
    <div className="va-dialog-back" role="presentation" onClick={onClose}>
      <form className="va-dialog" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Add sample evidence</h2>
        <p>This attaches metadata to the open execution. It is not a file upload and is not analysed.</p>
        <div className="va-form">
          <label>
            Evidence name
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Evidence type
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              {EVIDENCE_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Source
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Finance team, vendor portal…" />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </label>
          <label>
            Reference / date
            <input value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
        </div>
        {error ? <p className="va-empty">{error}</p> : null}
        <p className="va-wip">Sample evidence · analysis work in progress</p>
        <div className="va-actions">
          <button type="button" className="va-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="va-btn va-btn-primary">
            Add evidence
          </button>
        </div>
      </form>
    </div>
  );
}
