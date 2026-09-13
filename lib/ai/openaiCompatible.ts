import type { AiChatMessage, AiProviderName, NormalizedAiResponse } from "./types";
import { classifyHttp, ProviderError } from "./errors";

export async function openaiCompatibleChat(input: {
  provider: Exclude<AiProviderName, "mock">;
  url: string;
  apiKey: string;
  model: string;
  messages: readonly AiChatMessage[];
  timeoutMs: number;
  headers?: Record<string, string>;
}): Promise<NormalizedAiResponse> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        ...input.headers,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: 0.2,
      }),
    });
    if (!response.ok) {
      throw classifyHttp(response.status, input.provider, input.model);
    }
    const payload = (await response.json()) as {
      id?: string;
      choices?: { message?: { content?: string | null; reasoning?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = payload.choices?.[0]?.message;
    const text = (message?.content || message?.reasoning || "").trim();
    if (!text) {
      throw new ProviderError({
        provider: input.provider,
        model: input.model,
        reason: "error",
        message: "Empty model response",
      });
    }
    return {
      provider: input.provider,
      model: input.model,
      response: text,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? null,
        completionTokens: payload.usage?.completion_tokens ?? null,
      },
      latencyMs: Date.now() - started,
      requestId: payload.id ?? response.headers.get("x-request-id"),
      status: "ok",
      mode: "live",
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ProviderError({
      provider: input.provider,
      model: input.model,
      reason: aborted ? "timeout" : "network",
      message: aborted ? "Timed out" : "Network failure",
    });
  } finally {
    clearTimeout(timer);
  }
}
