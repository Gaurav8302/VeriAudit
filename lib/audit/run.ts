/**
 * Orchestration: run an audit and seal its canonical events.
 *
 *   audit action → VeriAudit event → canonical payload → CooL adapter
 *                → real receipt → stored reference → verification
 *
 * This is the ONLY file in `lib/audit/` that touches `lib/cool/`. The engine,
 * the scenarios, and the event manager stay free of cryptography, so they are
 * testable in isolation and a scenario author cannot accidentally couple audit
 * logic to the evidence plane.
 *
 * Sealing is best-effort by design: if `record()` throws, the audit still
 * completes with `cool: null` on every event and `sealing.error` set. An audit
 * that fails because its evidence plane was unreachable would be a worse
 * product than one that honestly reports "no cryptographic evidence"
 * (docs/DEMO_FLOW.md stage 3, failure handling).
 */
import { recordEvents } from "@/lib/cool/recorder";
import { verifyReceipt } from "@/lib/cool/verifier";
import type { CoolReference, IntegrityState } from "@/lib/cool/types";
import { runAudit } from "./engine";
import { buildEventChain, type AuditEvent, type EventChain } from "./events";
import type { AuditResult, AuditScenario } from "./types";

/** An event plus the CooL reference for it, if one was sealed. */
export interface SealedEvent extends AuditEvent {
  readonly cool: CoolReference | null;
}

export interface AuditRun {
  readonly result: AuditResult;
  readonly events: readonly SealedEvent[];
  /** The canonical representatives, in causal order — the sealed subset. */
  readonly canonicalEventIds: readonly string[];
  readonly rootEventId: string;
  readonly sealing: {
    readonly attempted: number;
    readonly sealed: number;
    readonly error: string | null;
    readonly treeHead: { logId: string; treeSize: number; rootHash: string } | null;
    readonly timings: { connectMs: number; recordMs: number; perEventMs: number } | null;
  };
  /** Updated ordered binding hashes. The caller persists this and sends it back. */
  readonly logState: readonly string[];
  /** `${executionId}:${eventId}` → the verbatim ~30 KB receipt envelope. */
  readonly receipts: ReadonlyMap<string, unknown>;
}

export interface RunOptions {
  /** Prior ordered binding hashes, so this execution extends one tree. */
  readonly logState?: unknown;
  /** Skip CooL entirely. Used by the engine-only tests, never by the API. */
  readonly seal?: boolean;
}

export async function runAndSeal<E>(
  scenario: AuditScenario<E>,
  options: RunOptions = {},
): Promise<AuditRun> {
  const result = runAudit(scenario);
  const chain = buildEventChain(scenario, result);

  if (options.seal === false) {
    return unsealed(result, chain, options.logState);
  }

  try {
    const sealed = await recordEvents(chain.canonical, options.logState ?? []);
    const referenceByEventId = new Map(
      sealed.recorded.map((r) => [r.eventId, r.reference] as const),
    );
    const receipts = new Map<string, unknown>(
      sealed.recorded.map((r) => [r.reference.receiptRef, r.receipt] as const),
    );

    return {
      result,
      events: chain.events.map((event) => ({
        ...event,
        cool: referenceByEventId.get(event.eventId) ?? null,
      })),
      canonicalEventIds: chain.canonical.map((e) => e.eventId),
      rootEventId: chain.rootEventId,
      sealing: {
        attempted: chain.canonical.length,
        sealed: sealed.recorded.length,
        error: null,
        treeHead: sealed.treeHead,
        timings: sealed.timings,
      },
      logState: sealed.logState,
      receipts,
    };
  } catch (error) {
    // The audit stands; only the evidence is missing, and we say so.
    return unsealed(result, chain, options.logState, describeError(error));
  }
}

function unsealed(
  result: AuditResult,
  chain: EventChain,
  logState: unknown,
  error: string | null = null,
): AuditRun {
  return {
    result,
    events: chain.events.map((event) => ({ ...event, cool: null })),
    canonicalEventIds: chain.canonical.map((e) => e.eventId),
    rootEventId: chain.rootEventId,
    sealing: {
      attempted: error === null ? 0 : chain.canonical.length,
      sealed: 0,
      error,
      treeHead: null,
      timings: null,
    },
    logState: Array.isArray(logState) ? (logState as string[]) : [],
    receipts: new Map(),
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Verify every receipt in a run under the Milestone 1 production policy.
 *
 * Unchanged rules: the SDK verdict, a signer in the published allow-list, a
 * measurement equal to the pin, and `inclusion === "pass"`.
 */
export async function verifyRun(
  run: AuditRun,
): Promise<{
  results: { eventId: string; receiptRef: string; state: IntegrityState }[];
  verified: number;
  failed: number;
}> {
  const results: { eventId: string; receiptRef: string; state: IntegrityState }[] = [];

  for (const event of run.events) {
    if (!event.cool) continue;
    const receipt = run.receipts.get(event.cool.receiptRef);
    if (receipt === undefined) continue;
    results.push({
      eventId: event.eventId,
      receiptRef: event.cool.receiptRef,
      state: await verifyReceipt(receipt),
    });
  }

  return {
    results,
    verified: results.filter((r) => r.state.ok).length,
    failed: results.filter((r) => !r.state.ok).length,
  };
}
