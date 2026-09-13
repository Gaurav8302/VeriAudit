/**
 * The audit domain. One vocabulary, four scenarios.
 *
 * Nothing here imports `cool-nwc` or `lib/cool`. The engine produces audit
 * results and events; sealing them is a separate step (`lib/audit/run.ts`), so
 * the whole domain layer is testable without touching cryptography.
 *
 * Entity shapes follow docs/DATA_MODEL.md §2.
 */
import type { Actor, EventType, JsonValue, Scenario } from "@/lib/cool/types";

export type { Actor, EventType, JsonValue, Scenario };

export type Severity = "high" | "medium" | "low";

/** A control either held or it did not. No "warning" tier — see engine.ts. */
export type ControlStatus = "pass" | "exception";

/**
 * A finding's lifecycle.
 *
 * `open` is the PENDING state: a review is required and has not happened. The
 * milestone brief names these PENDING/APPROVED/MODIFIED/REJECTED; this is the
 * same four states under docs/DATA_MODEL.md §2's existing names, kept so the
 * documented schema and the code do not drift apart.
 */
export type FindingStatus = "open" | "accepted" | "modified" | "rejected";

export type ReviewDecision = "accepted" | "modified" | "rejected";

// ─────────────────────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────────────────────

export type ArtifactKind =
  | "revenue_ledger"
  | "contract"
  | "approval_log"
  | "policy"
  | "access_export"
  | "vendor_file"
  | "goods_receipt"
  | "register";

/**
 * A piece of evidence in scope.
 *
 * `content` is the synthetic plaintext VeriAudit holds; only a commitment over
 * it reaches CooL, so the evidence viewer can show the plaintext beside the
 * commitment and let a judge recompute it.
 */
export interface Artifact {
  readonly artifactId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly mimeType: string;
  readonly rows: number | null;
  readonly content: string;
  /** Structured figures a parse step extracts. Committed by `artifact.parsed`. */
  readonly parsed: Readonly<Record<string, JsonValue>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlContext<E> {
  /** The scenario's typed evidence bundle — the numbers the rules run over. */
  readonly evidence: E;
  readonly artifactsById: ReadonlyMap<string, Artifact>;
}

/**
 * What a control rule returns.
 *
 * `observed` is the point of the whole exercise: the specific figures the rule
 * saw. Without it a finding is an assertion; with it, a reader months later can
 * check the arithmetic.
 *
 * `undefined` values are allowed here purely so a rule can return different
 * `observed` shapes from its pass and exception branches without TypeScript
 * unioning the two into `{ …, extra?: undefined }`. The engine prunes them, so
 * what reaches a `ControlResult` (and therefore a commitment) is pure JSON.
 */
export interface ControlEvaluation {
  readonly status: ControlStatus;
  readonly observed: Readonly<Record<string, JsonValue | undefined>>;
  readonly rationale: string;
  /** Required when `status` is `exception` — it becomes the finding. */
  readonly finding?: {
    readonly severity: Severity;
    readonly title: string;
    readonly description: string;
    readonly recommendedAction: string;
    readonly amountUsd?: number;
  };
}

export interface Control<E> {
  readonly controlId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  /** The evidence this control reads. Becomes the finding's citations. */
  readonly artifactIds: readonly string[];
  /** Pure. Same evidence in, same verdict out, on any machine. */
  readonly evaluate: (ctx: ControlContext<E>) => ControlEvaluation;
}

export interface ControlResult {
  readonly controlId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly status: ControlStatus;
  readonly observed: Readonly<Record<string, JsonValue>>;
  readonly rationale: string;
  readonly artifactIds: readonly string[];
  /** Set when this control produced a finding. */
  readonly findingId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The AI seam
// ─────────────────────────────────────────────────────────────────────────────

export interface RetrievalSpec {
  readonly query: string;
  readonly artifactIds: readonly string[];
  /** The passages that reached the model. Authored, so retrieval is auditable. */
  readonly passages: readonly string[];
}

export interface ReasonerInput {
  readonly scenarioId: Scenario;
  readonly query: string;
  readonly passages: readonly string[];
  readonly parsed: readonly Readonly<Record<string, JsonValue>>[];
}

/**
 * The model's structured output.
 *
 * Deliberately NOT the source of pass/exception. Controls compute that from
 * evidence independently, and this is the narrative and the candidate
 * observations. See `reasoner.ts` for why.
 */
export interface ReasonerOutput {
  readonly assessment: string;
  readonly observations: readonly string[];
  readonly confidence: "high" | "medium" | "low";
}

export interface Reasoner {
  readonly name: string;
  readonly version: string;
  /** False would make the demo result unreliable. Asserted by a test. */
  readonly deterministic: boolean;
  readonly analyse: (input: ReasonerInput) => ReasonerOutput;
}

// ─────────────────────────────────────────────────────────────────────────────
// Findings, reviews, conclusion
// ─────────────────────────────────────────────────────────────────────────────

export interface Finding {
  readonly findingId: string;
  readonly auditId: string;
  readonly executionId: string;
  readonly controlId: string;
  readonly severity: Severity;
  readonly title: string;
  readonly description: string;
  /** Why the control failed, in the reader's terms. */
  readonly rationale: string;
  readonly recommendedAction: string;
  readonly evidenceArtifactIds: readonly string[];
  /** The figures the control observed, carried through so the finding is checkable. */
  readonly observed: Readonly<Record<string, JsonValue>>;
  readonly amountUsd: number | null;
  readonly status: FindingStatus;
  readonly reviewRequired: boolean;
  readonly reviewId: string | null;
  /** Severity as the AI first assigned it, when a reviewer changed it. */
  readonly originalSeverity: Severity | null;
}

export interface HumanReview {
  readonly reviewId: string;
  readonly findingId: string;
  readonly reviewer: { readonly name: string; readonly role: string };
  readonly decision: ReviewDecision;
  readonly note: string;
  readonly reviewedAt: string;
  readonly modifiedSeverity: Severity | null;
}

export interface ReviewPolicy {
  readonly reviewer: { readonly name: string; readonly role: string };
  /** Which findings must be seen by a person before the audit concludes. */
  readonly requiresReview: (finding: { severity: Severity; controlId: string }) => boolean;
  /**
   * Deterministic review outcomes for the demo, keyed by `controlId` because it
   * is stable while finding ids are assigned during the run. A control with no
   * entry stays PENDING — which is the point: not every AI finding is
   * automatically approved.
   */
  readonly decisions: Readonly<
    Record<
      string,
      {
        readonly decision: ReviewDecision;
        readonly note: string;
        readonly modifiedSeverity?: Severity;
      }
    >
  >;
}

export interface Conclusion {
  readonly auditId: string;
  readonly executionId: string;
  readonly controlsTested: number;
  readonly controlsPassed: number;
  readonly exceptions: number;
  readonly findings: number;
  readonly humanReviewsCompleted: number;
  readonly humanReviewsPending: number;
  readonly humanReviewCompleted: boolean;
  readonly statement: string;
  readonly concludedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditScenario<E = unknown> {
  readonly scenarioId: Scenario;
  readonly displayName: string;
  readonly description: string;
  readonly isHero: boolean;

  readonly auditId: string;
  readonly executionId: string;
  /** Short code inside event ids, e.g. `FIN-2609` → `EVT-FIN-2609-004`. */
  readonly eventCode: string;
  readonly title: string;
  readonly period: string;
  /** Logical start. All event times are offsets from here — never `Date.now()`. */
  readonly openedAt: string;
  readonly stepMinutes: number;

  readonly artifacts: readonly Artifact[];
  readonly evidence: E;
  readonly controls: readonly Control<E>[];
  readonly retrieval: RetrievalSpec;
  readonly reasoner: Reasoner;
  readonly reviewPolicy: ReviewPolicy;

  /**
   * The scenario's own declaration of its result. The engine recomputes and
   * throws if they disagree.
   *
   * This is a tripwire, not documentation: authored evidence and real rules can
   * silently drift apart, and a demo whose headline numbers changed without
   * anyone noticing is worse than one that fails loudly in CI.
   */
  readonly expected: {
    readonly controlsTested: number;
    readonly controlsPassed: number;
    readonly exceptions: number;
    readonly findings: number;
  };

  readonly searchTags: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine output
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditResult {
  readonly auditId: string;
  readonly executionId: string;
  readonly scenarioId: Scenario;
  readonly title: string;
  readonly period: string;
  readonly isHero: boolean;
  readonly openedAt: string;
  readonly artifacts: readonly Artifact[];
  readonly retrieval: RetrievalSpec;
  readonly reasoning: ReasonerOutput & {
    readonly model: { readonly name: string; readonly version: string };
  };
  readonly controlResults: readonly ControlResult[];
  readonly findings: readonly Finding[];
  readonly reviews: readonly HumanReview[];
  readonly conclusion: Conclusion;
  readonly searchTags: readonly string[];
}
