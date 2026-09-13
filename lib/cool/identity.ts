/**
 * VeriAudit's evidence-plane identity: the pinned trust anchor, plus a runtime
 * derivation used to detect drift.
 *
 * Two sources, deliberately:
 *
 *   PINNED  — `identity.generated.ts`, committed. What verification checks
 *             against. It has to be committed rather than derived, or an
 *             attacker who can set COOL_IMAGE_DIGEST simply moves the pin and
 *             the check proves nothing.
 *   RUNTIME — derived from the live (APP_ID, IMAGE_DIGEST). Compared against
 *             the pin at startup so a misconfigured deployment fails loudly in
 *             development instead of silently in the demo.
 *
 * CONFIRMED (docs/COOL_SDK_AUDIT.md §7.3): keys and the measurement are a pure
 * function of (appName, imageDigest) — re-deriving yields byte-identical public
 * keys, which is what lets a stateless function fleet share one identity with
 * no key storage.
 */
import { SimulatedDstackClient, sealedKeyset } from "cool-nwc/phala";
import type { SealedKeyset } from "cool-nwc/phala";
import type { Measurement } from "cool-nwc";
import { APP_ID, IMAGE_DIGEST, LOG_ID } from "./config";
import {
  EXPECTED_MEASUREMENT,
  GENERATED_FOR,
  PUBLISHED_KEY_DIRECTORY,
  TRUSTED_LOG_KEY_IDS,
  TRUSTED_RECORD_KEY_IDS,
} from "./identity.generated";
import type { KeyDirectory } from "./key-directory";
import type { CoolIdentity } from "./types";

export {
  EXPECTED_MEASUREMENT,
  GENERATED_FOR,
  PUBLISHED_KEY_DIRECTORY,
  TRUSTED_LOG_KEY_IDS,
  TRUSTED_RECORD_KEY_IDS,
};

export const TRUSTED_RECORD_KEY_ID_SET: ReadonlySet<string> = new Set(TRUSTED_RECORD_KEY_IDS);

/** Measurement register names, in the order the SDK defines them. */
const REGISTERS = ["mrtd", "rtmr0", "rtmr1", "rtmr2", "rtmr3"] as const;

/** Compare two measurements field by field. Returns the differing registers. */
export function measurementDiff(a: Measurement, b: Measurement): string[] {
  return REGISTERS.filter((r) => a[r] !== b[r]);
}

export function measurementMatchesPin(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const m = candidate as Record<string, unknown>;
  return REGISTERS.every((r) => m[r] === EXPECTED_MEASUREMENT[r]);
}

/**
 * The sealed keyset for the live configuration.
 *
 * Cached in module scope: derivation costs two ML-DSA-65 keygens (~100 ms) and
 * is deterministic, so caching changes nothing but latency. On a warm Vercel
 * instance this is paid once.
 */
let keysetCache: { key: string; keys: Promise<SealedKeyset> } | null = null;

export function sealedKeys(): Promise<SealedKeyset> {
  const key = `${APP_ID}::${IMAGE_DIGEST}`;
  if (keysetCache?.key !== key) {
    keysetCache = { key, keys: sealedKeyset(newDstackClient()) };
  }
  return keysetCache.keys;
}

export function newDstackClient(): SimulatedDstackClient {
  return new SimulatedDstackClient({ appName: APP_ID, imageDigest: IMAGE_DIGEST });
}

/** Derive the live identity and report it. Used by the identity route and tests. */
export async function describeIdentity(): Promise<
  CoolIdentity & { pinned: { matches: boolean; differingRegisters: string[] } }
> {
  const client = newDstackClient();
  const [info, keys] = await Promise.all([client.info(), sealedKeys()]);
  const keyDirectory: KeyDirectory = {
    [keys.record.keyId]: keys.record.directoryEntry,
    [keys.log.keyId]: keys.log.directoryEntry,
    ...(client.directory() as KeyDirectory),
  };
  const differingRegisters = measurementDiff(info.measurement, EXPECTED_MEASUREMENT);

  return {
    applicationId: APP_ID,
    imageDigest: IMAGE_DIGEST,
    logId: LOG_ID,
    measurement: info.measurement as unknown as Record<string, string>,
    keyDirectory,
    trustedKeyIds: TRUSTED_RECORD_KEY_IDS,
    runtimeMode: info.mode,
    // CONFIRMED: always false in this build. No TEE is available, so the
    // attestation and enclave domains can never report `pass`.
    hardware: false,
    pinned: { matches: differingRegisters.length === 0, differingRegisters },
  };
}

/**
 * Fail loudly if the live configuration does not match the committed pin.
 *
 * The failure mode this prevents: `COOL_IMAGE_DIGEST` drifts, every receipt is
 * sealed under a key and measurement nobody pinned, and every verification
 * reports FAILED for a reason that looks like tampering.
 */
export async function assertIdentityMatchesPin(): Promise<void> {
  const identity = await describeIdentity();
  if (identity.pinned.matches && identity.trustedKeyIds.length > 0) {
    const signerKnown = TRUSTED_RECORD_KEY_ID_SET.has(
      Object.keys(identity.keyDirectory).find((id) => id.startsWith("cool-enclave-")) ?? "",
    );
    if (signerKnown) return;
  }
  throw new Error(
    [
      "CooL identity drift: the live plane does not match lib/cool/identity.generated.ts.",
      `  live    applicationId=${APP_ID} imageDigest=${IMAGE_DIGEST}`,
      `  pinned  applicationId=${GENERATED_FOR.applicationId} imageDigest=${GENERATED_FOR.imageDigest}`,
      identity.pinned.differingRegisters.length > 0
        ? `  differing registers: ${identity.pinned.differingRegisters.join(", ")}`
        : "  measurement matches, but the signing key id is not in the allow-list",
      "  Fix: set COOL_IMAGE_DIGEST to the pinned value, or regenerate with `npm run cool:identity`.",
    ].join("\n"),
  );
}
