import { createHash } from "node:crypto";

export const INGEST_MAX_BYTES = 2 * 1024 * 1024;
export const TEXT_EXCERPT_LIMIT = 8_000;

const ALLOWED: Record<string, string> = {
  "text/plain": "txt",
  "text/csv": "csv",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xlsx",
};

export interface IngestedFile {
  readonly filename: string;
  readonly kind: string;
  readonly mimeType: string;
  readonly fingerprint: string;
  readonly extraction: "text" | "unavailable";
  readonly textExcerpt: string | null;
  readonly note: string;
}

export function fingerprintBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function ingestFile(file: { name: string; type: string; bytes: Uint8Array }): IngestedFile {
  if (file.bytes.byteLength === 0) throw new Error("That file is empty.");
  if (file.bytes.byteLength > INGEST_MAX_BYTES) throw new Error("That file is larger than 2 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExt = ["pdf", "csv", "xlsx", "txt", "xls"].includes(ext);
  const mimeOk = Boolean(ALLOWED[file.type]);
  if (!allowedExt && !mimeOk) {
    throw new Error("Upload a PDF, CSV, XLSX, or TXT file.");
  }
  const kind = ext === "csv" || file.type === "text/csv" ? "Ledger" : ext === "txt" || ext === "pdf" ? "Policy" : "Other";
  const fingerprint = fingerprintBytes(file.bytes);
  const textLike = ext === "txt" || ext === "csv" || file.type === "text/plain" || file.type === "text/csv";
  if (textLike) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes).trim();
    if (!text) throw new Error("That text file has no readable content.");
    return {
      filename: file.name,
      kind,
      mimeType: file.type || (ext === "csv" ? "text/csv" : "text/plain"),
      fingerprint,
      extraction: "text",
      textExcerpt: text.slice(0, TEXT_EXCERPT_LIMIT),
      note: text.length > TEXT_EXCERPT_LIMIT ? "Extracted text was truncated for analysis." : "Text extracted.",
    };
  }
  return {
    filename: file.name,
    kind,
    mimeType: file.type || "application/octet-stream",
    fingerprint,
    extraction: "unavailable",
    textExcerpt: null,
    note: "This file was fingerprinted and attached. Deep text extraction for PDF/XLSX is not implemented.",
  };
}
