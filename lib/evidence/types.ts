/**
 * `uploading` and `processing` are optimistic client states. Only the server
 * ingest response may move an artifact to `ready` or `failed`.
 */
export type EvidenceProcessing = "uploading" | "processing" | "ready" | "failed";

export interface EvidenceChunk {
  readonly chunkId: string;
  readonly text: string;
  readonly locator: string;
  readonly section: string | null;
  readonly page: number | null;
  readonly row: number | null;
}

export interface RetrievedChunk extends EvidenceChunk {
  readonly evidenceId: string;
  readonly filename: string | null;
  readonly title: string;
  readonly score: number;
}

export interface EvidenceReference {
  readonly evidenceId: string;
  readonly chunkId: string;
  readonly label: string;
  readonly excerpt: string;
}

export type Grounding = "evidence-backed" | "insufficient";
export type Confidence = "high" | "medium" | "low" | "none";

export const INSUFFICIENT_EVIDENCE =
  "I couldn't find enough evidence in the uploaded audit materials to support that conclusion.";
