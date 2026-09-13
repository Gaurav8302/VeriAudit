/**
 * Build the searchable corpus from the simulation + the four real scenarios.
 *
 * Audits and activities come from `generateHistory`. Findings and events
 * come from `runAudit` / `buildEventChain` — the same deterministic engine
 * output, not a replacement execution. Catalog-only audits have no events.
 */
import { buildEventChain, runAudit, SCENARIOS } from "@/lib/audit";
import { generateHistory, type SimulationResult } from "@/lib/simulation";
import type { SearchDoc } from "./types";

const WEIGHT = { audit: 3.0, finding: 2.5, activity: 1.0, event: 0.8 } as const;

export function buildCorpus(simulation: SimulationResult = generateHistory()): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const audit of simulation.audits) {
    docs.push({
      id: `audit:${audit.auditId}`,
      kind: "audit",
      entityWeight: WEIGHT.audit,
      title: audit.title,
      description: audit.summary
        ? `${audit.summary.controlsTested} controls, ${audit.summary.exceptions} exceptions`
        : audit.title,
      body: `${audit.title} ${audit.period} ${audit.searchTags.join(" ")}`,
      tags: [...audit.searchTags, audit.auditId, ...audit.executionIds],
      type: "audit",
      domain: audit.scenario,
      auditId: audit.auditId,
      executionId: audit.executionIds[0] ?? null,
      activityId: null,
      eventId: null,
      findingId: null,
      occurredAt: audit.openedAt,
      status: audit.status,
      coolBacked: audit.isHero,
    });
  }

  for (const activity of simulation.activities) {
    docs.push({
      id: `activity:${activity.activityId}`,
      kind: "activity",
      entityWeight: WEIGHT.activity,
      title: activity.title,
      description: activity.description,
      body: `${activity.description} ${activity.type} ${activity.findingId ?? ""}`,
      tags: [
        ...activity.searchTags,
        activity.auditId,
        activity.executionId ?? "",
        activity.findingId ?? "",
        activity.type,
        activity.scenario,
      ].filter((tag): tag is string => Boolean(tag)),
      type: activity.type,
      domain: activity.scenario,
      auditId: activity.auditId ?? "",
      executionId: activity.executionId,
      activityId: activity.activityId,
      eventId: null,
      findingId: activity.findingId,
      occurredAt: activity.occurredAt,
      status: activity.status,
      coolBacked: activity.coolBacked,
    });
  }

  for (const scenario of SCENARIOS) {
    const result = runAudit(scenario);
    const chain = buildEventChain(scenario, result);

    for (const finding of result.findings) {
      const amountTags =
        finding.amountUsd === null
          ? []
          : [
              String(finding.amountUsd),
              finding.amountUsd === 1_420_000 ? "1.42M" : "",
            ].filter(Boolean);
      docs.push({
        id: `finding:${finding.findingId}`,
        kind: "finding",
        entityWeight: WEIGHT.finding,
        title: finding.title,
        description: finding.rationale,
        body: `${finding.description} ${finding.rationale} ${finding.recommendedAction} ${finding.controlId} ${finding.severity}`,
        tags: [
          finding.findingId,
          finding.controlId,
          finding.severity,
          finding.auditId,
          finding.executionId,
          ...amountTags,
        ],
        type: "finding",
        domain: result.scenarioId,
        auditId: finding.auditId,
        executionId: finding.executionId,
        activityId: null,
        eventId: null,
        findingId: finding.findingId,
        occurredAt: result.openedAt,
        status: finding.status,
        coolBacked: result.isHero,
      });
    }

    for (const event of chain.events) {
      docs.push({
        id: `event:${event.eventId}`,
        kind: "event",
        entityWeight: WEIGHT.event,
        title: event.title,
        description: event.summary,
        body: `${event.summary} ${event.type} ${event.controlRef ?? ""} ${event.findingRef ?? ""}`,
        tags: [
          event.eventId,
          event.type,
          event.auditId,
          event.executionId,
          event.controlRef ?? "",
          event.findingRef ?? "",
        ].filter(Boolean),
        type: event.type,
        domain: result.scenarioId,
        auditId: event.auditId,
        executionId: event.executionId,
        activityId: null,
        eventId: event.eventId,
        findingId: event.findingRef,
        occurredAt: event.occurredAt,
        status: "completed",
        coolBacked: event.canonical && result.isHero,
      });
    }
  }

  docs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return docs;
}
