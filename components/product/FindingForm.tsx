"use client";

import { useState } from "react";
import type { FindingLife, FindingSeverity } from "@/lib/product/localWorkspace";
import { useWorkspace } from "./WorkspaceProvider";

export function FindingForm({
  auditId,
  executionId,
  onClose,
}: {
  auditId: string;
  executionId: string;
  onClose: () => void;
}) {
  const workspace = useWorkspace();
  const evidence = workspace.evidence(auditId, executionId);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<FindingSeverity>("medium");
  const [status, setStatus] = useState<FindingLife>("open");
  const [description, setDescription] = useState("");
  const [related, setRelated] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      workspace.addFinding({
        auditId,
        executionId,
        title,
        severity,
        status,
        description,
        evidenceIds: related,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add finding.");
    }
  }

  return (
    <div className="va-dialog-back" role="presentation" onClick={onClose}>
      <form className="va-dialog" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>Add sample finding</h2>
        <p>This is a product-level note on the open execution. It is not a sealed audit finding.</p>
        <div className="va-form">
          <label>
            Finding title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value as FindingSeverity)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as FindingLife)}>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </label>
          {evidence.length > 0 ? (
            <fieldset className="va-form">
              <legend>Related evidence</legend>
              {evidence.map((item) => (
                <label key={item.artifactId} className="va-check">
                  <input
                    type="checkbox"
                    checked={related.includes(item.artifactId)}
                    onChange={() =>
                      setRelated((current) =>
                        current.includes(item.artifactId)
                          ? current.filter((id) => id !== item.artifactId)
                          : [...current, item.artifactId],
                      )
                    }
                  />
                  {item.title}
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
        {error ? <p className="va-empty">{error}</p> : null}
        <div className="va-actions">
          <button type="button" className="va-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="va-btn va-btn-primary">
            Add finding
          </button>
        </div>
      </form>
    </div>
  );
}
