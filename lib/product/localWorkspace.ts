/**
 * Product-level mock workspace: local audits, evidence, findings, and
 * unsealed activity. This is not the audit engine and not CooL.
 */
import {
  applyReopen,
  catalogExecutions,
  HERO_ORIGINAL_SNAPSHOT,
  mergeExecutions,
  snapshotExecution,
  type ProductExecution,
} from "./lineage";
import type { ActionLife, AiActionType, AiMode, AiProviderName, ProposedAction } from "@/lib/ai/types";
import { remapChunkIds, type EvidenceChunk, type EvidenceProcessing, type Grounding, type Confidence, type EvidenceReference } from "@/lib/evidence";
import {
  HERO_AUDIT_ID,
  HERO_EXECUTION_ID,
  type ProductDomain,
  type WorkspaceAudit,
} from "./workspace";

export const WORKSPACE_STORAGE_KEY = "veriaudit.product.workspace.v1";
export const REOPEN_STORAGE_KEY = "veriaudit.product.reopens.v1";

export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingLife = "open" | "under_review" | "resolved";
export type ActivityType =
  | "execution.opened"
  | "evidence.added"
  | "evidence.uploaded"
  | "finding.created"
  | "finding.updated"
  | "finding.reviewed"
  | "ai.action.started"
  | "ai.action.completed"
  | "ai.action.failed"
  | "execution.closed";
export type FindingOrigin = "user" | "ai";
export type FindingReview = "pending" | "accepted" | "modified" | "rejected";
export type EvidenceExtraction = "text" | "unavailable" | "none";

export interface LocalAudit {
  readonly auditId: string;
  readonly title: string;
  readonly domain: ProductDomain;
  readonly description: string;
  readonly reference: string | null;
  readonly createdAt: string;
  readonly status: "open";
  readonly origin: "local";
  readonly period: string | null;
}

export interface LocalEvidence {
  readonly artifactId: string;
  readonly auditId: string;
  readonly executionId: string;
  readonly title: string;
  readonly kind: string;
  readonly source: string;
  readonly description: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly sample: boolean;
  readonly filename: string | null;
  readonly fingerprint: string | null;
  readonly extraction: EvidenceExtraction;
  readonly textExcerpt: string | null;
  readonly byteSize: number | null;
  readonly processingStatus: EvidenceProcessing;
  readonly chunks: readonly EvidenceChunk[];
}

export interface LocalFinding {
  readonly findingId: string;
  readonly auditId: string;
  readonly executionId: string;
  readonly title: string;
  readonly severity: FindingSeverity;
  readonly status: FindingLife;
  readonly description: string;
  readonly evidenceIds: readonly string[];
  readonly createdAt: string;
  readonly origin: FindingOrigin;
  readonly originatingActionId: string | null;
  readonly review: FindingReview;
  readonly reviewNote: string | null;
  readonly chunkIds: readonly string[];
}

export interface LocalMessage {
  readonly messageId: string;
  readonly auditId: string;
  readonly executionId: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly occurredAt: string;
  readonly provider: AiProviderName | null;
  readonly model: string | null;
  readonly requestId: string | null;
  readonly mode: AiMode | null;
  readonly grounding: Grounding | null;
  readonly confidence: Confidence | null;
  readonly references: readonly EvidenceReference[];
}

export interface LocalAiAction {
  readonly actionId: string;
  readonly auditId: string;
  readonly executionId: string;
  readonly type: AiActionType;
  readonly title: string;
  readonly detail: string;
  readonly status: ActionLife;
  readonly evidenceIds: readonly string[];
  readonly findingId: string | null;
  readonly occurredAt: string;
  readonly completedAt: string | null;
  readonly chunkIds: readonly string[];
}

export interface LocalActivity {
  readonly activityId: string;
  readonly auditId: string;
  readonly executionId: string;
  readonly type: ActivityType;
  readonly title: string;
  readonly detail: string;
  readonly occurredAt: string;
  readonly actor: "User" | "VeriAudit";
  readonly sealed: false;
}

export interface WorkspaceState {
  readonly audits: readonly LocalAudit[];
  readonly extras: Readonly<Record<string, readonly ProductExecution[]>>;
  readonly evidence: readonly LocalEvidence[];
  readonly findings: readonly LocalFinding[];
  readonly activities: readonly LocalActivity[];
  readonly messages: readonly LocalMessage[];
  readonly actions: readonly LocalAiAction[];
  readonly selected: Readonly<Record<string, string>>;
}

export const EMPTY_WORKSPACE: WorkspaceState = Object.freeze({
  audits: [],
  extras: {},
  evidence: [],
  findings: [],
  activities: [],
  messages: [],
  actions: [],
  selected: {},
});

export const PRODUCT_DOMAINS: readonly { value: ProductDomain; label: string }[] = [
  { value: "financial", label: "Financial" },
  { value: "legal", label: "Legal" },
  { value: "cyber", label: "Cybersecurity" },
  { value: "procurement", label: "Procurement" },
  { value: "vendor", label: "Vendor Compliance" },
  { value: "access", label: "Access Control" },
];

export const EVIDENCE_TYPES = [
  "Ledger",
  "Contract",
  "Policy",
  "Access log",
  "Approval record",
  "Other",
] as const;

function pad(value: number): string {
  return String(value).padStart(3, "0");
}

function nextCount(ids: readonly string[], prefix: string): number {
  const used = ids
    .map((id) => {
      const match = id.match(new RegExp(`^${prefix}(\\d+)$`));
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => value > 0);
  return (used.length ? Math.max(...used) : 0) + 1;
}

export function migrateReopens(reopens: Record<string, ProductExecution[]>): WorkspaceState {
  return {
    ...EMPTY_WORKSPACE,
    extras: reopens,
  };
}

function asEvidence(item: LocalEvidence): LocalEvidence {
  return {
    ...item,
    processingStatus: item.processingStatus ?? (item.extraction === "text" ? "ready" : "ready"),
    chunks: item.chunks ?? [],
  };
}

function asFinding(item: LocalFinding): LocalFinding {
  return { ...item, chunkIds: item.chunkIds ?? [] };
}

function asMessage(item: LocalMessage): LocalMessage {
  return {
    ...item,
    grounding: item.grounding ?? null,
    confidence: item.confidence ?? null,
    references: item.references ?? [],
  };
}

function asAction(item: LocalAiAction): LocalAiAction {
  return { ...item, chunkIds: item.chunkIds ?? [] };
}

export function parseWorkspace(raw: unknown): WorkspaceState {
  if (!raw || typeof raw !== "object") return EMPTY_WORKSPACE;
  const value = raw as Partial<WorkspaceState>;
  return {
    audits: Array.isArray(value.audits) ? value.audits : [],
    extras: value.extras && typeof value.extras === "object" ? value.extras : {},
    evidence: Array.isArray(value.evidence) ? value.evidence.map(asEvidence) : [],
    findings: Array.isArray(value.findings) ? value.findings.map(asFinding) : [],
    activities: Array.isArray(value.activities) ? value.activities : [],
    messages: Array.isArray(value.messages) ? value.messages.map(asMessage) : [],
    actions: Array.isArray(value.actions) ? value.actions.map(asAction) : [],
    selected: value.selected && typeof value.selected === "object" ? value.selected : {},
  };
}

export function hydrateWorkspaceExecutions(
  state: WorkspaceState,
  executions: readonly ProductExecution[],
): ProductExecution[] {
  return executions.map((execution) => {
    if (execution.hasEngineTrail) return execution;
    return {
      ...execution,
      eventCount: state.actions.filter(
        (item) => item.executionId === execution.executionId && item.status === "completed",
      ).length,
      findingCount: findingsFor(state, execution.auditId, execution.executionId).length,
    };
  });
}

export function executionsOf(state: WorkspaceState, auditId: string): ProductExecution[] {
  return hydrateWorkspaceExecutions(state, mergeExecutions(auditId, state.extras[auditId] ?? []));
}

export function isHeroOriginal(executionId: string): boolean {
  return executionId === HERO_EXECUTION_ID;
}

export function isWritableExecution(execution: ProductExecution | null): boolean {
  return Boolean(execution && !execution.immutable && execution.status === "open");
}

export function assertWritable(state: WorkspaceState, auditId: string, executionId: string): ProductExecution {
  if (isHeroOriginal(executionId)) {
    throw new Error("The sealed original execution cannot be changed.");
  }
  const execution = executionsOf(state, auditId).find((item) => item.executionId === executionId) ?? null;
  if (!execution) {
    throw new Error("That execution is not part of this audit.");
  }
  if (execution.immutable || execution.hasEngineTrail || execution.status === "closed") {
    throw new Error("New work belongs on a later execution. The original record stays unchanged.");
  }
  return execution;
}

function withActivity(
  state: WorkspaceState,
  activity: Omit<LocalActivity, "activityId" | "sealed" | "actor"> & {
    actor?: LocalActivity["actor"];
  },
): WorkspaceState {
  const activityId = `ACT-LOCAL-${pad(nextCount(state.activities.map((item) => item.activityId), "ACT-LOCAL-"))}`;
  return {
    ...state,
    activities: [
      ...state.activities,
      {
        ...activity,
        activityId,
        actor: activity.actor ?? "User",
        sealed: false,
      },
    ],
  };
}

function setExtras(state: WorkspaceState, auditId: string, extras: readonly ProductExecution[]): WorkspaceState {
  const selectedId = extras[extras.length - 1]?.executionId ?? state.selected[auditId];
  return {
    ...state,
    extras: { ...state.extras, [auditId]: extras },
    selected: selectedId ? { ...state.selected, [auditId]: selectedId } : state.selected,
  };
}

export function createAudit(
  state: WorkspaceState,
  input: {
    title: string;
    domain: ProductDomain;
    description: string;
    reference?: string;
    period?: string;
    createdAt?: string;
  },
): { state: WorkspaceState; audit: LocalAudit; execution: ProductExecution } {
  const title = input.title.trim();
  if (!title) throw new Error("Give the audit a name.");
  const n = nextCount(state.audits.map((item) => item.auditId), "AUD-LOCAL-");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const audit: LocalAudit = {
    auditId: `AUD-LOCAL-${pad(n)}`,
    title,
    domain: input.domain,
    description: input.description.trim(),
    reference: input.reference?.trim() || null,
    createdAt,
    status: "open",
    origin: "local",
    period: input.period?.trim() || null,
  };
  const execution: ProductExecution = {
    executionId: `EXEC-LOCAL-${pad(n)}-001`,
    auditId: audit.auditId,
    sequence: 1,
    label: "Execution 001",
    createdAt,
    status: "open",
    parentExecutionId: null,
    eventCount: 0,
    findingCount: 0,
    hasEngineTrail: false,
    immutable: false,
  };
  const next = withActivity(
    {
      ...state,
      audits: [...state.audits, audit],
      extras: { ...state.extras, [audit.auditId]: [execution] },
      selected: { ...state.selected, [audit.auditId]: execution.executionId },
    },
    {
      auditId: audit.auditId,
      executionId: execution.executionId,
      type: "execution.opened",
      title: "Execution opened",
      detail: `${execution.label} started for ${audit.title}`,
      occurredAt: createdAt,
    },
  );
  return { state: next, audit, execution };
}

export function createExecution(
  state: WorkspaceState,
  auditId: string,
  createdAt?: string,
): { state: WorkspaceState; execution: ProductExecution } {
  if (auditId === HERO_AUDIT_ID) {
    const extras = state.extras[auditId] ?? [];
    const { next, extras: updated } = applyReopen(auditId, extras, createdAt);
    const after = setExtras(state, auditId, updated);
    return {
      state: withActivity(after, {
        auditId,
        executionId: next.executionId,
        type: "execution.opened",
        title: "Execution opened",
        detail: `${next.label} reopened from the sealed original`,
        occurredAt: next.createdAt,
      }),
      execution: next,
    };
  }

  const at = createdAt ?? new Date().toISOString();
  const current = executionsOf(state, auditId);
  if (current.some(isWritableExecution)) {
    throw new Error("Close the current execution before opening a new one.");
  }
  const extras = [...(state.extras[auditId] ?? [])];
  const parent = current[current.length - 1] ?? extras[extras.length - 1] ?? null;
  const sequence = current.length + 1;
  const localMatch = auditId.match(/^AUD-LOCAL-(\d+)$/);
  const execution: ProductExecution = {
    executionId: localMatch
      ? `EXEC-LOCAL-${localMatch[1]}-${pad(sequence)}`
      : `${auditId.replace(/^AUD/, "EXEC")}-${pad(sequence)}`,
    auditId,
    sequence,
    label: `Execution ${pad(sequence)}`,
    createdAt: at,
    status: "open",
    parentExecutionId: parent?.executionId ?? null,
    eventCount: 0,
    findingCount: 0,
    hasEngineTrail: false,
    immutable: false,
  };
  const after = setExtras(state, auditId, [...extras.filter((item) => item.executionId !== execution.executionId), execution]);
  return {
    state: withActivity(after, {
      auditId,
      executionId: execution.executionId,
      type: "execution.opened",
      title: "Execution opened",
      detail: parent ? `${execution.label} connected to ${parent.label}` : `${execution.label} started`,
      occurredAt: at,
    }),
    execution,
  };
}

export function closeExecution(
  state: WorkspaceState,
  auditId: string,
  executionId: string,
  closedAt?: string,
): { state: WorkspaceState; execution: ProductExecution } {
  const current = assertWritable(state, auditId, executionId);
  const at = closedAt ?? new Date().toISOString();
  const execution: ProductExecution = {
    ...current,
    status: "closed",
    immutable: true,
    closedAt: at,
  };
  const extras = (state.extras[auditId] ?? []).map((item) =>
    item.executionId === executionId ? execution : item,
  );
  return {
    state: withActivity(
      { ...state, extras: { ...state.extras, [auditId]: extras } },
      {
        auditId,
        executionId,
        type: "execution.closed",
        title: "Execution closed",
        detail: `${current.label} is closed. Later work belongs on a new execution.`,
        occurredAt: at,
      },
    ),
    execution,
  };
}

export function canReopenAudit(state: WorkspaceState, auditId: string): boolean {
  if (auditId === HERO_AUDIT_ID) return true;
  const list = executionsOf(state, auditId);
  return list.length > 0 && !list.some(isWritableExecution);
}

export function findingReviewLabel(review: FindingReview): string {
  if (review === "pending") return "Open";
  if (review === "accepted") return "Accepted";
  if (review === "modified") return "Modified";
  return "Rejected";
}

export function addEvidence(
  state: WorkspaceState,
  input: {
    auditId: string;
    executionId: string;
    title: string;
    kind: string;
    source: string;
    description: string;
    reference?: string;
    createdAt?: string;
    sample?: boolean;
    filename?: string | null;
    fingerprint?: string | null;
    extraction?: EvidenceExtraction;
    textExcerpt?: string | null;
    byteSize?: number | null;
    processingStatus?: EvidenceProcessing;
    chunks?: readonly EvidenceChunk[];
  },
): { state: WorkspaceState; evidence: LocalEvidence } {
  const execution = assertWritable(state, input.auditId, input.executionId);
  const title = input.title.trim();
  if (!title) throw new Error("Give the evidence a name.");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const uploaded = Boolean(input.fingerprint);
  const artifactId = `ART-LOCAL-${pad(nextCount(state.evidence.map((item) => item.artifactId), "ART-LOCAL-"))}`;
  const evidence: LocalEvidence = {
    artifactId,
    auditId: input.auditId,
    executionId: execution.executionId,
    title,
    kind: input.kind,
    source: input.source.trim(),
    description: input.description.trim(),
    reference: input.reference?.trim() || createdAt.slice(0, 10),
    createdAt,
    sample: input.sample ?? !uploaded,
    filename: input.filename ?? null,
    fingerprint: input.fingerprint ?? null,
    extraction: input.extraction ?? "none",
    textExcerpt: input.textExcerpt ?? null,
    byteSize: input.byteSize ?? null,
    processingStatus: input.processingStatus ?? (input.extraction === "text" ? "ready" : "ready"),
    chunks: remapChunkIds(artifactId, input.chunks ?? []),
  };
  return {
    state: withActivity(
      { ...state, evidence: [...state.evidence, evidence] },
      {
        auditId: input.auditId,
        executionId: execution.executionId,
        type: uploaded ? "evidence.uploaded" : "evidence.added",
        title: uploaded ? "Evidence uploaded" : "Evidence added",
        detail: title,
        occurredAt: createdAt,
      },
    ),
    evidence,
  };
}

export function addFinding(
  state: WorkspaceState,
  input: {
    auditId: string;
    executionId: string;
    title: string;
    severity: FindingSeverity;
    status?: FindingLife;
    description: string;
    evidenceIds?: readonly string[];
    createdAt?: string;
    origin?: FindingOrigin;
    originatingActionId?: string | null;
    review?: FindingReview;
    chunkIds?: readonly string[];
  },
): { state: WorkspaceState; finding: LocalFinding } {
  const execution = assertWritable(state, input.auditId, input.executionId);
  const title = input.title.trim();
  if (!title) throw new Error("Give the finding a title.");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const origin = input.origin ?? "user";
  const finding: LocalFinding = {
    findingId: `F-LOCAL-${pad(nextCount(state.findings.map((item) => item.findingId), "F-LOCAL-"))}`,
    auditId: input.auditId,
    executionId: execution.executionId,
    title,
    severity: input.severity,
    status: input.status ?? (origin === "ai" ? "under_review" : "open"),
    description: input.description.trim(),
    evidenceIds: input.evidenceIds ?? [],
    createdAt,
    origin,
    originatingActionId: input.originatingActionId ?? null,
    review: input.review ?? "pending",
    reviewNote: null,
    chunkIds: input.chunkIds ?? [],
  };
  const extras = (state.extras[input.auditId] ?? []).map((item) =>
    item.executionId === execution.executionId
      ? { ...item, findingCount: item.findingCount + 1 }
      : item,
  );
  return {
    state: withActivity(
      {
        ...state,
        findings: [...state.findings, finding],
        extras: { ...state.extras, [input.auditId]: extras },
      },
      {
        auditId: input.auditId,
        executionId: execution.executionId,
        type: "finding.created",
        title: "Finding created",
        detail: title,
        occurredAt: createdAt,
      },
    ),
    finding,
  };
}

export function updateFindingStatus(
  state: WorkspaceState,
  findingId: string,
  status: FindingLife,
  occurredAt?: string,
): { state: WorkspaceState; finding: LocalFinding } {
  const current = state.findings.find((item) => item.findingId === findingId);
  if (!current) throw new Error("That finding does not exist.");
  assertWritable(state, current.auditId, current.executionId);
  const finding = { ...current, status };
  return {
    state: withActivity(
      {
        ...state,
        findings: state.findings.map((item) => (item.findingId === findingId ? finding : item)),
      },
      {
        auditId: current.auditId,
        executionId: current.executionId,
        type: "finding.updated",
        title: "Human review",
        detail: `Finding status changed to ${status.replace("_", " ")}`,
        occurredAt: occurredAt ?? new Date().toISOString(),
      },
    ),
    finding,
  };
}

export function selectExecution(state: WorkspaceState, auditId: string, executionId: string): WorkspaceState {
  const exists = executionsOf(state, auditId).some((item) => item.executionId === executionId);
  if (!exists) throw new Error("That execution is not part of this audit.");
  return { ...state, selected: { ...state.selected, [auditId]: executionId } };
}

export function selectedExecutionId(state: WorkspaceState, auditId: string): string | null {
  const selected = state.selected[auditId];
  const list = executionsOf(state, auditId);
  if (selected && list.some((item) => item.executionId === selected)) return selected;
  const open = [...list].reverse().find((item) => item.status === "open");
  return open?.executionId ?? list[list.length - 1]?.executionId ?? null;
}

export function activitiesFor(state: WorkspaceState, auditId: string, executionId: string): LocalActivity[] {
  return state.activities.filter(
    (item) => item.auditId === auditId && item.executionId === executionId,
  );
}

export function evidenceFor(state: WorkspaceState, auditId: string, executionId?: string): LocalEvidence[] {
  return state.evidence.filter(
    (item) => item.auditId === auditId && (!executionId || item.executionId === executionId),
  );
}

export function findingsFor(state: WorkspaceState, auditId: string, executionId?: string): LocalFinding[] {
  return state.findings.filter(
    (item) => item.auditId === auditId && (!executionId || item.executionId === executionId),
  );
}

export function messagesFor(state: WorkspaceState, auditId: string, executionId: string): LocalMessage[] {
  return state.messages.filter((item) => item.auditId === auditId && item.executionId === executionId);
}

export function actionsFor(state: WorkspaceState, auditId: string, executionId: string): LocalAiAction[] {
  return state.actions.filter((item) => item.auditId === auditId && item.executionId === executionId);
}

export function reviewFinding(
  state: WorkspaceState,
  findingId: string,
  review: Exclude<FindingReview, "pending">,
  note?: string,
  occurredAt?: string,
): { state: WorkspaceState; finding: LocalFinding } {
  const current = state.findings.find((item) => item.findingId === findingId);
  if (!current) throw new Error("That finding does not exist.");
  assertWritable(state, current.auditId, current.executionId);
  const reviewNote = note?.trim() || null;
  if (review === "modified" && !reviewNote) {
    throw new Error("Add a short note explaining the modification.");
  }
  const finding: LocalFinding = {
    ...current,
    review,
    reviewNote,
    status: "resolved",
  };
  return {
    state: withActivity(
      {
        ...state,
        findings: state.findings.map((item) => (item.findingId === findingId ? finding : item)),
      },
      {
        auditId: current.auditId,
        executionId: current.executionId,
        type: "finding.reviewed",
        title: "Human review",
        detail: reviewNote ? `${findingReviewLabel(review)}: ${reviewNote}` : findingReviewLabel(review),
        occurredAt: occurredAt ?? new Date().toISOString(),
      },
    ),
    finding,
  };
}

export function applyAiTurn(
  state: WorkspaceState,
  input: {
    auditId: string;
    executionId: string;
    prompt: string;
    reply: string;
    actions: readonly ProposedAction[];
    provider: AiProviderName;
    model: string;
    requestId: string | null;
    mode: AiMode;
    status: "ok" | "unavailable";
    occurredAt?: string;
    grounding?: Grounding | null;
    confidence?: Confidence | null;
    references?: readonly EvidenceReference[];
  },
): { state: WorkspaceState; findingIds: readonly string[] } {
  const execution = assertWritable(state, input.auditId, input.executionId);
  const at = input.occurredAt ?? new Date().toISOString();
  const userId = `MSG-LOCAL-${pad(nextCount(state.messages.map((item) => item.messageId), "MSG-LOCAL-"))}`;
  let messages: LocalMessage[] = [
    ...state.messages,
    {
      messageId: userId,
      auditId: input.auditId,
      executionId: execution.executionId,
      role: "user",
      content: input.prompt,
      occurredAt: at,
      provider: null,
      model: null,
      requestId: null,
      mode: null,
      grounding: null,
      confidence: null,
      references: [],
    },
  ];
  const assistantId = `MSG-LOCAL-${pad(nextCount(messages.map((item) => item.messageId), "MSG-LOCAL-"))}`;
  messages = [
    ...messages,
    {
      messageId: assistantId,
      auditId: input.auditId,
      executionId: execution.executionId,
      role: "assistant",
      content: input.reply,
      occurredAt: at,
      provider: input.provider,
      model: input.model,
      requestId: input.requestId,
      mode: input.mode,
      grounding: input.grounding ?? null,
      confidence: input.confidence ?? null,
      references: input.references ?? [],
    },
  ];

  let next: WorkspaceState = { ...state, messages };
  const findingIds: string[] = [];

  if (input.status !== "ok") {
    const failed: LocalAiAction = {
      actionId: `ACTN-LOCAL-${pad(nextCount(next.actions.map((item) => item.actionId), "ACTN-LOCAL-"))}`,
      auditId: input.auditId,
      executionId: execution.executionId,
      type: "SUMMARIZE",
      title: "AI analysis unavailable",
      detail: input.reply,
      status: "failed",
      evidenceIds: [],
      findingId: null,
      occurredAt: at,
      completedAt: at,
      chunkIds: [],
    };
    next = withActivity(
      { ...next, actions: [...next.actions, failed] },
      {
        auditId: input.auditId,
        executionId: execution.executionId,
        type: "ai.action.failed",
        title: failed.title,
        detail: failed.detail,
        occurredAt: at,
        actor: "VeriAudit",
      },
    );
    return { state: next, findingIds };
  }

  for (const proposed of input.actions) {
    const actionId = `ACTN-LOCAL-${pad(nextCount(next.actions.map((item) => item.actionId), "ACTN-LOCAL-"))}`;
    const scopedEvidence = proposed.evidenceIds.filter((id) =>
      next.evidence.some((item) => item.artifactId === id && item.executionId === execution.executionId),
    );
    const knownChunks = new Set(
      next.evidence
        .filter((item) => item.executionId === execution.executionId)
        .flatMap((item) => item.chunks.map((chunk) => chunk.chunkId)),
    );
    const scopedChunks = (proposed.chunkIds ?? []).filter((id) => knownChunks.has(id));
    let findingId: string | null = null;
    let working = withActivity(
      {
        ...next,
        actions: [
          ...next.actions,
          {
            actionId,
            auditId: input.auditId,
            executionId: execution.executionId,
            type: proposed.type,
            title: proposed.title,
            detail: proposed.detail,
            status: "started",
            evidenceIds: scopedEvidence,
            findingId: null,
            occurredAt: at,
            completedAt: null,
            chunkIds: scopedChunks,
          },
        ],
      },
      {
        auditId: input.auditId,
        executionId: execution.executionId,
        type: "ai.action.started",
        title: proposed.title,
        detail: proposed.type,
        occurredAt: at,
        actor: "VeriAudit",
      },
    );

    if (proposed.type === "CREATE_FINDING") {
      const created = addFinding(working, {
        auditId: input.auditId,
        executionId: execution.executionId,
        title: proposed.findingTitle ?? proposed.title,
        severity: proposed.findingSeverity ?? "medium",
        description: proposed.findingDescription ?? proposed.detail,
        evidenceIds: scopedEvidence,
        createdAt: at,
        origin: "ai",
        originatingActionId: actionId,
        review: "pending",
        chunkIds: scopedChunks,
      });
      working = created.state;
      findingId = created.finding.findingId;
      findingIds.push(findingId);
    }

    const actions = working.actions.map((item) =>
      item.actionId === actionId ? { ...item, status: "completed" as const, completedAt: at, findingId } : item,
    );
    next = withActivity(
      { ...working, actions },
      {
        auditId: input.auditId,
        executionId: execution.executionId,
        type: "ai.action.completed",
        title: proposed.title,
        detail: findingId ? `${proposed.type} → ${findingId}` : proposed.type,
        occurredAt: at,
        actor: "VeriAudit",
      },
    );
  }

  return { state: next, findingIds };
}

export function getLocalAudit(state: WorkspaceState, auditId: string): LocalAudit | null {
  return state.audits.find((item) => item.auditId === auditId) ?? null;
}

export function asWorkspaceAudit(audit: LocalAudit, state: WorkspaceState): WorkspaceAudit {
  const executions = executionsOf(state, audit.auditId);
  return {
    auditId: audit.auditId,
    title: audit.title,
    domain: audit.domain,
    status: "open",
    period: audit.period ?? audit.createdAt.slice(0, 7),
    openedAt: audit.createdAt,
    lastActivity: state.activities
      .filter((item) => item.auditId === audit.auditId)
      .reduce((latest, item) => (item.occurredAt > latest ? item.occurredAt : latest), audit.createdAt),
    findingCount: findingsFor(state, audit.auditId).length,
    executionId: executions[0]?.executionId ?? null,
    executionCount: executions.length,
    hasEngineTrail: false,
    record: "sample",
    featured: false,
    evidenceCount: evidenceFor(state, audit.auditId).length,
    origin: "local",
    description: audit.description,
  };
}

export function heroOriginalUnchanged(state: WorkspaceState): boolean {
  const original = catalogExecutions(HERO_AUDIT_ID)[0];
  if (!original) return false;
  const extras = state.extras[HERO_AUDIT_ID] ?? [];
  if (extras.some((item) => item.executionId === HERO_EXECUTION_ID)) return false;
  if (state.evidence.some((item) => item.executionId === HERO_EXECUTION_ID)) return false;
  if (state.findings.some((item) => item.executionId === HERO_EXECUTION_ID)) return false;
  if (state.messages.some((item) => item.executionId === HERO_EXECUTION_ID)) return false;
  if (state.actions.some((item) => item.executionId === HERO_EXECUTION_ID)) return false;
  if (state.activities.some((item) => item.executionId === HERO_EXECUTION_ID && item.type !== "execution.opened")) {
    return false;
  }
  return JSON.stringify(snapshotExecution(original)) === JSON.stringify(HERO_ORIGINAL_SNAPSHOT);
}

export function clearLocalWorkspace(state: WorkspaceState): WorkspaceState {
  return {
    ...EMPTY_WORKSPACE,
    extras: Object.fromEntries(
      Object.entries(state.extras).filter(([auditId]) => auditId === HERO_AUDIT_ID),
    ),
  };
}

export function buildSampleExport(
  state: WorkspaceState,
  catalog: readonly WorkspaceAudit[],
): {
  notice: string;
  generatedAt: string;
  catalog: readonly unknown[];
  hero: typeof HERO_ORIGINAL_SNAPSHOT;
  local: {
    audits: readonly LocalAudit[];
    evidence: readonly LocalEvidence[];
    findings: readonly LocalFinding[];
    activities: readonly LocalActivity[];
  };
} {
  return {
    notice:
      "Sample and local workspace data. This is not an export of cryptographically sealed CooL receipts.",
    generatedAt: new Date().toISOString(),
    catalog: catalog.map((audit) => ({
      auditId: audit.auditId,
      title: audit.title,
      domain: audit.domain,
      findings: audit.findingCount,
      executionId: audit.executionId,
      record: audit.record,
    })),
    hero: HERO_ORIGINAL_SNAPSHOT,
    local: {
      audits: state.audits,
      evidence: state.evidence,
      findings: state.findings,
      activities: state.activities,
    },
  };
}
