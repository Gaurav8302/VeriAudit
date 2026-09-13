import { openaiCompatibleChat } from "../openaiCompatible";
import type { AiChatMessage, NormalizedAiResponse } from "../types";
import type { ProviderConfig } from "../config";

export function callOpenRouter(
  config: ProviderConfig,
  messages: readonly AiChatMessage[],
  timeoutMs: number,
): Promise<NormalizedAiResponse> {
  if (!config.apiKey) {
    return Promise.reject(new Error("missing key"));
  }
  return openaiCompatibleChat({
    provider: "openrouter",
    url: config.url,
    apiKey: config.apiKey,
    model: config.model,
    messages,
    timeoutMs,
    headers: {
      "HTTP-Referer": "https://veriaudit.app",
      "X-Title": "VeriAudit",
    },
  });
}
