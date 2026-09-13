/**
 * Recording: canonical VeriAudit event → real CooL receipt.
 *
 *   recordEvents(events, logState)
 *        ↓ canonicalEventPayload      (deterministic projection)
 *        ↓ CoolTee.record             (cool-nwc@3.0.0, salted-hashed + signed)
 *        ↓ receipt + compact reference + updated log state
 *
 * This is the only module that calls into the SDK's recording path.
 */
import { CoolTee } from "cool-nwc/phala";
import type { ReceiptV2 } from "cool-nwc";
import { canonicalEventPayload, contentDigest } from "./canonical";
import { APP_ID, IMAGE_DIGEST, SOFTWARE_NAME, SOFTWARE_VERSION } from "./config";
import { assertIdentityMatchesPin, newDstackClient, sealedKeys } from "./identity";
import {
  asMultihash,
  assertValidLogState,
  rehydrate,
  type BindingHash,
  type LogState,
} from "./log-state";
import type { CoolReference, RecordedEvent, VeriAuditEvent } from "./types";

/**
 * The software identity stamped into every record, in cleartext.
 *
 * `digest: null` is EXPLICIT and must stay that way.
 *
 * CONFIRMED (docs/COOL_SDK_AUDIT.md §7.1): passing `{ name, version }` without
 * a `digest` key produces a receipt that FAILS verification with
 * `record.event.software.digest: expected a non-empty string`. The SDK's
 * `phala/engine.ts` stores the object verbatim without normalising `digest`,
 * and its structural validator then treats `undefined` as "present but not a
 * multihash" because it only special-cases `null`. Omitting `software` entirely
 * also works, but then the record carries no software identity — which is
 * exactly the provenance we want. So: always set `digest` explicitly.
 *
 * Do not "simplify" this by deleting the null. A test (C4) guards it.
 */
const SOFTWARE = {
  name: SOFTWARE_NAME,
  version: SOFTWARE_VERSION,
  digest: null,
} as const;

function referenceFor(
  event: VeriAuditEvent,
  receipt: ReceiptV2,
  recordId: string,
  bindingHash: string,
): CoolReference {
  return {
    recordId,
    bindingHash,
    keyId: receipt.record.signature.key_id,
    signatureAlg: receipt.record.signature.alg,
    issuedAt: receipt.record.time.issued_at,
    runtimeMode: receipt.record.runtime.mode,
    leafIndex: receipt.inclusion?.leaf_index ?? null,
    treeSize: receipt.inclusion?.tree_size ?? null,
    logId: receipt.sth?.log_id ?? null,
    receiptRef: `${event.executionId}:${event.eventId}`,
    contentDigest: contentDigest(event),
  };
}

export interface RecordResult {
  readonly recorded: readonly RecordedEvent[];
  /** The updated ordered binding hashes. Persist this and send it back. */
  readonly logState: LogState;
  readonly treeHead: { logId: string; treeSize: number; rootHash: string } | null;
  readonly timings: { connectMs: number; recordMs: number; perEventMs: number };
}

/**
 * Seal a batch of events into one append-only tree, in the order given.
 *
 * The batch shares a plane so the tree grows within the call; `logState` carries
 * it across calls. Events must already be in causal order — the recorder does
 * not reorder them, because leaf order is part of what the log attests.
 */
export async function recordEvents(
  events: readonly VeriAuditEvent[],
  priorLogState: unknown = [],
): Promise<RecordResult> {
  if (events.length === 0) {
    throw new TypeError("recordEvents requires at least one event");
  }

  const state = assertValidLogState(priorLogState);

  // Refuse to seal under an identity nobody pinned. Memoised, so this costs
  // nothing after the first call on a warm instance.
  await assertIdentityMatchesPin();

  const connectStart = performance.now();

  const dstack = newDstackClient();
  const keys = await sealedKeys();
  const log = rehydrate(keys.log, state);

  const tee = await CoolTee.connect({
    app: { name: APP_ID, imageDigest: IMAGE_DIGEST },
    dstack,
    log,
  });
  const connectMs = performance.now() - connectStart;

  const recordStart = performance.now();
  const recorded: RecordedEvent[] = [];
  const bindingHashes: BindingHash[] = [...state];

  try {
    for (const event of events) {
      const payload = canonicalEventPayload(event);

      const receipt = await tee.record({
        // Cleartext in the receipt: the event vocabulary and the trail id.
        type: event.type,
        // ALWAYS explicit. Without it the SDK mints a fresh ULID per record and
        // the events cannot be grouped into a trail.
        executionId: event.executionId,
        // Committed as a salted hash and discarded. Not recoverable.
        metadata: payload,
        payloads: {
          input: event.inputPayload,
          output: event.outputPayload,
          state: undefined,
        },
        software: SOFTWARE,
      });

      const bindingHash = asMultihash(receipt.binding_hash, "receipt.binding_hash");
      bindingHashes.push(bindingHash);
      recorded.push({
        eventId: event.eventId,
        reference: referenceFor(event, receipt, receipt.record.record_id, bindingHash),
        receipt,
      });
    }
  } finally {
    await tee.close();
  }

  const recordMs = performance.now() - recordStart;
  const last = recorded[recorded.length - 1]?.receipt as ReceiptV2 | undefined;
  const sth = last?.sth ?? null;

  return {
    recorded,
    logState: bindingHashes,
    treeHead: sth
      ? { logId: sth.log_id, treeSize: sth.tree_size, rootHash: sth.root_hash }
      : null,
    timings: {
      connectMs: Math.round(connectMs * 10) / 10,
      recordMs: Math.round(recordMs * 10) / 10,
      perEventMs: Math.round((recordMs / events.length) * 10) / 10,
    },
  };
}

/** Seal a single event. Convenience wrapper over {@link recordEvents}. */
export async function recordEvent(
  event: VeriAuditEvent,
  priorLogState: unknown = [],
): Promise<RecordResult> {
  return recordEvents([event], priorLogState);
}
