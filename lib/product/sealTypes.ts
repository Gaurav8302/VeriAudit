/**
 * Public product sealing types. Safe to import from the browser.
 *
 * Receipts and log state are public cryptographic artifacts. They are not a
 * verification verdict. Only the server may compute `verified`.
 */
import type { CoolReference } from "@/lib/cool/types";

export const PRODUCT_SEAL_SCHEMA = "veriaudit.product.seal.v1" as const;

export type ProductEventName =
  | "audit.execution.started"
  | "evidence.ingested"
  | "evidence.read"
  | "ai.action.started"
  | "ai.action.completed"
  | "finding.created"
  | "finding.reviewed"
  | "audit.execution.closed";

export type TamperSimulation =
  | "payload"
  | "delete-leaf"
  | "fingerprint"
  | "finding"
  | "review";

export interface EvidenceBinding {
  readonly evidenceId: string;
  readonly fingerprint: string | null;
}

export interface FindingBinding {
  readonly findingId: string;
  readonly review: string;
  readonly origin: string;
}

export interface SealEventSummary {
  readonly eventId: string;
  readonly productEvent: ProductEventName;
  readonly type: string;
  readonly title: string;
  readonly occurredAt: string;
  readonly parentEventId: string | null;
  readonly sequence: number;
  readonly contentDigest: string;
}

export interface ExecutionSealBundle {
  readonly schema: typeof PRODUCT_SEAL_SCHEMA;
  readonly executionId: string;
  readonly auditId: string;
  readonly sealedAt: string;
  readonly status: "sealed";
  readonly logState: readonly string[];
  readonly treeHead: { logId: string; treeSize: number; rootHash: string } | null;
  readonly contentDigests: readonly string[];
  readonly eventIds: readonly string[];
  readonly events: readonly SealEventSummary[];
  readonly references: readonly CoolReference[];
  readonly receipts: Readonly<Record<string, unknown>>;
}

export interface ProductVerificationChecks {
  readonly receiptAuthenticity: boolean;
  readonly trustedIdentity: boolean;
  readonly measurementPinned: boolean;
  readonly inclusion: boolean;
  readonly executionIntegrity: boolean;
  readonly eventHistory: boolean;
}

export interface ProductVerification {
  readonly status: "verified" | "failed" | "unavailable";
  readonly executionId: string;
  readonly eventsVerified: number;
  readonly eventsChecked: number;
  readonly inclusion: "pass" | "fail" | "absent";
  readonly identity: "verified" | "failed";
  readonly integrity: "verified" | "failed";
  readonly measurement: "verified" | "failed";
  readonly history: "consistent" | "inconsistent";
  readonly checks: ProductVerificationChecks;
  readonly failures: readonly string[];
  readonly claim: string;
  readonly checkedAt: string;
  readonly tampered: boolean;
}

export const VERIFIED_EXECUTION_CLAIM =
  "This execution's recorded event history matches its cryptographic evidence. " +
  "It does not mean the AI conclusion was correct, and this build is not hardware-attested.";

export const FAILED_EXECUTION_CLAIM =
  "The stored historical record no longer matches the cryptographic commitment.";

export const UNAVAILABLE_EXECUTION_CLAIM =
  "This execution has not been sealed, or its receipts are not available to verify.";
