/**
 * The shared append-only transparency tree.
 *
 * The problem this solves, in the SDK's own words (`phala/log.ts`): "every
 * process starts a fresh tree, so a hundred records become a hundred trees of
 * size one … which is most of what a transparency log is for."
 *
 * The fix, CONFIRMED in docs/COOL_SDK_AUDIT.md §7.3: a tree rehydrates from
 * nothing but the ORDERED list of public `binding_hash` strings. Replaying them
 * through `recordLeafDataV2` reproduces the previously signed root exactly, and
 * the next record continues at the next leaf index.
 *
 * So `LogState` is the entire persistence requirement for the log: ~80 bytes per
 * event, no secrets, safe to hand to a client and accept back.
 *
 * Hard constraint: `EvidenceLog.append()` is SYNCHRONOUS. A log backed by async
 * storage is impossible — the tree must be hydrated in memory before recording
 * and the updated state returned afterwards.
 */
import {
  MemoryLog,
  consistencyProof,
  leafHash,
  multihashDigest,
  verifyConsistency,
} from "cool-nwc";
import { recordLeafDataV2 } from "cool-nwc/phala";
import type { KeyPair } from "cool-nwc";
import { LOG_ID } from "./config";

/** The SDK's multihash shape. Narrow on purpose — see `asMultihash`. */
export type BindingHash = `mh:sha256:${string}`;

/** The ordered binding hashes of every record in the tree. Public values. */
export type LogState = readonly BindingHash[];

const MULTIHASH = /^mh:sha256:[0-9a-f]{64}$/;

/**
 * Narrow an untrusted string to the SDK's multihash type.
 *
 * Every value here arrives over HTTP or out of IndexedDB, so the template type
 * has to be earned by a real check rather than asserted.
 */
export function asMultihash(value: unknown, what = "value"): BindingHash {
  if (typeof value !== "string" || !MULTIHASH.test(value)) {
    throw new TypeError(`${what} is not a valid mh:sha256 multihash`);
  }
  return value as BindingHash;
}

/** Reject anything that is not a list of well-formed multihashes, in order. */
export function assertValidLogState(state: unknown): LogState {
  if (state === undefined || state === null) return [];
  if (!Array.isArray(state)) {
    throw new TypeError("logState must be an array of mh:sha256 binding hashes");
  }
  return state.map((entry, index) => asMultihash(entry, `logState[${index}]`));
}

/**
 * Rebuild the tree from stored state.
 *
 * Order matters: leaf N must be appended after leaf N-1 or every audit path and
 * root hash changes.
 */
export function rehydrate(logKey: KeyPair, state: LogState): MemoryLog {
  const log = new MemoryLog(LOG_ID, logKey);
  for (const bindingHash of state) {
    log.append(recordLeafDataV2(bindingHash));
  }
  return log;
}

/**
 * RFC 6962 leaf hashes for a state, for proofs computed outside a live log.
 * `consistencyProof` takes leaf HASHES, not leaf data.
 */
function leafHashes(state: LogState): Uint8Array[] {
  return state.map((bindingHash) => leafHash(recordLeafDataV2(bindingHash)));
}

/**
 * Prove that `current` is an append-only extension of a tree head captured
 * earlier — i.e. nothing was removed or reordered in between.
 *
 * CONFIRMED: true for honest growth, false for a forged old root, and false
 * after deleting a historical event.
 *
 * Note the argument order `(m, n, firstRoot, secondRoot, proof)` and that
 * `verifyConsistency` CAN throw, unlike `verifyEvidence`. A throw is treated as
 * a failure, never as a pass.
 */
export function proveAppendOnly(
  logKey: KeyPair,
  previous: { treeSize: number; rootHash: string },
  current: LogState,
): { ok: boolean; reason: string | null; currentTreeSize: number; currentRootHash: string } {
  const log = rehydrate(logKey, current);
  const currentRootHash = log.rootHash();

  if (previous.treeSize > current.length) {
    return {
      ok: false,
      reason: `the log shrank: it was ${previous.treeSize} entries and is now ${current.length}`,
      currentTreeSize: current.length,
      currentRootHash,
    };
  }

  try {
    const proof = consistencyProof(leafHashes(current), previous.treeSize);
    const ok = verifyConsistency(
      previous.treeSize,
      current.length,
      multihashDigest(asMultihash(previous.rootHash, "previous.rootHash")),
      multihashDigest(asMultihash(currentRootHash, "current root hash")),
      proof,
    );
    return {
      ok,
      reason: ok
        ? null
        : "the consistency proof does not hold: an earlier record was removed, reordered, or altered",
      currentTreeSize: current.length,
      currentRootHash,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `consistency proof could not be computed: ${(error as Error).message}`,
      currentTreeSize: current.length,
      currentRootHash,
    };
  }
}
