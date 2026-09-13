/**
 * Verification, with the trust checks discovery proved are necessary.
 *
 *   verifyEvidence(...)                  the SDK's 7 domains
 *   + expectedMeasurement                the approved image
 *   + withTrustedKeys                    our published keys OVER the receipt's
 *   + key_id allow-list                  "ours", not merely "authentic"
 *   + inclusion === "pass"               the log proof is present AND valid
 *   ────────────────────────────────────
 *   = VERIFIED, otherwise FAILED with an actionable reason
 *
 * Why `verdict.ok` alone is not enough — both CONFIRMED, both in
 * docs/COOL_SDK_AUDIT.md §6 and docs/VERIFICATION_SPEC.md §6:
 *
 *   1. Stripping BOTH `inclusion` and `sth` from a receipt leaves
 *      `verdict.ok === true` with ZERO reasons, because `ok` permits
 *      `inclusion: absent`. An attacker can delete the proof that a record was
 *      ever logged and the SDK will not object.
 *   2. A receipt carries its OWN `key_directory`, so a forger running their own
 *      evidence plane produces a receipt that verifies `ok: true` with zero
 *      reasons — under a different `key_id`.
 *
 * `verifyEvidence` never throws; malformed input returns a failed verdict. We
 * preserve that property: this module never throws either.
 */
import { verifyEvidence, withTrustedKeys } from "cool-nwc";
import type { Evidence, Measurement, Verdict } from "cool-nwc";
import {
  EXPECTED_MEASUREMENT,
  PUBLISHED_KEY_DIRECTORY,
  TRUSTED_RECORD_KEY_ID_SET,
  measurementDiff,
} from "./identity";
import type { KeyDirectory } from "./key-directory";
import type {
  DomainName,
  DomainResult,
  IntegrityFailure,
  IntegrityState,
} from "./types";

/**
 * The trust anchors verification is performed against.
 *
 * Parameterised so tests can isolate one check at a time — a matrix that only
 * ever fails several checks at once cannot show that any single one of them is
 * load-bearing. Production callers use {@link PRODUCTION_POLICY}; nothing in
 * `app/` passes a policy.
 */
export interface TrustPolicy {
  readonly expectedMeasurement: Measurement;
  readonly publishedKeyDirectory: KeyDirectory;
  readonly trustedRecordKeyIds: ReadonlySet<string>;
}

export const PRODUCTION_POLICY: TrustPolicy = {
  expectedMeasurement: EXPECTED_MEASUREMENT,
  publishedKeyDirectory: PUBLISHED_KEY_DIRECTORY,
  trustedRecordKeyIds: TRUSTED_RECORD_KEY_ID_SET,
};

const DOMAINS: readonly DomainName[] = [
  "binding",
  "signature",
  "inclusion",
  "witnesses",
  "attestation",
  "enclave",
  "anchor",
];

/**
 * What a VERIFIED result means, carried WITH the verdict so a UI cannot render
 * the badge without it. See docs/SECURITY_AND_CLAIMS.md §2.
 */
export const VERIFIED_CLAIM =
  "This record is authentic and has not been altered since it was sealed. " +
  "It does NOT mean the AI's conclusion was correct, and this build is not " +
  "hardware-attested: the attestation and enclave domains are simulated.";

export const FAILED_CLAIM =
  "One or more required integrity checks did not pass. The record cannot be " +
  "treated as authentic VeriAudit evidence.";

function emptyDomains(detail: string): Record<DomainName, DomainResult> {
  return Object.fromEntries(
    DOMAINS.map((d) => [d, { status: "absent" as const, detail }]),
  ) as Record<DomainName, DomainResult>;
}

function readDomains(verdict: Verdict): Record<DomainName, DomainResult> {
  return Object.fromEntries(
    DOMAINS.map((d) => {
      const check = verdict.checks[d];
      return [d, { status: check.status, detail: check.detail }];
    }),
  ) as Record<DomainName, DomainResult>;
}

/** Safe structural reads — the input is untrusted by definition. */
function peek(receipt: unknown) {
  const r = (receipt ?? {}) as Record<string, any>;
  const record = (r["record"] ?? {}) as Record<string, any>;
  return {
    recordId: typeof record["record_id"] === "string" ? record["record_id"] : null,
    keyId:
      typeof record["signature"]?.["key_id"] === "string"
        ? (record["signature"]["key_id"] as string)
        : null,
    eventType: typeof record["event"]?.["type"] === "string" ? (record["event"]["type"] as string) : null,
    executionId:
      typeof record["event"]?.["execution_id"] === "string"
        ? (record["event"]["execution_id"] as string)
        : null,
    issuedAt: typeof record["time"]?.["issued_at"] === "string" ? (record["time"]["issued_at"] as string) : null,
    runtimeMode: typeof record["runtime"]?.["mode"] === "string" ? (record["runtime"]["mode"] as string) : null,
    measurement: record["runtime"]?.["enclave_measurement"] ?? null,
    leafIndex: typeof r["inclusion"]?.["leaf_index"] === "number" ? (r["inclusion"]["leaf_index"] as number) : null,
    treeSize: typeof r["inclusion"]?.["tree_size"] === "number" ? (r["inclusion"]["tree_size"] as number) : null,
  };
}

/**
 * Verify a receipt as VeriAudit evidence.
 *
 * @param receipt anything — a `cool.receipt.v2` envelope, or not
 * @param policy  trust anchors; defaults to the pinned production policy
 */
export async function verifyReceipt(
  receipt: unknown,
  policy: TrustPolicy = PRODUCTION_POLICY,
): Promise<IntegrityState> {
  const checkedAt = new Date().toISOString();

  if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) {
    return {
      status: "failed",
      ok: false,
      verdictOk: false,
      signerTrusted: false,
      measurementMatches: false,
      logged: false,
      hardware: false,
      domains: emptyDomains("not evaluated — input is not a receipt object"),
      coolReasons: [],
      failures: [
        { check: "shape", reason: "the supplied value is not a CooL receipt object" },
      ],
      subject: {
        recordId: null,
        keyId: null,
        eventType: null,
        executionId: null,
        issuedAt: null,
        runtimeMode: null,
        leafIndex: null,
        treeSize: null,
      },
      checkedAt,
      claim: FAILED_CLAIM,
    };
  }

  const seen = peek(receipt);

  // Merge OUR published keys over the receipt's self-asserted directory.
  // CONFIRMED: this is what defeats a same-key_id key substitution — the
  // attacker's key material is replaced by the real one, so `signature` fails.
  // It does NOT catch a forger using a DIFFERENT key_id, because the ids do not
  // collide and nothing is overridden. The allow-list below catches that.
  const pinned = withTrustedKeys(receipt as Evidence, policy.publishedKeyDirectory);

  const verdict = await verifyEvidence(pinned, {
    expectedMeasurement: policy.expectedMeasurement,
  });

  const domains = readDomains(verdict);
  const failures: IntegrityFailure[] = [];

  const verdictOk = verdict.ok;
  if (!verdictOk) {
    const failed = DOMAINS.filter((d) => domains[d].status === "fail");
    failures.push({
      check: "cool",
      reason:
        failed.length > 0
          ? `CooL verification failed on: ${failed.join(", ")}`
          : "CooL verification did not pass",
    });
  }

  const signerTrusted = seen.keyId !== null && policy.trustedRecordKeyIds.has(seen.keyId);
  if (!signerTrusted) {
    failures.push({
      check: "signer",
      reason:
        seen.keyId === null
          ? "the receipt names no signing key"
          : `signing key '${seen.keyId}' is not in VeriAudit's published allow-list — ` +
            "this receipt may be authentic, but it was not produced by VeriAudit's evidence plane",
    });
  }

  const differing =
    seen.measurement && typeof seen.measurement === "object"
      ? measurementDiff(seen.measurement as never, policy.expectedMeasurement)
      : ["mrtd", "rtmr0", "rtmr1", "rtmr2", "rtmr3"];
  const measurementMatches = differing.length === 0;
  if (!measurementMatches) {
    failures.push({
      check: "measurement",
      reason:
        `the record's image measurement differs from the approved one in ${differing.join(", ")} — ` +
        "it was sealed by a different build",
    });
  }

  // The gap `verdict.ok` does not close.
  const logged = domains.inclusion.status === "pass";
  if (!logged) {
    failures.push({
      check: "inclusion",
      reason:
        domains.inclusion.status === "absent"
          ? "this receipt carries no transparency-log proof — a logged record should have one, " +
            "and its absence alone does not fail CooL's own verdict"
          : `transparency-log inclusion is '${domains.inclusion.status}': ${domains.inclusion.detail}`,
    });
  }

  const ok = verdictOk && signerTrusted && measurementMatches && logged;

  return {
    status: ok ? "verified" : "failed",
    ok,
    verdictOk,
    signerTrusted,
    measurementMatches,
    logged,
    // CONFIRMED: false in this build. `pass` requires a quote chained to a real
    // vendor root, which needs hardware we do not have.
    hardware: domains.attestation.status === "pass",
    domains,
    coolReasons: verdict.reasons,
    failures,
    subject: {
      recordId: seen.recordId,
      keyId: seen.keyId,
      eventType: seen.eventType,
      executionId: seen.executionId,
      issuedAt: seen.issuedAt,
      runtimeMode: seen.runtimeMode,
      leafIndex: seen.leafIndex,
      treeSize: seen.treeSize,
    },
    checkedAt,
    claim: ok ? VERIFIED_CLAIM : FAILED_CLAIM,
  };
}

/** Verify many receipts. Order is preserved. */
export async function verifyReceipts(
  receipts: readonly unknown[],
  policy: TrustPolicy = PRODUCTION_POLICY,
): Promise<IntegrityState[]> {
  const out: IntegrityState[] = [];
  for (const receipt of receipts) out.push(await verifyReceipt(receipt, policy));
  return out;
}
