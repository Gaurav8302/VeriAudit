import { describe, expect, it } from "vitest";
import { ProviderError } from "@/lib/ai/errors";
import { runGateway } from "@/lib/ai/gateway";
import { ingestFile } from "@/lib/ai/ingest";
import { completeStructuredWork, parseAiWork } from "@/lib/ai/parseActions";
import { mockAnalyze } from "@/lib/ai/providers/mock";
import { ALL_PROVIDERS_FAILED, type NormalizedAiResponse } from "@/lib/ai/types";
import type { ProviderConfig } from "@/lib/ai/config";

const request = {
  messages: [{ role: "user" as const, content: "Check the revenue transactions against the policy." }],
  evidence: [
    {
      evidenceId: "ART-LOCAL-001",
      title: "Q3 General Ledger",
      kind: "Ledger",
      filename: "q3-general-ledger.csv",
      extraction: "text" as const,
      textExcerpt: "JE-4401,1420000,not_delivered",
    },
  ],
};

function ok(provider: "openrouter" | "groq" | "nvidia"): NormalizedAiResponse {
  return {
    provider,
    model: `${provider}-model`,
    response: '{"reply":"ok","actions":[]}',
    usage: { promptTokens: 1, completionTokens: 1 },
    latencyMs: 4,
    requestId: `${provider}-1`,
    status: "ok",
    mode: "live",
  };
}

const chain: ProviderConfig[] = [
  { name: "openrouter", apiKey: "x", model: "m1", url: "https://example.test/a" },
  { name: "groq", apiKey: "x", model: "m2", url: "https://example.test/b" },
  { name: "nvidia", apiKey: "x", model: "m3", url: "https://example.test/c" },
];

describe("AI gateway", () => {
  it("normalizes a mock response", () => {
    const response = mockAnalyze(request);
    expect(response.provider).toBe("mock");
    expect(response.mode).toBe("mock");
    expect(response.status).toBe("ok");
    const work = parseAiWork(response.response);
    expect(work.actions.some((item) => item.type === "READ_EVIDENCE")).toBe(true);
    expect(work.actions.some((item) => item.type === "CREATE_FINDING")).toBe(true);
  });

  it("returns the first successful provider", async () => {
    const result = await runGateway(request, {
      mode: "live",
      chain,
      invoke: async (config) => ok(config.name),
    });
    expect(result.response.provider).toBe("openrouter");
    expect(result.failures).toEqual([]);
  });

  it("falls back when the first provider fails", async () => {
    const result = await runGateway(request, {
      mode: "live",
      chain,
      invoke: async (config) => {
        if (config.name === "openrouter") {
          throw new ProviderError({
            provider: "openrouter",
            model: "m1",
            reason: "timeout",
            message: "Timed out",
          });
        }
        return ok(config.name);
      },
    });
    expect(result.response.provider).toBe("groq");
    expect(result.failures.map((item) => item.provider)).toEqual(["openrouter"]);
  });

  it("falls through OpenRouter and Groq to NVIDIA", async () => {
    const result = await runGateway(request, {
      mode: "live",
      chain,
      invoke: async (config) => {
        if (config.name !== "nvidia") {
          throw new ProviderError({
            provider: config.name,
            model: config.model,
            reason: "unavailable",
            message: "down",
          });
        }
        return ok("nvidia");
      },
    });
    expect(result.response.provider).toBe("nvidia");
    expect(result.failures).toHaveLength(2);
  });

  it("returns one clean error when every provider fails", async () => {
    const result = await runGateway(request, {
      mode: "live",
      chain,
      invoke: async (config) => {
        throw new ProviderError({
          provider: config.name,
          model: config.model,
          reason: "network",
          message: "down",
        });
      },
    });
    expect(result.response.status).toBe("unavailable");
    expect(result.response.response).toBe(ALL_PROVIDERS_FAILED);
    expect(result.failures).toHaveLength(3);
  });

  it("records reads and a review finding when the model omitted them", () => {
    const work = completeStructuredWork(
      {
        reply: "I found entries that need human review.",
        actions: [
          {
            type: "REQUEST_HUMAN_REVIEW",
            title: "Review Revenue Transactions",
            detail: "exceptions",
            evidenceIds: ["ART-LOCAL-001"],
          },
        ],
      },
      request.evidence,
    );
    expect(work.actions.some((item) => item.type === "READ_EVIDENCE")).toBe(true);
    expect(work.actions.some((item) => item.type === "CREATE_FINDING")).toBe(true);
  });

  it("fingerprints uploads without inventing PDF text", () => {
    const text = ingestFile({
      name: "ledger.csv",
      type: "text/csv",
      bytes: new TextEncoder().encode("entry,amount\n1,10"),
    });
    expect(text.extraction).toBe("text");
    expect(text.fingerprint).toHaveLength(64);
    const pdf = ingestFile({
      name: "policy.pdf",
      type: "application/pdf",
      bytes: new Uint8Array([37, 80, 68, 70, 45, 49]),
    });
    expect(pdf.extraction).toBe("unavailable");
    expect(pdf.textExcerpt).toBeNull();
  });
});
