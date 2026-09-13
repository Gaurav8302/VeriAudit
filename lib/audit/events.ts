/**
 * The event manager: `AuditResult` → the causal event chain.
 *
 * Two outputs from one structure, per docs/EVENT_MODEL.md §3:
 *
 *   ALL events      every stage fanned out — 4 artifacts, 12 controls, 3 findings.
 *                   30 events for the financial hero. This is the product record.
 *   CANONICAL 9     one representative per stage, and the events that get sealed.
 *                   9 × 30 KB ≈ 270 KB instead of 900 KB for evidence nobody opens.
 *
 * The canonical nine are chosen so they form an **unbroken parent chain** from
 * `audit.started` to `conclusion.created`. That is not cosmetic: it is what
 * makes "reconstruct why this conclusion happened" answerable using only the
 * sealed events, with no unsealed gap in the middle.
 */
import { stepAt } from "./engine";
import { eventId as mintEventId } from "./ids";
import type { AuditResult, AuditScenario, JsonValue } from "./types";
import type { VeriAuditEvent } from "@/lib/cool/types";

/**
 * A product event: a `VeriAuditEvent` (what CooL commits) plus the references
 * the UI needs and the flag saying whether it was sealed.
 */
export interface AuditEvent extends VeriAuditEvent {
  readonly findingRef: string | null;
  readonly reviewRef: string | null;
  readonly controlRef: string | null;
  /** True for the canonical representatives — the ones sent to CooL. */
  readonly canonical: boolean;
}

export interface EventChain {
  readonly events: readonly AuditEvent[];
  /** The canonical representatives, in causal order. Sealed by `run.ts`. */
  readonly canonical: readonly AuditEvent[];
  readonly rootEventId: string;
}

/** Mutable while building; frozen into `AuditEvent` on the way out. */
interface Draft {
  type: VeriAuditEvent["type"];
  actor: VeriAuditEvent["actor"];
  title: string;
  summary: string;
  detail: Record<string, JsonValue>;
  artifactRefs: string[];
  parentKey: string | null;
  /** Stable key used to wire parents before ids exist. */
  key: string;
  canonical: boolean;
  findingRef?: string | null;
  reviewRef?: string | null;
  controlRef?: string | null;
  inputPayload?: string;
  outputPayload?: string;
}

export function buildEventChain<E>(
  scenario: AuditScenario<E>,
  result: AuditResult,
): EventChain {
  const drafts: Draft[] = [];
  const primaryArtifact = result.artifacts[0];
  if (!primaryArtifact) {
    throw new TypeError(`scenario ${scenario.scenarioId} has no artifacts to ingest`);
  }

  // ── audit.started ─────────────────────────────────────────────────────────
  drafts.push({
    key: "audit.started",
    type: "audit.started",
    actor: "system",
    title: `${result.title} opened`,
    summary:
      `Engagement opened for period ${result.period} with ` +
      `${result.controlResults.length} controls in scope.`,
    detail: {
      period: result.period,
      scenario: result.scenarioId,
      controls_in_scope: result.controlResults.length,
      artifacts_in_scope: result.artifacts.length,
    },
    artifactRefs: [],
    parentKey: null,
    canonical: true,
  });

  // ── artifact.ingested × N ─────────────────────────────────────────────────
  result.artifacts.forEach((artifact, index) => {
    drafts.push({
      key: `artifact.ingested:${artifact.artifactId}`,
      type: "artifact.ingested",
      actor: "system",
      title: `Evidence ingested: ${artifact.title}`,
      summary: `${artifact.title} entered the audit scope.`,
      detail: {
        artifact_id: artifact.artifactId,
        kind: artifact.kind,
        rows: artifact.rows,
        artifact_count: result.artifacts.length,
        position: index + 1,
      },
      artifactRefs: [artifact.artifactId],
      parentKey: "audit.started",
      // The first artifact represents the stage; its detail carries the count.
      canonical: index === 0,
      inputPayload: artifact.content,
    });
  });

  // ── artifact.parsed × N ───────────────────────────────────────────────────
  result.artifacts.forEach((artifact, index) => {
    drafts.push({
      key: `artifact.parsed:${artifact.artifactId}`,
      type: "artifact.parsed",
      actor: "ai",
      title: `Parsed: ${artifact.title}`,
      summary: `${artifact.title} interpreted into structured figures.`,
      detail: {
        artifact_id: artifact.artifactId,
        parsed_fields: Object.keys(artifact.parsed).sort(),
        parsed_count: result.artifacts.length,
        failed_count: 0,
      },
      artifactRefs: [artifact.artifactId],
      parentKey: `artifact.ingested:${artifact.artifactId}`,
      canonical: index === 0,
      outputPayload: JSON.stringify(artifact.parsed),
    });
  });

  // ── retrieval.executed ────────────────────────────────────────────────────
  drafts.push({
    key: "retrieval.executed",
    type: "retrieval.executed",
    actor: "ai",
    title: "Relevant evidence retrieved",
    summary:
      `${result.retrieval.passages.length} passages retrieved for ` +
      `"${result.retrieval.query}".`,
    detail: {
      query: result.retrieval.query,
      hits: result.retrieval.passages.length,
      retrieved_artifact_ids: [...result.retrieval.artifactIds].sort(),
    },
    artifactRefs: [...result.retrieval.artifactIds],
    // Parented to the PRIMARY artifact's parse, keeping the canonical chain
    // connected. The other parses are siblings.
    parentKey: `artifact.parsed:${primaryArtifact.artifactId}`,
    canonical: true,
    outputPayload: JSON.stringify(result.retrieval.passages),
  });

  // ── model.executed ────────────────────────────────────────────────────────
  drafts.push({
    key: "model.executed",
    type: "model.executed",
    actor: "ai",
    title: "Reasoning step executed",
    summary: result.reasoning.assessment,
    detail: {
      model: result.reasoning.model.name,
      model_version: result.reasoning.model.version,
      deterministic: true,
      confidence: result.reasoning.confidence,
      observation_count: result.reasoning.observations.length,
    },
    artifactRefs: [...result.retrieval.artifactIds],
    parentKey: "retrieval.executed",
    canonical: true,
    inputPayload: JSON.stringify({
      query: result.retrieval.query,
      passages: result.retrieval.passages,
    }),
    outputPayload: JSON.stringify({
      assessment: result.reasoning.assessment,
      observations: result.reasoning.observations,
    }),
  });

  // ── control.tested × N ────────────────────────────────────────────────────
  // The representative is the control behind the PRIMARY finding, not the
  // first control tested: the one that matters months later is the one that
  // caused the finding being challenged.
  const primaryFinding = result.findings[0] ?? null;
  const representativeControlId = primaryFinding?.controlId ?? result.controlResults[0]?.controlId;

  result.controlResults.forEach((control) => {
    drafts.push({
      key: `control.tested:${control.controlId}`,
      type: "control.tested",
      actor: "ai",
      title: `Control tested: ${control.name}`,
      summary: control.rationale,
      detail: {
        control: control.controlId,
        control_name: control.name,
        category: control.category,
        status: control.status,
        observed: control.observed,
        controls_tested: result.conclusion.controlsTested,
        controls_passed: result.conclusion.controlsPassed,
        exceptions: result.conclusion.exceptions,
      },
      artifactRefs: [...control.artifactIds],
      parentKey: "model.executed",
      canonical: control.controlId === representativeControlId,
      controlRef: control.controlId,
    });
  });

  // ── finding.created × N ───────────────────────────────────────────────────
  // Every finding is its own node: these are the records a reader opens
  // individually, so collapsing them would defeat the point.
  result.findings.forEach((finding, index) => {
    drafts.push({
      key: `finding.created:${finding.findingId}`,
      type: "finding.created",
      actor: "ai",
      title: finding.title,
      summary: finding.description,
      detail: {
        finding_id: finding.findingId,
        control: finding.controlId,
        severity: finding.severity,
        ...(finding.amountUsd === null ? {} : { amount_usd: finding.amountUsd }),
        recommended_action: finding.recommendedAction,
        observed: finding.observed,
        findings_total: result.findings.length,
      },
      artifactRefs: [...finding.evidenceArtifactIds],
      // Evidence → Control → Finding. The finding hangs off the control that
      // produced it, which is what makes the causal claim checkable.
      parentKey: `control.tested:${finding.controlId}`,
      canonical: index === 0,
      findingRef: finding.findingId,
      controlRef: finding.controlId,
      outputPayload: JSON.stringify({
        conclusion: finding.title,
        rationale: finding.rationale,
        observed: finding.observed,
      }),
    });
  });

  // ── human.review.completed × N ────────────────────────────────────────────
  result.reviews.forEach((review, index) => {
    const finding = result.findings.find((f) => f.findingId === review.findingId);
    drafts.push({
      key: `human.review.completed:${review.reviewId}`,
      type: "human.review.completed",
      actor: "human",
      title: `Human verification ${review.decision}: ${finding?.findingId ?? review.findingId}`,
      summary: review.note,
      detail: {
        review_id: review.reviewId,
        finding_id: review.findingId,
        reviewer: review.reviewer.name,
        reviewer_role: review.reviewer.role,
        decision: review.decision,
        ...(review.modifiedSeverity === null
          ? {}
          : { modified_severity: review.modifiedSeverity }),
        ...(finding?.originalSeverity ? { original_severity: finding.originalSeverity } : {}),
      },
      artifactRefs: finding ? [...finding.evidenceArtifactIds] : [],
      parentKey: `finding.created:${review.findingId}`,
      canonical: index === 0,
      findingRef: review.findingId,
      reviewRef: review.reviewId,
    });
  });

  // ── conclusion.created ────────────────────────────────────────────────────
  // Parented to the review of the PRIMARY finding so the canonical nine stay a
  // single connected path. Causally the conclusion follows every review; the
  // spine follows the one being reconstructed.
  const primaryReview = result.reviews[0] ?? null;
  const conclusionParent = primaryReview
    ? `human.review.completed:${primaryReview.reviewId}`
    : primaryFinding
      ? `finding.created:${primaryFinding.findingId}`
      : "model.executed";

  drafts.push({
    key: "conclusion.created",
    type: "conclusion.created",
    actor: "system",
    title: "Audit conclusion recorded",
    summary: result.conclusion.statement,
    detail: {
      controls_tested: result.conclusion.controlsTested,
      controls_passed: result.conclusion.controlsPassed,
      exceptions: result.conclusion.exceptions,
      findings: result.conclusion.findings,
      human_reviews_completed: result.conclusion.humanReviewsCompleted,
      human_reviews_pending: result.conclusion.humanReviewsPending,
      human_review_completed: result.conclusion.humanReviewCompleted,
    },
    artifactRefs: result.artifacts.map((a) => a.artifactId),
    parentKey: conclusionParent,
    canonical: true,
    outputPayload: JSON.stringify(result.conclusion),
  });

  return materialise(scenario, result, drafts);
}

/** Assign ids, sequences, logical times, and resolve parent keys to ids. */
function materialise<E>(
  scenario: AuditScenario<E>,
  result: AuditResult,
  drafts: readonly Draft[],
): EventChain {
  const idByKey = new Map<string, string>();
  drafts.forEach((draft, index) => idByKey.set(draft.key, mintEventId(scenario, index)));

  const events: AuditEvent[] = drafts.map((draft, index) => {
    const parentEventId = draft.parentKey === null ? null : idByKey.get(draft.parentKey) ?? null;
    if (draft.parentKey !== null && parentEventId === null) {
      throw new Error(`event ${draft.key} names an unknown parent ${draft.parentKey}`);
    }

    return {
      eventId: idByKey.get(draft.key)!,
      auditId: result.auditId,
      executionId: result.executionId,
      sequence: index,
      type: draft.type,
      actor: draft.actor,
      scenario: result.scenarioId,
      occurredAt: stepAt(scenario, index),
      parentEventId,
      artifactRefs: draft.artifactRefs,
      title: draft.title,
      summary: draft.summary,
      detail: draft.detail,
      ...(draft.inputPayload === undefined ? {} : { inputPayload: draft.inputPayload }),
      ...(draft.outputPayload === undefined ? {} : { outputPayload: draft.outputPayload }),
      findingRef: draft.findingRef ?? null,
      reviewRef: draft.reviewRef ?? null,
      controlRef: draft.controlRef ?? null,
      canonical: draft.canonical,
    };
  });

  const root = events.find((e) => e.parentEventId === null);
  if (!root) throw new Error("event chain has no root");
  if (events.filter((e) => e.parentEventId === null).length !== 1) {
    throw new Error("event chain has more than one root — reconstruction would be ambiguous");
  }

  return {
    events,
    canonical: events.filter((e) => e.canonical),
    rootEventId: root.eventId,
  };
}

/**
 * Walk from an event to the root. The answer to "why did this happen?".
 *
 * Returns root-first, so the caller reads it in causal order. Generic over the
 * event type so a caller passing `SealedEvent[]` gets `SealedEvent[]` back and
 * can still read `cool` off the result.
 */
export function ancestorsOf<E extends AuditEvent>(
  events: readonly E[],
  eventId: string,
): E[] {
  const byId = new Map(events.map((e) => [e.eventId, e]));
  const path: E[] = [];
  const guard = new Set<string>();

  let current = byId.get(eventId) ?? null;
  while (current) {
    if (guard.has(current.eventId)) {
      throw new Error(`event chain contains a cycle at ${current.eventId}`);
    }
    guard.add(current.eventId);
    path.push(current);
    current = current.parentEventId ? byId.get(current.parentEventId) ?? null : null;
  }

  return path.reverse();
}

/** Direct children of an event, in sequence order. The graph's forward edges. */
export function childrenOf<E extends AuditEvent>(
  events: readonly E[],
  eventId: string,
): E[] {
  return events
    .filter((e) => e.parentEventId === eventId)
    .sort((a, b) => a.sequence - b.sequence);
}
