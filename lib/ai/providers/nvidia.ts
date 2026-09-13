import { openaiCompatibleChat } from "../openaiCompatible";
import type { AiChatMessage, NormalizedAiResponse } from "../types";
import type { ProviderConfig } from "../config";

export function callNvidia(
  config: ProviderConfig,
  messages: readonly AiChatMessage[],
  timeoutMs: number,
): Promise<NormalizedAiResponse> {
  if (!config.apiKey) {
    return Promise.reject(new Error("missing key"));
  }
  return openaiCompatibleChat({
    provider: "nvidia",
    url: config.url,
    apiKey: config.apiKey,
    model: config.model,
    messages,
    timeoutMs,
  });
}
