/**
 * Live human review: a reviewer's decision, recorded as a new sealed event.
 *
 * Two things produce reviews in VeriAudit, and the difference matters:
 *
 *   BASELINE  the scenario's `reviewPolicy.decisions`. Deterministic, part of
 *             the reproducible audit result, sealed with the canonical nine.
 *   LIVE      this module. A person acting now, appended to the chain and
 *             sealed on its own. Not part of the deterministic baseline.
 *
 * Events are append-only (docs/EVENT_MODEL.md §3 rule 5), so a live decision
 * never edits the baseline review — it adds a `human.review.completed` event
 * whose parent is the same `finding.created` event. A reader sees both, in
 * order, which is the honest representation of "the reviewer changed their
 * mind".
 *
 * Sequence numbering is the CALLER's responsibility, like `logState`: the
 * server is stateless and cannot know how many events the session already
 * holds. See docs/ARCHITECTURE.md §4.
 */
import { recordEvent } from "@/lib/cool/recorder";
import type { CoolReference } from "@/lib/cool/types";
import { runAudit } from "./engine";
import { buildEventChain, type AuditEvent } from "./events";
import { eventId as mintEventId } from "./ids";
import type { AuditScenario, Finding, HumanReview, ReviewDecision, Severity } from "./types";

const DECISIONS: readonly ReviewDecision[] = ["accepted", "modified", "rejected"];
const SEVERITIES: readonly Severity[] = ["high", "medium", "low"];

export interface ReviewSubmission {
  readonly findingId: string;
  readonly decision: ReviewDecision;
  readonly note: string;
  readonly reviewer?: { readonly name: string; readonly role: string };
  readonly modifiedSeverity?: Severity;
  /** Logical time of the decision. Defaults to now, because this one is real. */
  readonly reviewedAt?: string;
  /** Position in the caller's chain. Defaults to appending after the baseline. */
  readonly sequence?: number;
  readonly logState?: unknown;
}

export interface ReviewOutcome {
  readonly review: HumanReview;
  /** The finding as it stands after this decision. */
  readonly finding: Finding;
  readonly event: AuditEvent & { readonly cool: CoolReference | null };
  readonly sealing: { readonly sealed: boolean; readonly error: string | null };
  readonly logState: readonly string[];
  readonly receipt: { readonly receiptRef: string; readonly evidence: unknown } | null;
}

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

export async function submitReview<E>(
  scenario: AuditScenario<E>,
  submission: ReviewSubmission,
): Promise<ReviewOutcome> {
  const result = runAudit(scenario);
  const chain = buildEventChain(scenario, result);

  const finding = result.findings.find((f) => f.findingId === submission.findingId);
  if (!finding) {
    throw new ReviewError(
      `finding ${submission.findingId} does not exist in ${scenario.auditId}`,
      404,
    );
  }
  if (!finding.reviewRequired) {
    throw new ReviewError(
      `finding ${finding.findingId} does not require human review under this scenario's policy`,
      409,
    );
  }
  if (!DECISIONS.includes(submission.decision)) {
    throw new ReviewError(
      `decision must be one of ${DECISIONS.join(", ")} (received ${String(submission.decision)})`,
      400,
    );
  }
  if (typeof submission.note !== "string" || submission.note.trim() === "") {
    throw new ReviewError("a review note is required — an unexplained decision is not auditable", 400);
  }
  if (submission.decision === "modified") {
    if (!submission.modifiedSeverity || !SEVERITIES.includes(submission.modifiedSeverity)) {
      throw new ReviewError(
        `a modified decision requires modifiedSeverity (one of ${SEVERITIES.join(", ")})`,
        400,
      );
    }
  } else if (submission.modifiedSeverity) {
    throw new ReviewError(
      `modifiedSeverity is only meaningful with decision "modified"`,
      400,
    );
  }

  const parent = chain.events.find(
    (e) => e.type === "finding.created" && e.findingRef === finding.findingId,
  );
  if (!parent) {
    throw new ReviewError(`no finding.created event for ${finding.findingId}`, 409);
  }

  const reviewer = submission.reviewer ?? scenario.reviewPolicy.reviewer;
  const reviewedAt = submission.reviewedAt ?? new Date().toISOString();
  const sequence = submission.sequence ?? chain.events.length;
  // Distinguished from the baseline `REV-…-00n` so the two are never confused.
  const reviewId = `REV-${finding.findingId.replace(/^F-/, "")}-L${String(sequence).padStart(3, "0")}`;

  const severity = submission.modifiedSeverity ?? finding.severity;

  const review: HumanReview = {
    reviewId,
    findingId: finding.findingId,
    reviewer,
    decision: submission.decision,
    note: submission.note,
    reviewedAt,
    modifiedSeverity: submission.modifiedSeverity ?? null,
  };

  const event: AuditEvent = {
    eventId: mintEventId(scenario, sequence),
    auditId: scenario.auditId,
    executionId: scenario.executionId,
    sequence,
    type: "human.review.completed",
    actor: "human",
    scenario: scenario.scenarioId,
    occurredAt: reviewedAt,
    parentEventId: parent.eventId,
    artifactRefs: [...finding.evidenceArtifactIds],
    title: `Human verification ${submission.decision}: ${finding.findingId}`,
    summary: submission.note,
    detail: {
      review_id: reviewId,
      finding_id: finding.findingId,
      reviewer: reviewer.name,
      reviewer_role: reviewer.role,
      decision: submission.decision,
      ...(submission.modifiedSeverity ? { modified_severity: submission.modifiedSeverity } : {}),
      original_severity: finding.severity,
      control: finding.controlId,
      live: true,
    },
    findingRef: finding.findingId,
    reviewRef: reviewId,
    controlRef: finding.controlId,
    canonical: true,
  };

  const updated: Finding = {
    ...finding,
    severity,
    status: submission.decision,
    reviewId,
    originalSeverity: submission.modifiedSeverity ? finding.severity : finding.originalSeverity,
  };

  try {
    const sealed = await recordEvent(event, submission.logState ?? []);
    const recorded = sealed.recorded[0]!;
    return {
      review,
      finding: updated,
      event: { ...event, cool: recorded.reference },
      sealing: { sealed: true, error: null },
      logState: sealed.logState,
      receipt: { receiptRef: recorded.reference.receiptRef, evidence: recorded.receipt },
    };
  } catch (error) {
    return {
      review,
      finding: updated,
      event: { ...event, cool: null },
      sealing: {
        sealed: false,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      },
      logState: Array.isArray(submission.logState) ? (submission.logState as string[]) : [],
      receipt: null,
    };
  }
}
