import { aiMode, aiTimeoutMs, providerChain, type ProviderConfig } from "./config";
import { ProviderError } from "./errors";
import { mockAnalyze } from "./providers/mock";
import { callGroq } from "./providers/groq";
import { callNvidia } from "./providers/nvidia";
import { callOpenRouter } from "./providers/openrouter";
import {
  ALL_PROVIDERS_FAILED,
  type AiChatRequest,
  type NormalizedAiResponse,
  type ProviderFailure,
} from "./types";

export interface GatewayResult {
  readonly response: NormalizedAiResponse;
  readonly failures: readonly ProviderFailure[];
}

function dispatch(config: ProviderConfig, request: AiChatRequest, timeoutMs: number) {
  const messages = request.messages;
  if (config.name === "openrouter") return callOpenRouter(config, messages, timeoutMs);
  if (config.name === "groq") return callGroq(config, messages, timeoutMs);
  return callNvidia(config, messages, timeoutMs);
}

export async function runGateway(
  request: AiChatRequest,
  options?: {
    mode?: "live" | "mock";
    chain?: ProviderConfig[];
    timeoutMs?: number;
    invoke?: (config: ProviderConfig, request: AiChatRequest) => Promise<NormalizedAiResponse>;
  },
): Promise<GatewayResult> {
  const mode = options?.mode ?? aiMode();
  if (mode === "mock") {
    return { response: mockAnalyze(request), failures: [] };
  }

  const timeoutMs = options?.timeoutMs ?? aiTimeoutMs();
  const chain = (options?.chain ?? providerChain()).filter((item) => item.apiKey);
  const invoke = options?.invoke ?? ((config, next) => dispatch(config, next, timeoutMs));
  const failures: ProviderFailure[] = [];

  for (const config of chain) {
    try {
      const response = await invoke(config, request);
      if (response.status === "ok") {
        return { response, failures };
      }
      failures.push({
        provider: config.name,
        model: config.model,
        reason: "error",
        message: "Provider returned unavailable",
      });
    } catch (error) {
      if (error instanceof ProviderError) {
        failures.push(error.failure);
      } else {
        failures.push({
          provider: config.name,
          model: config.model,
          reason: "error",
          message: "Provider failed",
        });
      }
    }
  }

  return {
    failures,
    response: {
      provider: "mock",
      model: "none",
      response: ALL_PROVIDERS_FAILED,
      usage: null,
      latencyMs: 0,
      requestId: null,
      status: "unavailable",
      mode: "live",
    },
  };
}
