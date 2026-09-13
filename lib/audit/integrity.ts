/**
 * Execution-trail integrity.
 *
 * Receipt verification is unchanged from Milestone 1: SDK verdict, signer
 * allow-list, measurement pin, `inclusion === "pass"`. This module adds the
 * checks that make those receipts a *trail* rather than nine unrelated proofs:
 *
 *   1. each receipt still verifies under PRODUCTION_POLICY
 *   2. each receipt is bound to the event it claims to evidence
 *      (`bindingHash` matches the leaf at `leafIndex` in `logState`)
 *   3. the RFC 6962 tree rehydrates from the public hashes alone, and the
 *      rebuilt root equals the captured tree head
 *
 * (2) is why swapping two genuine receipts is a failure even though each
 * receipt verifies in isolation. CooL attests authenticity; the tree attests
 * position. Both are required.
 *
 * This is the only Milestone 3 file that touches `lib/cool/`.
 */
import { contentDigest } from "@/lib/cool/canonical";
import { LOG_ID } from "@/lib/cool/config";
import { sealedKeys } from "@/lib/cool/identity";
import {
  assertValidLogState,
  proveAppendOnly,
  rehydrate,
  type LogState,
} from "@/lib/cool/log-state";
import { verifyReceipt } from "@/lib/cool/verifier";
import type { IntegrityState } from "@/lib/cool/types";
import type { AuditRun, SealedEvent } from "./run";
import { ExecutionTrail, type ExecutionSnapshot } from "./trail";

export interface TreeFingerprint {
  readonly logId: string;
  readonly treeSize: number;
  readonly rootHash: string;
}

export interface BoundReceipt {
  readonly eventId: string;
  readonly receiptRef: string;
  readonly state: IntegrityState;
  /** The receipt is authentic AND sits at the leaf the event claims. */
  readonly bound: boolean;
  readonly bindFailures: readonly string[];
}

export interface TrailIntegrity {
  readonly snapshot: ExecutionSnapshot;
  readonly receipts: readonly BoundReceipt[];
  readonly tree: {
    readonly captured: TreeFingerprint | null;
    readonly rehydrated: TreeFingerprint | null;
    readonly rootsMatch: boolean;
    readonly appendOnly: { readonly ok: boolean; readonly reason: string | null } | null;
  };
  readonly status: "verified" | "failed" | "unavailable" | "not-recorded";
  readonly verified: number;
  readonly failed: number;
  readonly checkedAt: string;
}

/**
 * Rebuild the RFC 6962 tree from public binding hashes alone.
 *
 * The live `MemoryLog` is discarded after the root is read. That is the
 * serverless claim: nothing has to stay in process memory between calls.
 */
export async function fingerprintLogState(logState: unknown): Promise<TreeFingerprint> {
  const state = assertValidLogState(logState);
  const keys = await sealedKeys();
  const log = rehydrate(keys.log, state);
  return {
    logId: LOG_ID,
    treeSize: state.length,
    rootHash: log.rootHash(),
  };
}

/**
 * Prove a later state is an honest extension of an earlier captured head.
 *
 * Used after rehydration + a continued append. A deleted, reordered, or
 * substituted historical leaf fails here — that is RFC 6962, not application
 * code inventing a failure.
 */
export async function proveTrailContinues(
  previous: { treeSize: number; rootHash: string },
  currentLogState: unknown,
): Promise<{ ok: boolean; reason: string | null; current: TreeFingerprint }> {
  const state = assertValidLogState(currentLogState);
  const keys = await sealedKeys();
  const proof = proveAppendOnly(keys.log, previous, state);
  return {
    ok: proof.ok,
    reason: proof.reason,
    current: {
      logId: LOG_ID,
      treeSize: proof.currentTreeSize,
      rootHash: proof.currentRootHash,
    },
  };
}

export async function bindReceipt(
  event: SealedEvent,
  receipt: unknown,
  logState: LogState,
): Promise<BoundReceipt> {
  const state = await verifyReceipt(receipt);
  const failures: string[] = [];

  if (!event.cool) {
    failures.push("event carries no CooL reference");
  } else {
    const envelope = receipt as {
      binding_hash?: string;
      record?: { event?: { type?: string; execution_id?: string } };
    };
    if (envelope.binding_hash !== event.cool.bindingHash) {
      failures.push("receipt binding_hash does not match the event's reference");
    }
    if (event.cool.leafIndex === null || logState[event.cool.leafIndex] !== event.cool.bindingHash) {
      failures.push("event bindingHash is not the leaf at the claimed leafIndex");
    }
    if (envelope.record?.event?.execution_id !== event.executionId) {
      failures.push("receipt execution_id does not match the event");
    }
    if (envelope.record?.event?.type !== event.type) {
      failures.push("receipt event type does not match the event");
    }
    // The salt-free digest is reproducible. If the event was rewritten after
    // sealing, this is the check that notices — binding_hash would still
    // verify if the attacker also kept the original receipt.
    // An empty digest means the caller re-attached a receipt without the
    // original CoolReference (GET-then-POST). Skip rather than invent a pass.
    if (event.cool.contentDigest && event.cool.contentDigest !== contentDigest(event)) {
      failures.push("event content no longer matches the digest committed at seal time");
    }
  }

  return {
    eventId: event.eventId,
    receiptRef: event.cool?.receiptRef ?? "",
    state,
    bound: failures.length === 0 && state.ok,
    bindFailures: failures,
  };
}

export async function verifyTrail(run: AuditRun): Promise<TrailIntegrity> {
  const trail = ExecutionTrail.fromRun(run);
  const checkedAt = new Date().toISOString();
  const sealed = trail.events.filter((e) => e.cool !== null);

  if (sealed.length === 0) {
    return {
      snapshot: trail.snapshot({ status: "not-recorded", verifiedAt: null }),
      receipts: [],
      tree: { captured: null, rehydrated: null, rootsMatch: false, appendOnly: null },
      status: "not-recorded",
      verified: 0,
      failed: 0,
      checkedAt,
    };
  }

  const logState = assertValidLogState([...run.logState]);
  const receipts: BoundReceipt[] = [];

  for (const event of sealed) {
    const evidence = event.cool ? run.receipts.get(event.cool.receiptRef) : undefined;
    if (evidence === undefined) {
      receipts.push({
        eventId: event.eventId,
        receiptRef: event.cool?.receiptRef ?? "",
        state: await verifyReceipt(null),
        bound: false,
        bindFailures: ["receipt is not in this session's store"],
      });
      continue;
    }
    receipts.push(await bindReceipt(event, evidence, logState));
  }

  const captured = run.sealing.treeHead
    ? {
        logId: run.sealing.treeHead.logId,
        treeSize: run.sealing.treeHead.treeSize,
        rootHash: run.sealing.treeHead.rootHash,
      }
    : null;

  const rehydrated = await fingerprintLogState(logState);
  const rootsMatch = captured !== null && captured.rootHash === rehydrated.rootHash;

  const verified = receipts.filter((r) => r.bound).length;
  const failed = receipts.length - verified;
  const status: TrailIntegrity["status"] =
    failed === 0 && rootsMatch ? "verified" : "failed";

  return {
    snapshot: trail.snapshot({ status, verifiedAt: checkedAt }),
    receipts,
    tree: {
      captured,
      rehydrated,
      rootsMatch,
      appendOnly: captured
        ? { ok: rootsMatch, reason: rootsMatch ? null : "rehydrated root does not match the captured tree head" }
        : null,
    },
    status,
    verified,
    failed,
    checkedAt,
  };
}
