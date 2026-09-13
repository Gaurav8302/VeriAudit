/**
 * Canonical product execution events.
 *
 * These records are the thing CooL seals: references and commitments, not raw
 * documents, prompts, or chat text. Product event names live in `detail` so
 * the existing CooL EventType vocabulary stays unchanged.
 */
import type { Actor, EventType, JsonValue, Scenario, VeriAuditEvent } from "@/lib/cool/types";
import type { ProductDomain } from "./workspace";
import { getWorkspaceAudit, HERO_EXECUTION_ID } from "./workspace";
import {
  actionsFor,
  activitiesFor,
  evidenceFor,
  findingsFor,
  getLocalAudit,
  type ActivityType,
  type LocalActivity,
  type LocalAiAction,
  type LocalEvidence,
  type LocalFinding,
  type WorkspaceState,
} from "./localWorkspace";
import type { ProductExecution } from "./lineage";
import type { EvidenceBinding, FindingBinding, ProductEventName } from "./sealTypes";

export interface SealSnapshot {
  readonly auditId: string;
  readonly auditTitle: string;
  readonly domain: ProductDomain;
  readonly execution: {
    readonly executionId: string;
    readonly sequence: number;
    readonly label: string;
    readonly createdAt: string;
    readonly status: ProductExecution["status"];
    readonly parentExecutionId: string | null;
    readonly closedAt?: string | null;
    readonly immutable: boolean;
  };
  readonly evidence: readonly {
    readonly artifactId: string;
    readonly title: string;
    readonly kind: string;
    readonly filename: string | null;
    readonly fingerprint: string | null;
  }[];
  readonly findings: readonly {
    readonly findingId: string;
    readonly title: string;
    readonly severity: string;
    readonly review: string;
    readonly reviewNote: string | null;
    readonly evidenceIds: readonly string[];
    readonly originatingActionId: string | null;
    readonly origin: string;
  }[];
  readonly actions: readonly {
    readonly actionId: string;
    readonly type: string;
    readonly title: string;
    readonly status: string;
    readonly evidenceIds: readonly string[];
    readonly chunkIds: readonly string[];
    readonly findingId: string | null;
    readonly occurredAt: string;
    readonly completedAt: string | null;
  }[];
  readonly activities: readonly {
    readonly activityId: string;
    readonly type: ActivityType;
    readonly title: string;
    readonly occurredAt: string;
    readonly actor: LocalActivity["actor"];
    readonly subjectId: string | null;
  }[];
}

const ACTIVITY_TO_PRODUCT: Partial<Record<ActivityType, ProductEventName>> = {
  "execution.opened": "audit.execution.started",
  "evidence.added": "evidence.ingested",
  "evidence.uploaded": "evidence.ingested",
  "ai.action.started": "ai.action.started",
  "ai.action.completed": "ai.action.completed",
  "finding.created": "finding.created",
  "finding.reviewed": "finding.reviewed",
  "execution.closed": "audit.execution.closed",
};

export const PRODUCT_TO_COOL: Record<ProductEventName, EventType> = {
  "audit.execution.started": "audit.started",
  "evidence.ingested": "artifact.ingested",
  "evidence.read": "retrieval.executed",
  "ai.action.started": "model.executed",
  "ai.action.completed": "model.executed",
  "finding.created": "finding.created",
  "finding.reviewed": "human.review.completed",
  "audit.execution.closed": "conclusion.created",
};

const PRODUCT_RANK: Record<ProductEventName, number> = {
  "audit.execution.started": 0,
  "evidence.ingested": 1,
  "evidence.read": 2,
  "ai.action.started": 3,
  "ai.action.completed": 4,
  "finding.created": 5,
  "finding.reviewed": 6,
  "audit.execution.closed": 7,
};

export const MAX_PRODUCT_EVENTS = 32;

export function scenarioOf(domain: ProductDomain): Scenario {
  if (domain === "legal") return "legal";
  if (domain === "cyber" || domain === "access") return "cyber";
  if (domain === "procurement" || domain === "vendor") return "procurement";
  return "financial";
}

export function actorOf(actor: LocalActivity["actor"]): Actor {
  return actor === "VeriAudit" ? "ai" : "human";
}

function pad(value: number): string {
  return String(value).padStart(3, "0");
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function evidenceBindings(
  ids: readonly string[],
  evidence: SealSnapshot["evidence"],
): EvidenceBinding[] {
  return sorted(ids).map((evidenceId) => {
    const match = evidence.find((item) => item.artifactId === evidenceId);
    return {
      evidenceId,
      fingerprint: match?.fingerprint ?? null,
    };
  });
}

function findingBindings(
  ids: readonly string[],
  findings: SealSnapshot["findings"],
): FindingBinding[] {
  return sorted(ids).map((findingId) => {
    const match = findings.find((item) => item.findingId === findingId);
    return {
      findingId,
      review: match?.review ?? "pending",
      origin: match?.origin ?? "user",
    };
  });
}

interface DraftEvent {
  readonly at: string;
  readonly productEvent: ProductEventName;
  readonly title: string;
  readonly actor: Actor;
  readonly evidenceIds: readonly string[];
  readonly findingIds: readonly string[];
  readonly actionId: string | null;
  readonly chunkIds: readonly string[];
  readonly extra: Record<string, JsonValue>;
}

function draftsFromSnapshot(snapshot: SealSnapshot): DraftEvent[] {
  const drafts: DraftEvent[] = [];

  for (const activity of snapshot.activities) {
    const productEvent = ACTIVITY_TO_PRODUCT[activity.type];
    if (!productEvent) continue;

    let evidenceIds: string[] = [];
    let findingIds: string[] = [];
    let actionId: string | null = null;
    let chunkIds: string[] = [];
    const extra: Record<string, JsonValue> = {};

    if (productEvent === "evidence.ingested") {
      const evidence = snapshot.evidence.find((item) => item.artifactId === activity.subjectId);
      if (evidence) {
        evidenceIds = [evidence.artifactId];
        extra.filename = evidence.filename;
        extra.kind = evidence.kind;
      }
    }

    if (productEvent === "ai.action.started" || productEvent === "ai.action.completed") {
      const action = snapshot.actions.find((item) => item.actionId === activity.subjectId);
      if (action) {
        actionId = action.actionId;
        evidenceIds = [...action.evidenceIds];
        chunkIds = [...action.chunkIds];
        if (action.findingId) findingIds = [action.findingId];
        extra.action_type = action.type;
        extra.action_status = action.status;
        if (productEvent === "ai.action.completed") {
          extra.output_commitment = {
            action_id: action.actionId,
            action_type: action.type,
            evidence_ids: sorted(action.evidenceIds),
            chunk_ids: sorted(action.chunkIds),
            finding_id: action.findingId,
          };
        }
      }
    }

    if (productEvent === "finding.created") {
      const finding = snapshot.findings.find((item) => item.findingId === activity.subjectId);
      if (finding) {
        findingIds = [finding.findingId];
        evidenceIds = [...finding.evidenceIds];
        extra.finding_title = finding.title;
        extra.severity = finding.severity;
        extra.origin = finding.origin;
        extra.originating_action_id = finding.originatingActionId;
      }
    }

    if (productEvent === "finding.reviewed") {
      const finding = snapshot.findings.find((item) => item.findingId === activity.subjectId);
      if (finding) {
        findingIds = [finding.findingId];
        evidenceIds = [...finding.evidenceIds];
        extra.reviewer_type = "human";
        extra.decision = finding.review;
        extra.origin = finding.origin;
        extra.review_note = finding.reviewNote;
      }
    }

    if (productEvent === "audit.execution.closed") {
      extra.closed_at = snapshot.execution.closedAt ?? activity.occurredAt;
      extra.parent_execution_id = snapshot.execution.parentExecutionId;
    }

    if (productEvent === "audit.execution.started") {
      extra.parent_execution_id = snapshot.execution.parentExecutionId;
      extra.execution_label = snapshot.execution.label;
    }

    drafts.push({
      at: activity.occurredAt,
      productEvent,
      title: activity.title,
      actor: actorOf(activity.actor),
      evidenceIds,
      findingIds,
      actionId,
      chunkIds,
      extra,
    });
  }

  for (const action of snapshot.actions) {
    if (action.type !== "READ_EVIDENCE" || action.status !== "completed") continue;
    drafts.push({
      at: action.completedAt ?? action.occurredAt,
      productEvent: "evidence.read",
      title: action.title,
      actor: "ai",
      evidenceIds: action.evidenceIds,
      findingIds: action.findingId ? [action.findingId] : [],
      actionId: action.actionId,
      chunkIds: action.chunkIds,
      extra: {
        action_type: action.type,
        chunk_ids: sorted(action.chunkIds),
      },
    });
  }

  return drafts.sort((a, b) => {
    const byTime = a.at.localeCompare(b.at);
    if (byTime !== 0) return byTime;
    const byRank = PRODUCT_RANK[a.productEvent] - PRODUCT_RANK[b.productEvent];
    if (byRank !== 0) return byRank;
    return a.title.localeCompare(b.title);
  });
}

export function eventsFromSnapshot(snapshot: SealSnapshot): VeriAuditEvent[] {
  if (snapshot.execution.executionId === HERO_EXECUTION_ID) {
    throw new Error("The sealed original execution cannot be sealed again.");
  }

  const drafts = draftsFromSnapshot(snapshot);
  if (drafts.length === 0) {
    throw new Error("This execution has no canonical events to seal.");
  }
  if (drafts.length > MAX_PRODUCT_EVENTS) {
    throw new Error(`Too many canonical events to seal (${drafts.length}; max ${MAX_PRODUCT_EVENTS}).`);
  }

  const scenario = scenarioOf(snapshot.domain);
  const events: VeriAuditEvent[] = [];

  for (const [index, draft] of drafts.entries()) {
    const sequence = index + 1;
    const eventId = `EVT-${snapshot.execution.executionId}-${pad(sequence)}`;
    const parentEventId = events[index - 1]?.eventId ?? null;
    const refs = evidenceBindings(draft.evidenceIds, snapshot.evidence);
    const findings = findingBindings(draft.findingIds, snapshot.findings);
    const detail: Record<string, JsonValue> = {
      product_event: draft.productEvent,
      evidence_refs: refs.map((item) => ({
        evidence_id: item.evidenceId,
        fingerprint: item.fingerprint,
      })),
      finding_refs: findings.map((item) => ({
        finding_id: item.findingId,
        review: item.review,
        origin: item.origin,
      })),
      action_id: draft.actionId,
      chunk_ids: sorted(draft.chunkIds),
      ...draft.extra,
    };

    events.push({
      eventId,
      auditId: snapshot.auditId,
      executionId: snapshot.execution.executionId,
      sequence,
      type: PRODUCT_TO_COOL[draft.productEvent],
      actor: draft.actor,
      scenario,
      occurredAt: draft.at,
      parentEventId,
      artifactRefs: refs.map((item) => item.evidenceId),
      title: draft.title,
      summary: draft.productEvent,
      detail,
    });
  }

  return events;
}

export function buildSealSnapshot(
  state: WorkspaceState,
  auditId: string,
  executionId: string,
): SealSnapshot {
  if (executionId === HERO_EXECUTION_ID) {
    throw new Error("The sealed original execution cannot be sealed again.");
  }

  const local = getLocalAudit(state, auditId);
  const catalog = getWorkspaceAudit(auditId);
  const execution =
    (state.extras[auditId] ?? []).find((item) => item.executionId === executionId) ?? null;
  if (!execution) {
    throw new Error("That execution is not a product execution.");
  }

  const stripEvidence = (item: LocalEvidence) => ({
    artifactId: item.artifactId,
    title: item.title,
    kind: item.kind,
    filename: item.filename,
    fingerprint: item.fingerprint,
  });
  const stripFinding = (item: LocalFinding) => ({
    findingId: item.findingId,
    title: item.title,
    severity: item.severity,
    review: item.review,
    reviewNote: item.reviewNote,
    evidenceIds: item.evidenceIds,
    originatingActionId: item.originatingActionId,
    origin: item.origin,
  });
  const stripAction = (item: LocalAiAction) => ({
    actionId: item.actionId,
    type: item.type,
    title: item.title,
    status: item.status,
    evidenceIds: item.evidenceIds,
    chunkIds: item.chunkIds,
    findingId: item.findingId,
    occurredAt: item.occurredAt,
    completedAt: item.completedAt,
  });

  return {
    auditId,
    auditTitle: local?.title ?? catalog?.title ?? "Audit",
    domain: local?.domain ?? catalog?.domain ?? "financial",
    execution: {
      executionId: execution.executionId,
      sequence: execution.sequence,
      label: execution.label,
      createdAt: execution.createdAt,
      status: execution.status,
      parentExecutionId: execution.parentExecutionId,
      closedAt: execution.closedAt ?? null,
      immutable: execution.immutable,
    },
    evidence: evidenceFor(state, auditId, executionId).map(stripEvidence),
    findings: findingsFor(state, auditId, executionId).map(stripFinding),
    actions: actionsFor(state, auditId, executionId).map(stripAction),
    activities: activitiesFor(state, auditId, executionId).map((item) => ({
      activityId: item.activityId,
      type: item.type,
      title: item.title,
      occurredAt: item.occurredAt,
      actor: item.actor,
      subjectId: item.subjectId ?? null,
    })),
  };
}

export function productEventName(event: VeriAuditEvent): ProductEventName {
  const named = event.detail["product_event"];
  if (typeof named === "string" && named in PRODUCT_TO_COOL) {
    return named as ProductEventName;
  }
  throw new Error(`event ${event.eventId} is missing a product_event name`);
}

export function assertAppendOnlyChain(events: readonly VeriAuditEvent[]): string | null {
  if (events.length === 0) return "the execution has no canonical events";
  if (events[0]!.parentEventId !== null) return "the first event must have no parent";
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.sequence !== index + 1) return `event ${event.eventId} is out of sequence`;
    if (index === 0) continue;
    if (event.parentEventId !== events[index - 1]!.eventId) {
      return `event ${event.eventId} does not continue the recorded parent chain`;
    }
    if (event.executionId !== events[0]!.executionId) {
      return "an event is bound to a different execution";
    }
  }
  return null;
}

export function snapshotHasSensitiveFields(snapshot: SealSnapshot): boolean {
  const encoded = JSON.stringify(snapshot);
  return encoded.includes("textExcerpt") || encoded.includes("\"reply\"") || encoded.includes("\"prompt\"");
}
