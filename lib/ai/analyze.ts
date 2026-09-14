import { runGateway, type GatewayResult } from "./gateway";
import { contextBlock, type AiWorkspaceContext } from "./context";
import {
  corpusForPrompt,
  groundedActions,
  groundingOf,
  hasReadableEvidence,
  NO_EVIDENCE_ATTACHED,
  noEvidenceWork,
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
  readonly context?: AiWorkspaceContext;
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
  // Nothing readable attached is the only honest "I cannot answer" case.
  if (!hasReadableEvidence(input.evidence)) {
    return {
      work: noEvidenceWork(),
      failures: [],
      response: {
        provider: "mock",
        model: "veriaudit-grounding",
        response: NO_EVIDENCE_ATTACHED,
        usage: null,
        latencyMs: 0,
        requestId: null,
        status: "ok",
        mode: "mock",
      },
    };
  }

  // Retrieval ranks evidence. When no passage scores above the threshold the
  // model still sees the real corpus, so a broad question ("summarize this
  // audit") is answered instead of being refused for a retrieval miss.
  const ranked = retrieveForPrompt(input.prompt, input.evidence);
  const hits = ranked.length > 0 ? ranked : corpusForPrompt(input.evidence);
  const scoped = ranked.length > 0 ? "Highest scoring evidence" : "Full attached evidence corpus";

  const retrieved = input.evidence.filter((item) => hits.some((hit) => hit.evidenceId === item.evidenceId));
  const messages: AiChatMessage[] = [
    { role: "system", content: ANALYZE_SYSTEM_PROMPT },
    ...(input.prior ?? []).slice(-8),
    {
      role: "user",
      content: [
        contextBlock(
          input.context ?? (input.auditTitle ? { auditTitle: input.auditTitle } : undefined),
          input.evidence,
        ),
        `Question: ${input.prompt}`,
        `${scoped} (cite only these chunk IDs):`,
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
