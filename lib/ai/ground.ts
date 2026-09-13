import { fallbackChunks } from "@/lib/evidence/chunk";
import { INSUFFICIENT_EVIDENCE, retrieveChunks, type EvidenceReference, type Grounding } from "@/lib/evidence";
import type { RetrievedChunk } from "@/lib/evidence/types";
import type { AiEvidenceContext, ParsedAiWork, ProposedAction } from "./types";

export function chunksFromEvidence(evidence: readonly AiEvidenceContext[]) {
  return evidence.map((item) => ({
    evidenceId: item.evidenceId,
    title: item.title,
    filename: item.filename,
    chunks:
      item.chunks && item.chunks.length > 0
        ? item.chunks
        : fallbackChunks(item.evidenceId, item.filename, item.textExcerpt),
  }));
}

export function retrieveForPrompt(prompt: string, evidence: readonly AiEvidenceContext[]): RetrievedChunk[] {
  return retrieveChunks(prompt, chunksFromEvidence(evidence));
}

export function referencesFrom(hits: readonly RetrievedChunk[]): EvidenceReference[] {
  return hits.map((hit) => ({
    evidenceId: hit.evidenceId,
    chunkId: hit.chunkId,
    label: `${hit.filename ?? hit.title} · ${hit.locator}`,
    excerpt: hit.text.slice(0, 220),
  }));
}

export function validateReferences(
  proposed: readonly {
    evidenceId?: string;
    chunkId?: string;
    label?: string;
    excerpt?: string;
  }[],
  allowed: readonly RetrievedChunk[],
): EvidenceReference[] {
  const byChunk = new Map(allowed.map((item) => [item.chunkId, item]));
  const byEvidence = new Set(allowed.map((item) => item.evidenceId));
  const kept: EvidenceReference[] = [];
  for (const item of proposed) {
    const hit = item.chunkId ? byChunk.get(item.chunkId) : undefined;
    if (hit) {
      kept.push({
        evidenceId: hit.evidenceId,
        chunkId: hit.chunkId,
        label: `${hit.filename ?? hit.title} · ${hit.locator}`,
        excerpt: hit.text.slice(0, 220),
      });
      continue;
    }
    if (item.evidenceId && byEvidence.has(item.evidenceId) && !item.chunkId) {
      const first = allowed.find((row) => row.evidenceId === item.evidenceId);
      if (first) {
        kept.push({
          evidenceId: first.evidenceId,
          chunkId: first.chunkId,
          label: `${first.filename ?? first.title} · ${first.locator}`,
          excerpt: first.text.slice(0, 220),
        });
      }
    }
  }
  return uniqueRefs(kept);
}

function uniqueRefs(items: readonly EvidenceReference[]): EvidenceReference[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.evidenceId}:${item.chunkId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scopeEvidenceIds(
  ids: readonly string[],
  allowed: readonly RetrievedChunk[],
): string[] {
  const valid = new Set(allowed.map((item) => item.evidenceId));
  return ids.filter((id) => valid.has(id));
}

export function insufficientWork(): ParsedAiWork {
  return {
    reply: INSUFFICIENT_EVIDENCE,
    actions: [
      {
        type: "SEARCH_EVIDENCE",
        title: "Evidence search",
        detail: "No uploaded chunks were relevant enough to support a conclusion.",
        evidenceIds: [],
        chunkIds: [],
      },
    ],
    confidence: "none",
    grounding: "insufficient",
    evidenceReferences: [],
    suggestedFindings: [],
  };
}

export function groundedActions(
  work: ParsedAiWork,
  hits: readonly RetrievedChunk[],
  prompt: string,
): ProposedAction[] {
  const evidenceIds = [...new Set(hits.map((item) => item.evidenceId))];
  const chunkIds = hits.map((item) => item.chunkId);
  const consulted = hits
    .map((item) => `${item.filename ?? item.title} (${item.locator})`)
    .join("; ");
  const search: ProposedAction = {
    type: "SEARCH_EVIDENCE",
    title: "Evidence retrieved",
    detail: consulted ? `Consulted ${consulted}.` : "No relevant sections.",
    evidenceIds,
    chunkIds,
  };
  const reads = evidenceIds.map((evidenceId) => {
    const used = hits.filter((item) => item.evidenceId === evidenceId);
    return {
      type: "READ_EVIDENCE" as const,
      title: `Read ${used[0]?.title ?? evidenceId}`,
      detail: used.map((item) => item.locator).join(", "),
      evidenceIds: [evidenceId],
      chunkIds: used.map((item) => item.chunkId),
    };
  });
  const scoped = work.actions
    .filter((item) => item.type !== "READ_EVIDENCE" && item.type !== "SEARCH_EVIDENCE")
    .map((item) => ({
      ...item,
      evidenceIds: scopeEvidenceIds(item.evidenceIds, hits).length
        ? scopeEvidenceIds(item.evidenceIds, hits)
        : evidenceIds,
      chunkIds: item.chunkIds?.filter((id) => chunkIds.includes(id)) ?? chunkIds,
    }));
  const analyze: ProposedAction = {
    type: "ANALYZE_EVIDENCE",
    title: "AI analysis",
    detail: `Request: ${prompt.slice(0, 160)}. Evidence consulted: ${consulted}. Result: ${work.reply.slice(0, 180)}`,
    evidenceIds,
    chunkIds,
  };
  const withoutAnalyze = scoped.filter((item) => item.type !== "ANALYZE_EVIDENCE");
  return [search, ...reads, analyze, ...withoutAnalyze];
}

export function groundingOf(refs: readonly EvidenceReference[]): Grounding {
  return refs.length > 0 ? "evidence-backed" : "insufficient";
}
