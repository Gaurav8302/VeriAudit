import { INSUFFICIENT_EVIDENCE } from "@/lib/evidence";
import { runGateway, type GatewayResult } from "./gateway";
import {
  groundedActions,
  groundingOf,
  insufficientWork,
  referencesFrom,
  retrieveForPrompt,
  validateReferences,
} from "./ground";
import { completeStructuredWork, parseAiWork } from "./parseActions";
import { ANALYZE_SYSTEM_PROMPT } from "./systemPrompt";
import type { AiChatMessage, AiEvidenceContext, ParsedAiWork } from "./types";

export interface AnalyzeInput {
  readonly prompt: string;
  readonly prior?: readonly AiChatMessage[];
  readonly evidence: readonly AiEvidenceContext[];
  readonly auditTitle?: string;
  readonly executionId?: string;
}

export interface AnalyzeOutput extends GatewayResult {
  readonly work: ParsedAiWork;
}

function chunkBlock(hits: ReturnType<typeof retrieveForPrompt>): string {
  return hits
    .map(
      (item) =>
        `- ${item.evidenceId} | ${item.chunkId} | ${item.filename ?? item.title} | ${item.locator}\n${item.text}`,
    )
    .join("\n\n");
}

export async function analyzeExecution(
  input: AnalyzeInput,
  gateway = runGateway,
): Promise<AnalyzeOutput> {
  const hits = retrieveForPrompt(input.prompt, input.evidence);
  if (hits.length === 0) {
    const work = insufficientWork();
    return {
      work,
      failures: [],
      response: {
        provider: "mock",
        model: "veriaudit-grounding",
        response: INSUFFICIENT_EVIDENCE,
        usage: null,
        latencyMs: 0,
        requestId: null,
        status: "ok",
        mode: "mock",
      },
    };
  }

  const retrieved = input.evidence.filter((item) => hits.some((hit) => hit.evidenceId === item.evidenceId));
  const messages: AiChatMessage[] = [
    { role: "system", content: ANALYZE_SYSTEM_PROMPT },
    ...(input.prior ?? []).slice(-8),
    {
      role: "user",
      content: [
        input.auditTitle ? `Audit: ${input.auditTitle}` : null,
        input.executionId ? `Execution: ${input.executionId}` : null,
        `Question: ${input.prompt}`,
        "Relevant evidence chunks (cite only these IDs):",
        chunkBlock(hits),
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const result = await gateway({
    messages,
    evidence: retrieved.map((item) => ({
      ...item,
      textExcerpt: hits
        .filter((hit) => hit.evidenceId === item.evidenceId)
        .map((hit) => hit.text)
        .join("\n"),
      chunks: hits
        .filter((hit) => hit.evidenceId === item.evidenceId)
        .map((hit) => ({
          chunkId: hit.chunkId,
          text: hit.text,
          locator: hit.locator,
          section: hit.section,
          page: hit.page,
          row: hit.row,
        })),
    })),
  });

  if (result.response.status !== "ok") {
    return {
      ...result,
      work: {
        reply: result.response.response,
        actions: [],
        confidence: "none",
        grounding: "insufficient",
        evidenceReferences: [],
        suggestedFindings: [],
      },
    };
  }

  const parsed = parseAiWork(result.response.response);
  const refs = validateReferences(parsed.evidenceReferences ?? [], hits);
  const groundedRefs = refs.length ? refs : referencesFrom(hits);
  const actions = completeStructuredWork(
    {
      ...parsed,
      actions: groundedActions(parsed, hits, input.prompt),
      evidenceReferences: groundedRefs,
    },
    retrieved,
  ).actions;
  const work: ParsedAiWork = {
    ...parsed,
    actions,
    evidenceReferences: groundedRefs,
    grounding: groundingOf(groundedRefs),
    confidence: parsed.confidence ?? (groundedRefs.length >= 2 ? "medium" : "low"),
  };
  return { ...result, work };
}
