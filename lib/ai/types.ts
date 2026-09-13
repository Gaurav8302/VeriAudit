export type AiProviderName = "openrouter" | "groq" | "nvidia" | "mock";
export type AiMode = "live" | "mock";
export type AiResponseStatus = "ok" | "unavailable";

export type AiActionType =
  | "SEARCH_EVIDENCE"
  | "READ_EVIDENCE"
  | "ANALYZE_EVIDENCE"
  | "COMPARE_EVIDENCE"
  | "CREATE_FINDING"
  | "UPDATE_FINDING"
  | "SUMMARIZE"
  | "REQUEST_HUMAN_REVIEW";

export type ActionLife = "started" | "completed" | "failed";

export interface AiChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface AiEvidenceChunk {
  readonly chunkId: string;
  readonly text: string;
  readonly locator: string;
  readonly section: string | null;
  readonly page: number | null;
  readonly row: number | null;
}

export interface AiEvidenceContext {
  readonly evidenceId: string;
  readonly title: string;
  readonly kind: string;
  readonly filename: string | null;
  readonly extraction: "text" | "unavailable" | "none";
  readonly textExcerpt: string | null;
  readonly chunks?: readonly AiEvidenceChunk[];
}

export interface AiChatRequest {
  readonly messages: readonly AiChatMessage[];
  readonly evidence: readonly AiEvidenceContext[];
}

export interface TokenUsage {
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
}

export interface NormalizedAiResponse {
  readonly provider: AiProviderName;
  readonly model: string;
  readonly response: string;
  readonly usage: TokenUsage | null;
  readonly latencyMs: number;
  readonly requestId: string | null;
  readonly status: AiResponseStatus;
  readonly mode: AiMode;
}

export interface ProposedAction {
  readonly type: AiActionType;
  readonly title: string;
  readonly detail: string;
  readonly evidenceIds: readonly string[];
  readonly chunkIds?: readonly string[];
  readonly findingTitle?: string;
  readonly findingSeverity?: "low" | "medium" | "high" | "critical";
  readonly findingDescription?: string;
}

export interface ParsedAiWork {
  readonly reply: string;
  readonly actions: readonly ProposedAction[];
  readonly confidence?: "high" | "medium" | "low" | "none";
  readonly grounding?: "evidence-backed" | "insufficient";
  readonly evidenceReferences?: readonly {
    evidenceId: string;
    chunkId: string;
    label: string;
    excerpt: string;
  }[];
  readonly suggestedFindings?: readonly {
    title: string;
    severity?: "low" | "medium" | "high" | "critical";
    description: string;
    evidenceIds: readonly string[];
    chunkIds?: readonly string[];
  }[];
}

export interface ProviderFailure {
  readonly provider: AiProviderName;
  readonly model: string;
  readonly reason: "timeout" | "rate_limit" | "unavailable" | "error" | "network";
  readonly message: string;
}

export const ALL_PROVIDERS_FAILED =
  "AI analysis is temporarily unavailable. Your audit workspace and existing records are safe.";
