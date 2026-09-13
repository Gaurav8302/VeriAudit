/**
 * Product execution sealing and verification.
 *
 * Reuses the proven CooL recorder and verifier. This module is server-side:
 * do not import it from client components.
 */
import { fingerprintLogState } from "@/lib/audit/integrity";
import { contentDigest } from "@/lib/cool/canonical";
import { recordEvents } from "@/lib/cool/recorder";
import { FAILED_CLAIM, VERIFIED_CLAIM, verifyReceipt } from "@/lib/cool/verifier";
import type { CoolReference, VeriAuditEvent } from "@/lib/cool/types";
import { HERO_EXECUTION_ID } from "@/lib/product/workspace";
import {
  assertAppendOnlyChain,
  eventsFromSnapshot,
  productEventName,
  type SealSnapshot,
} from "./productEvents";
import {
  FAILED_EXECUTION_CLAIM,
  PRODUCT_SEAL_SCHEMA,
  UNAVAILABLE_EXECUTION_CLAIM,
  VERIFIED_EXECUTION_CLAIM,
  type ExecutionSealBundle,
  type ProductVerification,
  type TamperSimulation,
} from "./sealTypes";

export const PRODUCT_VERIFY_POLICY = [
  "cool verdict ok",
  "signer key_id in the published allow-list",
  "measurement equals the pinned image measurement",
  'inclusion === "pass"',
  "content digest matches the sealed canonical event",
  "receipt binding sits at the claimed leaf",
  "rehydrated tree root matches the captured tree head",
  "event parent chain is intact",
] as const;

export function isProductTamperAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";
}

function peekReceipt(receipt: unknown) {
  const value = (receipt ?? {}) as Record<string, any>;
  const record = (value["record"] ?? {}) as Record<string, any>;
  return {
    bindingHash: typeof value["binding_hash"] === "string" ? (value["binding_hash"] as string) : null,
    executionId:
      typeof record["event"]?.["execution_id"] === "string"
        ? (record["event"]["execution_id"] as string)
        : null,
    eventType: typeof record["event"]?.["type"] === "string" ? (record["event"]["type"] as string) : null,
    leafIndex:
      typeof value["inclusion"]?.["leaf_index"] === "number"
        ? (value["inclusion"]["leaf_index"] as number)
        : null,
  };
}

function applyTamper(snapshot: SealSnapshot, bundle: ExecutionSealBundle, kind: TamperSimulation): {
  snapshot: SealSnapshot;
  bundle: ExecutionSealBundle;
} {
  if (kind === "payload") {
    return {
      snapshot: {
        ...snapshot,
        activities: snapshot.activities.map((item, index) =>
          index === 0 ? { ...item, title: `${item.title} (altered)` } : item,
        ),
      },
      bundle,
    };
  }
  if (kind === "fingerprint") {
    return {
      snapshot: {
        ...snapshot,
        evidence: snapshot.evidence.map((item, index) =>
          index === 0 ? { ...item, fingerprint: "sha256:tampered-fingerprint" } : item,
        ),
      },
      bundle,
    };
  }
  if (kind === "finding") {
    return {
      snapshot: {
        ...snapshot,
        findings: snapshot.findings.map((item, index) =>
          index === 0 ? { ...item, title: "Altered finding title" } : item,
        ),
      },
      bundle,
    };
  }
  if (kind === "review") {
    return {
      snapshot: {
        ...snapshot,
        findings: snapshot.findings.map((item) =>
          item.review !== "pending" ? { ...item, review: item.review === "accepted" ? "rejected" : "accepted" } : item,
        ),
      },
      bundle,
    };
  }
  return {
    snapshot,
    bundle: {
      ...bundle,
      logState: bundle.logState.slice(0, Math.max(0, bundle.logState.length - 1)),
    },
  };
}

export async function sealProductExecution(snapshot: SealSnapshot): Promise<ExecutionSealBundle> {
  if (snapshot.execution.executionId === HERO_EXECUTION_ID) {
    throw new Error("The sealed original execution cannot be sealed again.");
  }
  if (snapshot.execution.status !== "closed" && snapshot.execution.status !== "sealed") {
    throw new Error("Close the execution before sealing it.");
  }

  const events = eventsFromSnapshot(snapshot);
  const chainError = assertAppendOnlyChain(events);
  if (chainError) throw new Error(chainError);

  const recorded = await recordEvents(events, []);
  const references: CoolReference[] = recorded.recorded.map((item) => item.reference);
  const receipts: Record<string, unknown> = {};
  for (const item of recorded.recorded) {
    receipts[item.reference.receiptRef] = item.receipt;
  }

  return {
    schema: PRODUCT_SEAL_SCHEMA,
    executionId: snapshot.execution.executionId,
    auditId: snapshot.auditId,
    sealedAt: new Date().toISOString(),
    status: "sealed",
    logState: recorded.logState,
    treeHead: recorded.treeHead,
    contentDigests: events.map((event) => contentDigest(event)),
    eventIds: events.map((event) => event.eventId),
    events: events.map((event) => ({
      eventId: event.eventId,
      productEvent: productEventName(event),
      type: event.type,
      title: event.title,
      occurredAt: event.occurredAt,
      parentEventId: event.parentEventId,
      sequence: event.sequence,
      contentDigest: contentDigest(event),
    })),
    references,
    receipts,
  };
}

export async function verifyProductExecution(
  snapshot: SealSnapshot,
  bundle: ExecutionSealBundle,
  options: { simulateTamper?: TamperSimulation | null } = {},
): Promise<ProductVerification> {
  const checkedAt = new Date().toISOString();
  const tampered = Boolean(options.simulateTamper);
  if (tampered && !isProductTamperAllowed()) {
    return unavailable(snapshot.execution.executionId, checkedAt, [
      "historical tampering simulation is disabled",
    ]);
  }

  const subject = options.simulateTamper
    ? applyTamper(snapshot, bundle, options.simulateTamper)
    : { snapshot, bundle };

  if (subject.bundle.executionId !== subject.snapshot.execution.executionId) {
    return failed(subject.snapshot.execution.executionId, 0, checkedAt, tampered, [
      "the seal does not belong to this execution",
    ]);
  }

  let events: VeriAuditEvent[];
  try {
    events = eventsFromSnapshot(subject.snapshot);
  } catch (error) {
    return failed(subject.snapshot.execution.executionId, 0, checkedAt, tampered, [
      error instanceof Error ? error.message : "canonical events could not be rebuilt",
    ]);
  }

  const failures: string[] = [];
  const chainError = assertAppendOnlyChain(events);
  if (chainError) failures.push(chainError);

  if (events.length !== subject.bundle.eventIds.length) {
    failures.push("the stored event count no longer matches the sealed event count");
  }

  let digestMatches = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const expectedId = subject.bundle.eventIds[index];
    const expectedDigest = subject.bundle.contentDigests[index];
    if (expectedId && event.eventId !== expectedId) {
      failures.push(`event order changed at ${event.eventId}`);
    }
    if (expectedDigest && contentDigest(event) !== expectedDigest) {
      failures.push(`event ${event.eventId} no longer matches its sealed commitment`);
    } else if (expectedDigest) {
      digestMatches += 1;
    }
  }

  const receiptRefs = subject.bundle.references.map((item) => item.receiptRef);
  if (receiptRefs.length === 0) {
    return unavailable(subject.snapshot.execution.executionId, checkedAt, [
      "no receipts were stored for this execution",
    ]);
  }

  let receiptOk = 0;
  let identityOk = 0;
  let measurementOk = 0;
  let inclusionOk = 0;
  let boundOk = 0;

  for (const reference of subject.bundle.references) {
    const receipt = subject.bundle.receipts[reference.receiptRef];
    const state = await verifyReceipt(receipt);
    if (state.ok) receiptOk += 1;
    if (state.signerTrusted) identityOk += 1;
    if (state.measurementMatches) measurementOk += 1;
    if (state.logged) inclusionOk += 1;
    else failures.push(`${reference.receiptRef}: inclusion did not pass`);
    if (!state.ok) {
      failures.push(
        `${reference.receiptRef}: ${state.failures.map((item) => item.reason).join("; ") || FAILED_CLAIM}`,
      );
    }

    const seen = peekReceipt(receipt);
    if (seen.bindingHash !== reference.bindingHash) {
      failures.push(`${reference.receiptRef}: receipt binding does not match the stored reference`);
    } else if (
      reference.leafIndex === null ||
      subject.bundle.logState[reference.leafIndex] !== reference.bindingHash
    ) {
      failures.push(`${reference.receiptRef}: leaf binding is not at the claimed position`);
    } else if (seen.executionId !== subject.snapshot.execution.executionId) {
      failures.push(`${reference.receiptRef}: receipt is bound to a different execution`);
    } else {
      boundOk += 1;
    }
  }

  let rootsMatch = false;
  try {
    const rehydrated = await fingerprintLogState(subject.bundle.logState);
    rootsMatch = Boolean(
      subject.bundle.treeHead && subject.bundle.treeHead.rootHash === rehydrated.rootHash,
    );
    if (subject.bundle.treeHead && subject.bundle.treeHead.treeSize !== rehydrated.treeSize) {
      failures.push("the stored tree size no longer matches the rehydrated log");
    }
    if (!rootsMatch) {
      failures.push("the rehydrated tree root does not match the sealed tree head");
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "the append-only log could not be rehydrated");
  }

  const expected = events.length;
  const checks = {
    receiptAuthenticity: receiptOk === expected && expected > 0,
    trustedIdentity: identityOk === expected && expected > 0,
    measurementPinned: measurementOk === expected && expected > 0,
    inclusion: inclusionOk === expected && expected > 0,
    executionIntegrity: boundOk === expected && rootsMatch && digestMatches === expected,
    eventHistory: chainError === null && digestMatches === expected && events.length === subject.bundle.eventIds.length,
  };
  const ok =
    failures.length === 0 &&
    checks.receiptAuthenticity &&
    checks.trustedIdentity &&
    checks.measurementPinned &&
    checks.inclusion &&
    checks.executionIntegrity &&
    checks.eventHistory;

  return {
    status: ok ? "verified" : "failed",
    executionId: subject.snapshot.execution.executionId,
    eventsVerified: ok ? expected : Math.min(receiptOk, digestMatches, boundOk),
    eventsChecked: expected,
    inclusion: checks.inclusion ? "pass" : inclusionOk === 0 ? "absent" : "fail",
    identity: checks.trustedIdentity ? "verified" : "failed",
    integrity: checks.executionIntegrity ? "verified" : "failed",
    measurement: checks.measurementPinned ? "verified" : "failed",
    history: checks.eventHistory ? "consistent" : "inconsistent",
    checks,
    failures,
    claim: ok ? `${VERIFIED_EXECUTION_CLAIM} ${VERIFIED_CLAIM}` : FAILED_EXECUTION_CLAIM,
    checkedAt,
    tampered,
  };
}

function failed(
  executionId: string,
  eventsChecked: number,
  checkedAt: string,
  tampered: boolean,
  failures: string[],
): ProductVerification {
  return {
    status: "failed",
    executionId,
    eventsVerified: 0,
    eventsChecked,
    inclusion: "fail",
    identity: "failed",
    integrity: "failed",
    measurement: "failed",
    history: "inconsistent",
    checks: {
      receiptAuthenticity: false,
      trustedIdentity: false,
      measurementPinned: false,
      inclusion: false,
      executionIntegrity: false,
      eventHistory: false,
    },
    failures,
    claim: FAILED_EXECUTION_CLAIM,
    checkedAt,
    tampered,
  };
}

function unavailable(
  executionId: string,
  checkedAt: string,
  failures: string[],
): ProductVerification {
  return {
    status: "unavailable",
    executionId,
    eventsVerified: 0,
    eventsChecked: 0,
    inclusion: "absent",
    identity: "failed",
    integrity: "failed",
    measurement: "failed",
    history: "inconsistent",
    checks: {
      receiptAuthenticity: false,
      trustedIdentity: false,
      measurementPinned: false,
      inclusion: false,
      executionIntegrity: false,
      eventHistory: false,
    },
    failures,
    claim: UNAVAILABLE_EXECUTION_CLAIM,
    checkedAt,
    tampered: false,
  };
}

export function isSealBundle(value: unknown): value is ExecutionSealBundle {
  if (!value || typeof value !== "object") return false;
  const bundle = value as ExecutionSealBundle;
  return (
    bundle.schema === PRODUCT_SEAL_SCHEMA &&
    typeof bundle.executionId === "string" &&
    Array.isArray(bundle.logState) &&
    Array.isArray(bundle.contentDigests) &&
    bundle.receipts !== null &&
    typeof bundle.receipts === "object"
  );
}
