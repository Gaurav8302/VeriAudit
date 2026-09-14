"use client";

import { useEffect, useRef, useState } from "react";
import type { EvidenceChunk, EvidenceProcessing } from "@/lib/evidence";
import { sampleFilesFor } from "@/lib/evidence/samplePack";
import { isSampleAudit } from "@/lib/product/localWorkspace";
import { useWorkspace } from "./WorkspaceProvider";

const autoStarted = new Set<string>();

interface IngestPayload {
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
}

function kindFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const stem = filename.toLowerCase();
  if (stem.includes("policy")) return "Policy";
  if (stem.includes("contract") || stem.includes("agreement") || stem.includes("addendum")) return "Contract";
  if (stem.includes("ledger") || stem.includes("journal")) return "Ledger";
  if (stem.includes("access") || stem.includes("log")) return "Access log";
  if (stem.includes("purchase") || stem.includes("approval")) return "Approval record";
  if (ext === "csv" || ext === "xlsx" || ext === "xls") return "Ledger";
  return "Other";
}

export function EvidenceUpload({
  auditId,
  executionId,
  compact = false,
  autoSample = false,
  onDone,
}: {
  auditId: string;
  executionId: string;
  compact?: boolean;
  autoSample?: boolean;
  onDone?: () => void;
}) {
  const workspace = useWorkspace();
  const evidence = workspace.evidence(auditId, executionId);
  const domain =
    workspace.localAudit(auditId)?.domain ??
    workspace.audits.find((item) => item.auditId === auditId)?.domain;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openedAt = workspace
    .activities(auditId, executionId)
    .find((item) => item.type === "execution.opened")?.occurredAt;
  const autoKey = `${auditId}:${executionId}:${openedAt ?? "pending"}`;
  const autoRef = useRef(false);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    // Show the artifact as UPLOADING before the request leaves the browser.
    const draft = workspace.beginEvidenceUpload({
      auditId,
      executionId,
      filename: file.name,
      kind: kindFromFilename(file.name),
      byteSize: file.size,
    });
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("executionId", executionId);
      const response = await fetch("/api/product/evidence/ingest", { method: "POST", body });
      const payload = (await response.json()) as IngestPayload;
      if (!response.ok || !payload.filename || !payload.fingerprint) {
        throw new Error(payload.error ?? "The file could not be attached.");
      }
      workspace.completeEvidenceUpload(draft.artifactId, {
        filename: payload.filename,
        kind: payload.kind ?? kindFromFilename(payload.filename),
        fingerprint: payload.fingerprint,
        extraction: payload.extraction,
        textExcerpt: payload.textExcerpt,
        byteSize: payload.byteSize,
        processingStatus: payload.processingStatus,
        chunks: payload.chunks,
        note: payload.note,
      });
      onDone?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The file could not be attached.";
      workspace.failEvidenceUpload(draft.artifactId, message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function useSamples() {
    setBusy(true);
    setError(null);
    // The manifest is static, so every file can show UPLOADING immediately.
    const manifest = sampleFilesFor(domain);
    const drafts = manifest.map((file) => ({
      file,
      draft: workspace.beginEvidenceUpload({
        auditId,
        executionId,
        filename: file.filename,
        kind: file.kind,
        sample: true,
      }),
    }));
    try {
      const response = await fetch("/api/product/evidence/sample-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionId, domain }),
      });
      const payload = (await response.json()) as {
        error?: string;
        files?: (IngestPayload & { filename: string; fingerprint: string })[];
      };
      if (!response.ok || !payload.files?.length) {
        throw new Error(payload.error ?? "Sample data could not be attached.");
      }
      for (const { file, draft } of drafts) {
        const match = payload.files.find((item) => item.filename === file.filename);
        if (!match) {
          workspace.failEvidenceUpload(draft.artifactId, "The server did not return this sample file.");
          continue;
        }
        workspace.completeEvidenceUpload(draft.artifactId, {
          filename: match.filename,
          kind: match.kind ?? file.kind,
          fingerprint: match.fingerprint,
          extraction: match.extraction,
          textExcerpt: match.textExcerpt,
          byteSize: match.byteSize,
          processingStatus: match.processingStatus,
          chunks: match.chunks,
          note: match.note,
        });
      }
      onDone?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Sample data could not be attached.";
      for (const { draft } of drafts) workspace.failEvidenceUpload(draft.artifactId, message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!autoSample || !isSampleAudit(auditId) || autoRef.current || autoStarted.has(autoKey)) return;
    if (evidence.some((item) => item.recorded || item.processingStatus === "uploading" || item.processingStatus === "processing")) {
      return;
    }
    autoRef.current = true;
    autoStarted.add(autoKey);
    void useSamples();
  }, [auditId, autoKey, autoSample, evidence, executionId]);

  const failed = evidence.filter((item) => item.processingStatus === "failed");

  return (
    <div className={compact ? "va-upload is-compact" : "va-upload"}>
      {compact ? null : (
        <p className="va-empty">
          Upload PDF, CSV, JSON, XLSX, or TXT. Parsed files become addressable chunks. XLSX is
          fingerprinted only.
        </p>
      )}
      <div className="va-actions">
        <label className={busy ? "va-btn is-disabled" : "va-btn"}>
          + Add evidence
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
        <button
          type="button"
          className="va-btn va-btn-primary"
          data-testid="use-sample-evidence"
          disabled={busy}
          onClick={() => void useSamples()}
        >
          Use sample evidence
        </button>
      </div>
      {failed.length > 0 ? (
        <ul className="va-evidence-status">
          {failed.map((item) => (
            <li key={item.artifactId} className="is-failed">
              <strong>✕ Upload failed</strong>
              <span>
                {item.filename ?? item.title}
                {item.processingError ? ` · ${item.processingError}` : ""}
              </span>
              <button
                type="button"
                className="va-btn va-btn-quiet"
                onClick={() => workspace.discardEvidence(item.artifactId)}
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error && failed.length === 0 ? <p className="va-empty">{error}</p> : null}
    </div>
  );
}
