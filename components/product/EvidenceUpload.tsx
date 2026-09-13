"use client";

import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";

export function EvidenceUpload({
  auditId,
  executionId,
}: {
  auditId: string;
  executionId: string;
}) {
  const workspace = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("executionId", executionId);
      const response = await fetch("/api/product/evidence/ingest", { method: "POST", body });
      const payload = (await response.json()) as {
        error?: string;
        filename?: string;
        kind?: string;
        fingerprint?: string;
        extraction?: "text" | "unavailable";
        textExcerpt?: string | null;
        note?: string;
      };
      if (!response.ok || !payload.filename || !payload.fingerprint) {
        throw new Error(payload.error ?? "The file could not be attached.");
      }
      workspace.addEvidence({
        auditId,
        executionId,
        title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        kind: payload.kind ?? "Other",
        source: "Upload",
        description: payload.note ?? "Uploaded evidence.",
        filename: payload.filename,
        fingerprint: payload.fingerprint,
        extraction: payload.extraction,
        textExcerpt: payload.textExcerpt ?? null,
        sample: false,
      });
      setNote(payload.note ?? "Evidence added to audit. Analysis: work in progress until you ask VeriAudit.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be attached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="va-upload">
      <p className="va-empty">
        Upload PDF, CSV, XLSX, or TXT. TXT and CSV are read. PDF and XLSX are
        fingerprinted only — extraction is not implemented yet.
      </p>
      <p className="va-empty">
        Not ready to upload? Use{" "}
        <a href="/product-samples/q3-general-ledger.csv" download>
          Q3 General Ledger
        </a>{" "}
        and{" "}
        <a href="/product-samples/revenue-recognition-policy.txt" download>
          Revenue Recognition Policy
        </a>
        .
      </p>
      <label className="va-btn">
        {busy ? "Attaching…" : "Upload evidence"}
        <input
          type="file"
          accept=".pdf,.csv,.xlsx,.txt"
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onFile(file);
          }}
        />
      </label>
      {note ? <p className="va-empty">{note}</p> : null}
      {error ? <p className="va-empty">{error}</p> : null}
    </div>
  );
}
