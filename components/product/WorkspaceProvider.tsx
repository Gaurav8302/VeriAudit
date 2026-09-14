"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  actionsFor,
  addEvidence,
  addFinding,
  activitiesFor,
  applyAiTurn,
  attachSeal,
  asWorkspaceAudit,
  beginAiTurn,
  beginEvidenceUpload,
  buildSampleExport,
  canReopenAudit,
  clearLocalWorkspace,
  closeExecution,
  completeAiTurn,
  completeEvidenceUpload,
  createAudit,
  createExecution,
  discardEvidence,
  ensureSampleWorkspace,
  EMPTY_WORKSPACE,
  failAiTurn,
  failEvidenceUpload,
  readyEvidenceFor,
  resetSampleWorkspace,
  evidenceFor,
  findingsFor,
  getLocalAudit,
  hydrateWorkspaceExecutions,
  messagesFor,
  reviewFinding,
  sealFor,
  selectedExecutionId,
  selectExecution,
  updateFindingStatus,
  type FindingLife,
  type FindingReview,
  type FindingSeverity,
  type LocalAiAction,
  type LocalAudit,
  type LocalEvidence,
  type LocalActivity,
  type LocalFinding,
  type LocalMessage,
  type WorkspaceState,
} from "@/lib/product/localWorkspace";
import { createWorkspaceStore } from "@/lib/product/workspaceStore";
import type { AiMode, AiProviderName, ProposedAction } from "@/lib/ai/types";
import type { ExecutionSealBundle } from "@/lib/product/sealTypes";
import {
  mergeExecutions,
  type ProductExecution,
} from "@/lib/product/lineage";
import {
  engineEvidenceCount,
  visibleAudits,
  type ProductDomain,
  type WorkspaceAudit,
} from "@/lib/product/workspace";

const store = createWorkspaceStore(typeof window === "undefined" ? null : window.localStorage);
const { read, write, update, mutate } = store;

function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    unsubscribe();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

interface WorkspaceApi {
  ready: boolean;
  state: WorkspaceState;
  catalog: readonly WorkspaceAudit[];
  audits: WorkspaceAudit[];
  localAudit: (auditId: string) => LocalAudit | null;
  executions: (auditId: string) => ProductExecution[];
  extras: (auditId: string) => ProductExecution[];
  selectedId: (auditId: string) => string | null;
  select: (auditId: string, executionId: string) => void;
  evidence: (auditId: string, executionId?: string) => LocalEvidence[];
  findings: (auditId: string, executionId?: string) => LocalFinding[];
  activities: (auditId: string, executionId: string) => LocalActivity[];
  canReopen: (auditId: string) => boolean;
  canClose: (auditId: string) => boolean;
  createAudit: (input: {
    title: string;
    domain: ProductDomain;
    description: string;
    reference?: string;
    period?: string;
  }) => LocalAudit;
  ensureSample: () => LocalAudit;
  resetSample: () => LocalAudit;
  createExecution: (auditId: string) => ProductExecution;
  closeExecution: (auditId: string, executionId: string) => ProductExecution;
  sealFor: (executionId: string) => ExecutionSealBundle | null;
  attachSeal: (executionId: string, bundle: ExecutionSealBundle) => void;
  reopen: (auditId: string) => ProductExecution;
  addEvidence: (input: Parameters<typeof addEvidence>[1]) => LocalEvidence;
  beginEvidenceUpload: (input: Parameters<typeof beginEvidenceUpload>[1]) => LocalEvidence;
  completeEvidenceUpload: (
    artifactId: string,
    ingested: Parameters<typeof completeEvidenceUpload>[2],
  ) => LocalEvidence;
  failEvidenceUpload: (artifactId: string, message: string) => LocalEvidence;
  discardEvidence: (artifactId: string) => void;
  readyEvidence: (auditId: string, executionId?: string) => LocalEvidence[];
  addFinding: (input: {
    auditId: string;
    executionId: string;
    title: string;
    severity: FindingSeverity;
    status?: FindingLife;
    description: string;
    evidenceIds?: readonly string[];
  }) => LocalFinding;
  updateFinding: (findingId: string, status: FindingLife) => LocalFinding;
  reviewFinding: (
    findingId: string,
    review: Exclude<FindingReview, "pending">,
    note?: string,
  ) => LocalFinding;
  messages: (auditId: string, executionId: string) => LocalMessage[];
  actions: (auditId: string, executionId: string) => LocalAiAction[];
  applyAiTurn: (input: {
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
    grounding?: "evidence-backed" | "insufficient" | null;
    confidence?: "high" | "medium" | "low" | "none" | null;
    references?: readonly {
      evidenceId: string;
      chunkId: string;
      label: string;
      excerpt: string;
    }[];
  }) => { findingIds: readonly string[] };
  beginAiTurn: (input: { auditId: string; executionId: string; prompt: string }) => string;
  completeAiTurn: (input: Parameters<typeof completeAiTurn>[1]) => { findingIds: readonly string[] };
  failAiTurn: (input: { auditId: string; executionId: string; message: string }) => void;
  exportSample: () => ReturnType<typeof buildSampleExport>;
  clearLocal: () => void;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, read, store.snapshot);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const state = hydrated ? raw : { ...EMPTY_WORKSPACE };
  const catalog = visibleAudits();

  const value = useMemo<WorkspaceApi>(
    () => ({
      ready: hydrated,
      state,
      catalog,
      audits: [
        ...catalog.map((audit) => ({
          ...audit,
          evidenceCount: engineEvidenceCount(audit.auditId) + evidenceFor(state, audit.auditId).length,
          origin: "catalog" as const,
          findingCount: audit.findingCount + findingsFor(state, audit.auditId).length,
        })),
        ...state.audits.map((audit) => asWorkspaceAudit(audit, state)),
      ],
      localAudit: (auditId) => getLocalAudit(state, auditId),
      executions: (auditId) =>
        hydrateWorkspaceExecutions(state, mergeExecutions(auditId, state.extras[auditId] ?? [])),
      extras: (auditId) => [...(state.extras[auditId] ?? [])],
      selectedId: (auditId) => selectedExecutionId(state, auditId),
      select: (auditId, executionId) => write(selectExecution(state, auditId, executionId)),
      evidence: (auditId, executionId) => evidenceFor(state, auditId, executionId),
      findings: (auditId, executionId) => findingsFor(state, auditId, executionId),
      activities: (auditId, executionId) => activitiesFor(state, auditId, executionId),
      canReopen: (auditId) => canReopenAudit(state, auditId),
      canClose: (auditId) => {
        const selected = selectedExecutionId(state, auditId);
        const execution = selected
          ? mergeExecutions(auditId, state.extras[auditId] ?? []).find((item) => item.executionId === selected)
          : null;
        return Boolean(execution && !execution.immutable && execution.status === "open");
      },
      createAudit: (input) => update((current) => createAudit(current, input)).audit,
      ensureSample: () => {
        const result = ensureSampleWorkspace(read());
        if (result.created) write(result.state);
        return result.audit;
      },
      resetSample: () => update((current) => resetSampleWorkspace(current)).audit,
      createExecution: (auditId) => update((current) => createExecution(current, auditId)).execution,
      closeExecution: (auditId, executionId) =>
        update((current) => closeExecution(current, auditId, executionId)).execution,
      sealFor: (executionId) => sealFor(state, executionId),
      attachSeal: (executionId, bundle) =>
        mutate((current) => attachSeal(current, executionId, bundle)),
      reopen: (auditId) => update((current) => createExecution(current, auditId)).execution,
      addEvidence: (input) => update((current) => addEvidence(current, input)).evidence,
      beginEvidenceUpload: (input) => update((current) => beginEvidenceUpload(current, input)).evidence,
      completeEvidenceUpload: (artifactId, ingested) =>
        update((current) => completeEvidenceUpload(current, artifactId, ingested)).evidence,
      failEvidenceUpload: (artifactId, message) =>
        update((current) => failEvidenceUpload(current, artifactId, message)).evidence,
      discardEvidence: (artifactId) => mutate((current) => discardEvidence(current, artifactId)),
      readyEvidence: (auditId, executionId) => readyEvidenceFor(state, auditId, executionId),
      addFinding: (input) => update((current) => addFinding(current, input)).finding,
      updateFinding: (findingId, status) =>
        update((current) => updateFindingStatus(current, findingId, status)).finding,
      reviewFinding: (findingId, review, note) =>
        update((current) => reviewFinding(current, findingId, review, note)).finding,
      messages: (auditId, executionId) => messagesFor(state, auditId, executionId),
      actions: (auditId, executionId) => actionsFor(state, auditId, executionId),
      applyAiTurn: (input) => ({
        findingIds: update((current) => applyAiTurn(current, input)).findingIds,
      }),
      beginAiTurn: (input) => update((current) => beginAiTurn(current, input)).messageId,
      completeAiTurn: (input) => ({
        findingIds: update((current) => completeAiTurn(current, input)).findingIds,
      }),
      failAiTurn: (input) => mutate((current) => failAiTurn(current, input).state),
      exportSample: () => buildSampleExport(state, catalog),
      clearLocal: () => mutate((current) => clearLocalWorkspace(current)),
    }),
    [catalog, hydrated, state],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}

export function useAuditExecutions(auditId: string) {
  const workspace = useWorkspace();
  const reopen = useCallback(() => workspace.reopen(auditId), [auditId, workspace]);
  return {
    ready: workspace.ready,
    executions: workspace.executions(auditId),
    extras: workspace.extras(auditId),
    canReopen: workspace.canReopen(auditId),
    reopen,
  };
}

export function useLineage() {
  const workspace = useWorkspace();
  return {
    extras: workspace.extras,
    executions: workspace.executions,
    canReopen: workspace.canReopen,
    reopen: workspace.reopen,
  };
}
