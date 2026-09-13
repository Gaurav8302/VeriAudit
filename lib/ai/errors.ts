import type { AiProviderName, ProviderFailure } from "./types";

export class ProviderError extends Error {
  readonly failure: ProviderFailure;

  constructor(failure: ProviderFailure) {
    super(failure.message);
    this.name = "ProviderError";
    this.failure = failure;
  }
}

export function classifyHttp(status: number, provider: AiProviderName, model: string): ProviderError {
  if (status === 429) {
    return new ProviderError({ provider, model, reason: "rate_limit", message: "Rate limited" });
  }
  if (status === 404) {
    return new ProviderError({ provider, model, reason: "unavailable", message: "Model unavailable" });
  }
  if (status >= 500) {
    return new ProviderError({ provider, model, reason: "unavailable", message: "Provider unavailable" });
  }
  return new ProviderError({ provider, model, reason: "error", message: `Provider error ${status}` });
}
