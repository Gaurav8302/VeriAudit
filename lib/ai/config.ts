import type { AiMode, AiProviderName } from "./types";

export interface ProviderConfig {
  readonly name: Exclude<AiProviderName, "mock">;
  readonly apiKey: string | null;
  readonly model: string;
  readonly url: string;
}

export function aiMode(): AiMode {
  return process.env.AI_MODE === "live" ? "live" : "mock";
}

export function aiTimeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 12_000;
}

export function providerChain(): ProviderConfig[] {
  return [
    {
      name: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY?.trim() || null,
      model: process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini",
      url: "https://openrouter.ai/api/v1/chat/completions",
    },
    {
      name: "groq",
      apiKey: process.env.GROQ_API_KEY?.trim() || null,
      model: process.env.GROQ_MODEL?.trim() || "qwen/qwen3.8-27b",
      url: "https://api.groq.com/openai/v1/chat/completions",
    },
    {
      name: "nvidia",
      apiKey: process.env.NVIDIA_API_KEY?.trim() || null,
      model: process.env.NVIDIA_MODEL?.trim() || "mistralai/mistral-7b-instruct-v0.3",
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
    },
  ];
}
