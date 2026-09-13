import type { AiChatRequest, NormalizedAiResponse } from "../types";

export function mockAnalyze(request: AiChatRequest): NormalizedAiResponse {
  const last = [...request.messages].reverse().find((item) => item.role === "user")?.content ?? "";
  const evidence = request.evidence;
  const reply = JSON.stringify({
    reply:
      evidence.length === 0
        ? "I need evidence attached to this execution before I can check transactions against a policy."
        : "I found transactions that need human review against the attached policy. This is mock analysis, not a live provider.",
    actions:
      evidence.length === 0
        ? [
            {
              type: "REQUEST_HUMAN_REVIEW",
              title: "Attach evidence",
              detail: "Upload or add sample evidence before analysis.",
              evidenceIds: [],
            },
          ]
        : [
            ...evidence.map((item) => ({
              type: "READ_EVIDENCE",
              title: `Read ${item.title}`,
              detail: item.extraction === "text" ? "Used extracted text" : "Used evidence metadata only",
              evidenceIds: [item.evidenceId],
            })),
            {
              type: "COMPARE_EVIDENCE",
              title: "Compared transactions against policy",
              detail: last,
              evidenceIds: evidence.map((item) => item.evidenceId),
            },
            {
              type: "ANALYZE_EVIDENCE",
              title: "revenue-recognition-check",
              detail: "Looked for recognition timing and approval exceptions.",
              evidenceIds: evidence.map((item) => item.evidenceId),
            },
            {
              type: "CREATE_FINDING",
              title: "Create finding",
              detail: "Proposed an exception for human review.",
              evidenceIds: evidence.map((item) => item.evidenceId),
              findingTitle: "Revenue recognition exception",
              findingSeverity: "high",
              findingDescription:
                "Transactions appear to need review against the attached revenue policy. A person should accept, modify, or reject this proposal.",
            },
            {
              type: "REQUEST_HUMAN_REVIEW",
              title: "Request human review",
              detail: "AI proposals are not approved automatically.",
              evidenceIds: evidence.map((item) => item.evidenceId),
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
