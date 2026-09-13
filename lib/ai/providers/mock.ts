import { INSUFFICIENT_EVIDENCE } from "@/lib/evidence";
import type { AiChatRequest, NormalizedAiResponse } from "../types";

export function mockAnalyze(request: AiChatRequest): NormalizedAiResponse {
  const evidence = request.evidence;
  const names = evidence.map((item) => item.filename ?? item.title);
  const ids = evidence.map((item) => item.evidenceId);
  const chunks = evidence.flatMap((item) => item.chunks ?? []);
  const reply = JSON.stringify({
    reply:
      evidence.length === 0
        ? INSUFFICIENT_EVIDENCE
        : `Based on ${names.join(" and ")}, I found items that need human review. This is mock analysis, not a live provider.`,
    confidence: evidence.length === 0 ? "none" : "medium",
    evidenceReferences: chunks.slice(0, 3).map((chunk) => {
      const parent = evidence.find((item) => item.chunks?.some((row) => row.chunkId === chunk.chunkId));
      return {
        evidenceId: parent?.evidenceId ?? ids[0],
        chunkId: chunk.chunkId,
        label: `${parent?.filename ?? parent?.title ?? "Evidence"} · ${chunk.locator}`,
        excerpt: chunk.text.slice(0, 160),
      };
    }),
    actions:
      evidence.length === 0
        ? [
            {
              type: "SEARCH_EVIDENCE",
              title: "Evidence search",
              detail: "No evidence was attached.",
              evidenceIds: [],
            },
          ]
        : [
            ...evidence.map((item) => ({
              type: "READ_EVIDENCE",
              title: `Read ${item.title}`,
              detail: item.extraction === "text" ? "Used retrieved text" : "Used evidence metadata only",
              evidenceIds: [item.evidenceId],
              chunkIds: (item.chunks ?? []).map((chunk) => chunk.chunkId),
            })),
            {
              type: "ANALYZE_EVIDENCE",
              title: "Analyze attached evidence",
              detail: "Compared the retrieved sections for exceptions.",
              evidenceIds: ids,
              chunkIds: chunks.map((item) => item.chunkId),
            },
            {
              type: "CREATE_FINDING",
              title: "Create finding",
              detail: "Proposed an exception for human review.",
              evidenceIds: ids,
              chunkIds: chunks.map((item) => item.chunkId),
              findingTitle: "Exception proposed from retrieved evidence",
              findingSeverity: "high",
              findingDescription:
                "The retrieved evidence supports an exception that a person should accept, modify, or reject.",
            },
            {
              type: "REQUEST_HUMAN_REVIEW",
              title: "Request human review",
              detail: "AI proposals are not approved automatically.",
              evidenceIds: ids,
            },
          ],
  });

  return {
    provider: "mock",
    model: "veriaudit-mock",
    response: reply,
    usage: { promptTokens: 0, completionTokens: 0 },
    latencyMs: 12,
    requestId: "mock-request",
    status: "ok",
    mode: "mock",
  };
}
