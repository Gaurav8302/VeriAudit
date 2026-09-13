import { expand, tokenise } from "@/lib/search/tokenize";
import type { EvidenceChunk } from "./types";
import type { RetrievedChunk } from "./types";

const DEFAULT_LIMIT = 8;
const MIN_SCORE = 1.2;

const AUDIT_HINTS: Record<string, readonly string[]> = {
  transaction: ["ledger", "journal", "entry", "je", "rev"],
  transactions: ["ledger", "journal", "entry", "je"],
  policy: ["recognition", "criteria", "clause", "section"],
  revenue: ["ledger", "recognition", "rev", "policy"],
  control: ["mfa", "access", "privileged", "review"],
  controls: ["mfa", "access", "privileged", "review"],
  contract: ["clause", "approval", "addendum", "processor"],
  purchase: ["po", "order", "vendor", "approval"],
  approval: ["approver", "approved", "sign-off"],
  exception: ["not_delivered", "violation", "missing", "flagged"],
  exceptions: ["not_delivered", "violation", "missing"],
};

export function scoreChunk(query: string, chunk: EvidenceChunk, extra = ""): number {
  const { tokens, phrases } = expand(tokenise(query));
  const hinted = tokens.flatMap((token) => AUDIT_HINTS[token] ?? []);
  const all = [...new Set([...tokens, ...hinted])];
  if (all.length === 0) return 0;
  const haystack = `${extra} ${chunk.locator} ${chunk.section ?? ""} ${chunk.text}`.toLowerCase();
  let score = 0;
  for (const token of all) {
    if (haystack.includes(token)) score += token.length >= 6 ? 1.6 : 1;
  }
  for (const phrase of phrases) {
    if (haystack.includes(phrase)) score += 2;
  }
  if (chunk.section && tokens.some((token) => chunk.section!.toLowerCase().includes(token))) {
    score += 0.8;
  }
  return score;
}

export function retrieveChunks(
  query: string,
  items: readonly {
    evidenceId: string;
    title: string;
    filename: string | null;
    chunks: readonly EvidenceChunk[];
  }[],
  options?: { limit?: number; minScore?: number },
): RetrievedChunk[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const minScore = options?.minScore ?? MIN_SCORE;
  return items
    .flatMap((item) =>
      item.chunks.map((chunk) => ({
        ...chunk,
        evidenceId: item.evidenceId,
        filename: item.filename,
        title: item.title,
        score: scoreChunk(query, chunk, `${item.title} ${item.filename ?? ""}`),
      })),
    )
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, limit);
}
