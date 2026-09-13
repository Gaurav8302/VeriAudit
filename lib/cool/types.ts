/**
 * Types at the VeriAudit ↔ CooL boundary.
 *
 * Nothing here imports `cool-nwc`, so the product layer can describe events and
 * read integrity results without pulling the SDK into its module graph.
 * See docs/EVENT_MODEL.md and docs/COOL_INTEGRATION.md.
 */

/** VeriAudit's event vocabulary. Passed through to `cool.record({ type })`. */
export type EventType =
  | "audit.started"
  | "artifact.ingested"
  | "artifact.parsed"
  | "retrieval.executed"
  | "model.executed"
  | "tool.executed"
  | "control.tested"
  | "finding.created"
  | "human.review.requested"
  | "human.review.completed"
  | "conclusion.created";

export type Actor = "ai" | "human" | "system";

export type Scenario = "financial" | "legal" | "cyber" | "procurement";

/** A JSON-serialisable value. Anything committed must fit this. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * An application event, as the product layer creates it.
 *
 * `occurredAt` is VeriAudit's LOGICAL time and is part of the committed payload.
 * It is deliberately distinct from the receipt's `record.time.issued_at`, which
 * is when the evidence plane sealed the record. See docs/EVENT_MODEL.md §2.
 */
export interface VeriAuditEvent {
  readonly eventId: string;
  readonly auditId: string;
  readonly executionId: string;
  readonly sequence: number;
  readonly type: EventType;
  readonly actor: Actor;
  readonly scenario: Scenario;
  /** RFC 3339 UTC. Logical time, not sealing time. */
  readonly occurredAt: string;
  readonly parentEventId: string | null;
  readonly artifactRefs: readonly string[];
  readonly title: string;
  readonly summary: string;
  /** Type-specific structured fields. Deep-sorted during canonicalisation. */
  readonly detail: Readonly<Record<string, JsonValue>>;
  /** Sensitive plaintexts to commit and discard. Never stored in the receipt. */
  readonly inputPayload?: string;
  readonly outputPayload?: string;
}

/**
 * The canonical payload committed to CooL. Snake-cased, fixed key order,
 * deep-sorted `detail`, and free of anything unstable.
 */
export interface CanonicalEventPayload {
  readonly schema: "veriaudit.event.v1";
  readonly actor: Actor;
  readonly artifact_ids: readonly string[];
  readonly audit_id: string;
  readonly detail: Readonly<Record<string, JsonValue>>;
  readonly event_id: string;
  readonly event_type: EventType;
  readonly execution_id: string;
  readonly occurred_at: string;
  readonly parent_event_id: string | null;
  readonly scenario: Scenario;
  readonly sequence: number;
  readonly summary: string;
  readonly title: string;
}

/** The compact reference VeriAudit persists alongside an event. ~330 bytes. */
export interface CoolReference {
  readonly recordId: string;
  readonly bindingHash: string;
  readonly keyId: string;
  readonly signatureAlg: string;
  /** When the evidence plane sealed this record (NOT when the event occurred). */
  readonly issuedAt: string;
  readonly runtimeMode: "mock" | "simulated" | "hardware";
  readonly leafIndex: number | null;
  readonly treeSize: number | null;
  readonly logId: string | null;
  readonly receiptRef: string;
  /** Salt-free digest of the canonical payload. Stable across re-recordings. */
  readonly contentDigest: string;
}

export interface RecordedEvent {
  readonly eventId: string;
  readonly reference: CoolReference;
  /** The verbatim `cool.receipt.v2` envelope, ~30 KB. Never normalise it. */
  readonly receipt: unknown;
}

export type DomainName =
  | "binding"
  | "signature"
  | "inclusion"
  | "witnesses"
  | "attestation"
  | "enclave"
  | "anchor";

export type DomainStatus = "pass" | "fail" | "absent" | "mock" | "simulated" | "pending";

export interface DomainResult {
  readonly status: DomainStatus;
  readonly detail: string;
}

/** Why an application-level check failed, in words a UI can show. */
export interface IntegrityFailure {
  readonly check: "cool" | "signer" | "measurement" | "inclusion" | "shape";
  readonly reason: string;
}

/**
 * The application-level verdict.
 *
 * `ok` requires ALL of `verdictOk`, `signerTrusted`, and `logged`. Per
 * docs/VERIFICATION_SPEC.md §6, the SDK's own `verdict.ok` is NOT sufficient:
 * it stays true when the inclusion proof is stripped, and it is true for a
 * receipt produced by any evidence plane.
 */
export interface IntegrityState {
  readonly status: "verified" | "failed" | "unavailable" | "not-recorded";
  readonly ok: boolean;
  /** The SDK's own verdict. Authenticity and internal consistency only. */
  readonly verdictOk: boolean;
  /** Signed by a key in VeriAudit's published allow-list. */
  readonly signerTrusted: boolean;
  /** The record's measurement equals the pinned image measurement. */
  readonly measurementMatches: boolean;
  /** `inclusion` is `pass` — the transparency-log proof is present and valid. */
  readonly logged: boolean;
  /** True only with a verified hardware quote. Always false in this build. */
  readonly hardware: boolean;
  readonly domains: Readonly<Record<DomainName, DomainResult>>;
  /** The SDK's own reason strings, verbatim. */
  readonly coolReasons: readonly string[];
  /** Application-level failures, with actionable text. */
  readonly failures: readonly IntegrityFailure[];
  readonly subject: {
    readonly recordId: string | null;
    readonly keyId: string | null;
    readonly eventType: string | null;
    readonly executionId: string | null;
    readonly issuedAt: string | null;
    readonly runtimeMode: string | null;
    readonly leafIndex: number | null;
    readonly treeSize: number | null;
  };
  readonly checkedAt: string;
  /**
   * What a VERIFIED result does and does not mean. Carried with the verdict so
   * a UI cannot render the badge without the caveat. See
   * docs/SECURITY_AND_CLAIMS.md §2.
   */
  readonly claim: string;
}

/** The published, pinnable identity of VeriAudit's evidence plane. */
export interface CoolIdentity {
  readonly applicationId: string;
  readonly imageDigest: string;
  readonly logId: string;
  readonly measurement: Readonly<Record<string, string>>;
  readonly keyDirectory: Readonly<Record<string, { ml_dsa_pub: string; ed25519_pub: string }>>;
  readonly trustedKeyIds: readonly string[];
  readonly runtimeMode: string;
  readonly hardware: boolean;
}
