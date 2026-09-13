/**
 * Frontend fetchers. Thin wrappers over the documented contract.
 * No ranking, no verification, no invented findings.
 */
import type {
  CatalogueResponse,
  ReconstructionPayload,
  RunPayload,
  SearchResponse,
  SimulationFeed,
} from "./payloads";

export async function getCatalogue(): Promise<CatalogueResponse> {
  return getJson("/api/audits");
}

export async function runAudit(scenario: string): Promise<RunPayload> {
  return postJson("/api/audits/run", { scenario });
}

export async function startSimulation(): Promise<SimulationFeed> {
  return postJson("/api/simulation/start", {});
}

export async function resetSimulation(): Promise<unknown> {
  return postJson("/api/simulation/reset", {});
}

export async function searchHistory(query: string): Promise<SearchResponse> {
  const q = new URLSearchParams({ q: query });
  return getJson(`/api/search?${q.toString()}`);
}

export async function reconstruct(
  auditId: string,
  evidence?: {
    receipts?: Record<string, unknown>;
    logState?: unknown;
    treeHead?: unknown;
  },
): Promise<ReconstructionPayload> {
  if (evidence?.receipts) {
    return postJson(`/api/audits/${encodeURIComponent(auditId)}/reconstruction`, evidence);
  }
  return getJson(`/api/audits/${encodeURIComponent(auditId)}/reconstruction`);
}

export interface CoolReceiptCheck {
  readonly status: string;
  readonly ok: boolean;
  readonly signerTrusted: boolean;
  readonly measurementMatches: boolean;
}

export async function verifyCoolReceipt(receipt: unknown): Promise<CoolReceiptCheck> {
  return postJson("/api/cool/verify", { receipt });
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status})`);
  }
  return body as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`);
  }
  return payload as T;
}
