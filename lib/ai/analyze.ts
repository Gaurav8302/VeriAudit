import { runGateway, type GatewayResult } from "./gateway";
import { completeStructuredWork, parseAiWork } from "./parseActions";
import { ANALYZE_SYSTEM_PROMPT } from "./systemPrompt";
import type { AiChatMessage, AiEvidenceContext, ParsedAiWork } from "./types";

export interface AnalyzeInput {
  readonly prompt: string;
  readonly prior?: readonly AiChatMessage[];
  readonly evidence: readonly AiEvidenceContext[];
}

export interface AnalyzeOutput extends GatewayResult {
  readonly work: ParsedAiWork;
}

function evidenceBlock(evidence: readonly AiEvidenceContext[]): string {
  if (evidence.length === 0) return "No evidence is attached to this execution.";
  return evidence
    .map((item) => {
      const body =
        item.extraction === "text" && item.textExcerpt
          ? item.textExcerpt
          : item.extraction === "unavailable"
            ? "Text extraction is not implemented for this file type. Metadata only."
            : "Metadata only. No file text.";
      return `- ${item.evidenceId} | ${item.title} | ${item.kind} | ${item.filename ?? "no file"}\n${body}`;
    })
    .join("\n\n");
}

export async function analyzeExecution(
  input: AnalyzeInput,
  gateway = runGateway,
): Promise<AnalyzeOutput> {
  const messages: AiChatMessage[] = [
    { role: "system", content: ANALYZE_SYSTEM_PROMPT },
    ...(input.prior ?? []).slice(-8),
    {
      role: "user",
      content: `${input.prompt}\n\nEvidence on this execution:\n${evidenceBlock(input.evidence)}`,
    },
  ];
  const result = await gateway({ messages, evidence: input.evidence });
  const work =
    result.response.status === "ok"
      ? completeStructuredWork(parseAiWork(result.response.response), input.evidence)
      : { reply: result.response.response, actions: [] };
  return { ...result, work };
}
