/**
 * API response shapes.
 *
 * The frontend must be able to render the audit, the trail, and the integrity
 * badge without knowing anything about `cool-nwc`. So these views expose the
 * compact `CoolReference` and never the ~30 KB receipt envelope — receipts are
 * fetched on demand, per docs/DATA_MODEL.md §5.
 */
import { ancestorsOf, childrenOf, type AuditEvent } from "./events";
import { queryEvents, type EventOrder } from "./query";
import type { AuditRun, SealedEvent } from "./run";
import { ExecutionTrail } from "./trail";
import type { AuditResult, AuditScenario, EventType } from "./types";

/** The engagement brief: what the UI shows before anything runs. */
export function briefView<E>(scenario: AuditScenario<E>) {
  return {
    scenarioId: scenario.scenarioId,
    displayName: scenario.displayName,
    description: scenario.description,
    isHero: scenario.isHero,
    auditId: scenario.auditId,
    executionId: scenario.executionId,
    title: scenario.title,
    period: scenario.period,
    openedAt: scenario.openedAt,
    controlsInScope: scenario.controls.length,
    artifacts: scenario.artifacts.map((a) => ({
      artifactId: a.artifactId,
      kind: a.kind,
      title: a.title,
      mimeType: a.mimeType,
      rows: a.rows,
    })),
    searchTags: scenario.searchTags,
  };
}

/** The result card plus everything an audit detail page needs. */
export function auditView<E>(scenario: AuditScenario<E>, result: AuditResult) {
  return {
    ...briefView(scenario),
    summary: {
      controlsTested: result.conclusion.controlsTested,
      controlsPassed: result.conclusion.controlsPassed,
      exceptions: result.conclusion.exceptions,
      findings: result.conclusion.findings,
      humanReviewsCompleted: result.conclusion.humanReviewsCompleted,
      humanReviewsPending: result.conclusion.humanReviewsPending,
      humanReviewCompleted: result.conclusion.humanReviewCompleted,
    },
    conclusion: result.conclusion,
    reasoning: result.reasoning,
    retrieval: result.retrieval,
    controls: result.controlResults,
    findings: result.findings,
    reviews: result.reviews,
  };
}

/** Full evidence, including plaintext, so a judge can recompute a commitment. */
export function evidenceView<E>(scenario: AuditScenario<E>) {
  return scenario.artifacts.map((a) => ({
    artifactId: a.artifactId,
    kind: a.kind,
    title: a.title,
    mimeType: a.mimeType,
    rows: a.rows,
    content: a.content,
    parsed: a.parsed,
  }));
}

/**
 * One event, without its committed payloads.
 *
 * `inputPayload` and `outputPayload` are the plaintexts behind the commitments
 * and are deliberately omitted from list responses: they carry artifact content
 * and would make the trail response several times larger than it needs to be.
 */
export function eventView(event: SealedEvent | AuditEvent) {
  const { inputPayload, outputPayload, ...rest } = event as SealedEvent;
  return {
    ...rest,
    cool: "cool" in event ? ((event as SealedEvent).cool ?? null) : null,
    committed: {
      input: inputPayload !== undefined,
      output: outputPayload !== undefined,
    },
  };
}

/**
 * The execution trail: nodes, edges, and the canonical spine.
 *
 * `spine` is the path from the conclusion back to the root — the literal answer
 * to "why did this conclusion happen?" — and it is exactly the set of sealed
 * events, which is what makes the reconstruction verifiable end to end.
 */
export function trailView(
  run: AuditRun,
  query: { type?: EventType; order?: EventOrder } = {},
) {
  const trail = ExecutionTrail.fromRun(run);
  const conclusion = run.events.find((e) => e.type === "conclusion.created");
  const spine = conclusion ? ancestorsOf(run.events, conclusion.eventId) : [];
  const events = query.type === undefined && query.order === undefined
    ? run.events
    : queryEvents(run.events, query);

  return {
    auditId: run.result.auditId,
    executionId: run.result.executionId,
    rootEventId: run.rootEventId,
    counts: {
      events: run.events.length,
      canonical: run.canonicalEventIds.length,
      sealed: run.events.filter((e) => e.cool !== null).length,
      returned: events.length,
      byType: countByType(run.events),
    },
    spineEventIds: spine.map((e) => e.eventId),
    why: trail.whyConclusion(),
    edges: run.events
      .filter((e) => e.parentEventId !== null)
      .map((e) => ({ from: e.parentEventId!, to: e.eventId })),
    events: events.map(eventView),
  };
}

/** Compact execution record — docs/DATA_MODEL.md `Execution` plus the M3 snapshot. */
export function executionView(run: AuditRun) {
  const trail = ExecutionTrail.fromRun(run);
  const snapshot = trail.snapshot();
  const why = trail.whyConclusion();

  return {
    executionId: snapshot.executionId,
    auditId: snapshot.auditId,
    scenarioId: run.result.scenarioId,
    title: run.result.title,
    engine: run.result.reasoning.model,
    startedAt: snapshot.firstEvent?.occurredAt ?? run.result.openedAt,
    completedAt: snapshot.lastEvent?.occurredAt ?? run.result.conclusion.concludedAt,
    eventIds: run.events.map((e) => e.eventId),
    canonicalEventIds: run.canonicalEventIds,
    rootEventId: snapshot.rootEventId,
    eventCount: snapshot.eventCount,
    firstEvent: snapshot.firstEvent,
    lastEvent: snapshot.lastEvent,
    treeHead: snapshot.treeHead,
    coolBacked: snapshot.sealedCount > 0,
    verificationStatus: snapshot.verificationStatus,
    verifiedAt: snapshot.verifiedAt,
    why,
  };
}

/** One node plus its immediate neighbourhood, for the expand interaction. */
export function eventDetailView(run: AuditRun, eventId: string) {
  const event = run.events.find((e) => e.eventId === eventId);
  if (!event) return null;
  return {
    event: { ...eventView(event), inputPayload: event.inputPayload, outputPayload: event.outputPayload },
    ancestors: ancestorsOf(run.events, eventId).map((e) => e.eventId),
    children: childrenOf(run.events, eventId).map((e) => e.eventId),
  };
}

function countByType(events: readonly SealedEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}
