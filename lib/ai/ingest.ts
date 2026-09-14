import { createHash } from "node:crypto";
import { chunkText } from "@/lib/evidence/chunk";
import { parseDocumentText } from "@/lib/evidence/parse";
import type { EvidenceChunk, EvidenceProcessing } from "@/lib/evidence/types";

export const INGEST_MAX_BYTES = 2 * 1024 * 1024;
export const TEXT_EXCERPT_LIMIT = 8_000;

const ALLOWED: Record<string, string> = {
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
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
  readonly byteSize: number;
  readonly note: string;
  readonly processingStatus: EvidenceProcessing;
  readonly chunks: readonly EvidenceChunk[];
}

export function fingerprintBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function kindFor(filename: string, ext: string, parsedKind: string): string {
  const stem = filename.toLowerCase();
  if (stem.includes("contract") || stem.includes("agreement") || stem.includes("addendum") || stem.includes("dpa")) {
    return "Contract";
  }
  if (stem.includes("policy")) return "Policy";
  if (stem.includes("ledger") || stem.includes("journal") || ext === "csv" || parsedKind === "csv") return "Ledger";
  if (stem.includes("access") || stem.includes("log")) return "Access log";
  if (stem.includes("purchase") || stem.includes("approval")) return "Approval record";
  if (ext === "json" || parsedKind === "json") return "Other";
  if (ext === "txt" || ext === "pdf") return "Policy";
  return "Other";
}

export function ingestFile(file: { name: string; type: string; bytes: Uint8Array }): IngestedFile {
  if (file.bytes.byteLength === 0) throw new Error("That file is empty.");
  if (file.bytes.byteLength > INGEST_MAX_BYTES) throw new Error("That file is larger than 2 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExt = ["pdf", "csv", "xlsx", "txt", "xls", "json"].includes(ext);
  const mimeOk = Boolean(ALLOWED[file.type]);
  if (!allowedExt && !mimeOk) {
    throw new Error("Upload a PDF, CSV, XLSX, TXT, or JSON file.");
  }

  const fingerprint = fingerprintBytes(file.bytes);
  const byteSize = file.bytes.byteLength;

  try {
    const parsed = parseDocumentText(file.name, file.type, file.bytes);
    if ((parsed.kind === "txt" || parsed.kind === "csv" || parsed.kind === "json") && !parsed.text) {
      throw new Error("That text file has no readable content.");
    }
    if (parsed.kind === "xlsx") {
      return {
        filename: file.name,
        kind: kindFor(file.name, ext, parsed.kind),
        mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fingerprint,
        extraction: "unavailable",
        textExcerpt: null,
        byteSize,
        note: "This spreadsheet was fingerprinted. Cell extraction for XLSX is not implemented.",
        processingStatus: "ready",
        chunks: [],
      };
    }
    if (!parsed.text) {
      return {
        filename: file.name,
        kind: kindFor(file.name, ext, parsed.kind),
        mimeType: file.type || "application/pdf",
        fingerprint,
        extraction: "unavailable",
        textExcerpt: null,
        byteSize,
        note: "The file was fingerprinted. Text could not be extracted from this PDF.",
        processingStatus: "ready",
        chunks: [],
      };
    }
    const chunks = chunkText(file.name, parsed.text, parsed.kind);
    return {
      filename: file.name,
      kind: kindFor(file.name, ext, parsed.kind),
      mimeType: file.type || (parsed.kind === "csv" ? "text/csv" : parsed.kind === "json" ? "application/json" : "text/plain"),
      fingerprint,
      extraction: "text",
      textExcerpt: parsed.text.slice(0, TEXT_EXCERPT_LIMIT),
      byteSize,
      note:
        parsed.text.length > TEXT_EXCERPT_LIMIT
          ? "Extracted text was truncated for storage. Addressable chunks were created."
          : `${chunks.length} evidence chunk${chunks.length === 1 ? "" : "s"} ready.`,
      processingStatus: "ready",
      chunks,
    };
  } catch {
    return {
      filename: file.name,
      kind: kindFor(file.name, ext, ext),
      mimeType: file.type || "application/octet-stream",
      fingerprint,
      extraction: "unavailable",
      textExcerpt: null,
      byteSize,
      note: "The file was received but could not be parsed.",
      processingStatus: "failed",
      chunks: [],
    };
  }
}
