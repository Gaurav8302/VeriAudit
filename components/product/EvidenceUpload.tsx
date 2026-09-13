"use client";

import { useState } from "react";
import type { EvidenceChunk, EvidenceProcessing } from "@/lib/evidence";
import { useWorkspace } from "./WorkspaceProvider";

export function EvidenceUpload({
  auditId,
  executionId,
}: {
  auditId: string;
  executionId: string;
}) {
  const workspace = useWorkspace();
  const evidence = workspace.evidence(auditId, executionId);
  const domain = workspace.localAudit(auditId)?.domain ?? workspace.audits.find((item) => item.auditId === auditId)?.domain;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function attach(payload: {
    filename: string;
    kind?: string;
    fingerprint: string;
    extraction?: "text" | "unavailable";
    textExcerpt?: string | null;
    byteSize?: number;
    note?: string;
    processingStatus?: EvidenceProcessing;
    chunks?: readonly EvidenceChunk[];
    sample?: boolean;
  }) {
    workspace.addEvidence({
      auditId,
      executionId,
      title: payload.filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      kind: payload.kind ?? "Other",
      source: payload.sample ? "Sample pack" : "Upload",
      description: payload.note ?? "Uploaded evidence.",
      filename: payload.filename,
      fingerprint: payload.fingerprint,
      extraction: payload.extraction,
      textExcerpt: payload.textExcerpt ?? null,
      byteSize: payload.byteSize,
      processingStatus: payload.processingStatus,
      chunks: payload.chunks,
      sample: payload.sample ?? false,
    });
  }

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
        byteSize?: number;
        note?: string;
        processingStatus?: EvidenceProcessing;
        chunks?: EvidenceChunk[];
      };
      if (!response.ok || !payload.filename || !payload.fingerprint) {
        throw new Error(payload.error ?? "The file could not be attached.");
      }
      attach({
        filename: payload.filename,
        kind: payload.kind,
        fingerprint: payload.fingerprint,
        extraction: payload.extraction,
        textExcerpt: payload.textExcerpt,
        byteSize: payload.byteSize,
        note: payload.note,
        processingStatus: payload.processingStatus,
        chunks: payload.chunks,
      });
      setNote(payload.processingStatus === "failed" ? payload.note ?? "Processing failed." : payload.note ?? "Evidence is ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be attached.");
    } finally {
      setBusy(false);
    }
  }

  async function useSamples() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/product/evidence/sample-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionId, domain }),
      });
      const payload = (await response.json()) as {
        error?: string;
        files?: Array<{
          filename: string;
          kind: string;
          fingerprint: string;
          extraction: "text" | "unavailable";
          textExcerpt: string | null;
          byteSize: number;
          note: string;
          processingStatus: EvidenceProcessing;
          chunks: EvidenceChunk[];
          sample: boolean;
        }>;
      };
      if (!response.ok || !payload.files?.length) {
        throw new Error(payload.error ?? "Sample data could not be attached.");
      }
      for (const file of payload.files) attach(file);
      setNote(`${payload.files.length} sample files are ready. This is the evidence AI will work against.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sample data could not be attached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="va-upload">
      {evidence.length === 0 ? (
        <p className="va-empty">No evidence uploaded yet. This is the evidence AI will work against.</p>
      ) : (
        <p className="va-empty">
          Upload PDF, CSV, JSON, XLSX, or TXT. Parsed files become addressable chunks. XLSX is fingerprinted only.
        </p>
      )}
      <div className="va-actions">
        <label className="va-btn">
          {busy ? "Working…" : "Upload evidence"}
          <input
            type="file"
            accept=".pdf,.csv,.xlsx,.txt,.json"
            hidden
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onFile(file);
            }}
          />
        </label>
        <button type="button" className="va-btn va-btn-primary" disabled={busy} onClick={() => void useSamples()}>
          Try with sample audit data
        </button>
      </div>
      {note ? <p className="va-empty">{note}</p> : null}
      {error ? <p className="va-empty">{error}</p> : null}
    </div>
  );
}
