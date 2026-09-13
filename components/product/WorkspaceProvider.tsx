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
  asWorkspaceAudit,
  buildSampleExport,
  canReopenAudit,
  clearLocalWorkspace,
  closeExecution,
  createAudit,
  createExecution,
  EMPTY_WORKSPACE,
  evidenceFor,
  findingsFor,
  getLocalAudit,
  hydrateWorkspaceExecutions,
  messagesFor,
  migrateReopens,
  parseWorkspace,
  reviewFinding,
  REOPEN_STORAGE_KEY,
  selectedExecutionId,
  selectExecution,
  updateFindingStatus,
  WORKSPACE_STORAGE_KEY,
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
import type { AiMode, AiProviderName, ProposedAction } from "@/lib/ai/types";
import {
  mergeExecutions,
  type ProductExecution,
} from "@/lib/product/lineage";
import {
  listEngineEvidence,
  visibleAudits,
  type ProductDomain,
  type WorkspaceAudit,
} from "@/lib/product/workspace";

let memory: WorkspaceState = { ...EMPTY_WORKSPACE };
let cachedRaw: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function read(): WorkspaceState {
  if (typeof window === "undefined") return memory;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw === cachedRaw && raw) return memory;
    if (raw) {
      cachedRaw = raw;
      memory = parseWorkspace(JSON.parse(raw));
      return memory;
    }
    const legacy = window.localStorage.getItem(REOPEN_STORAGE_KEY);
    memory = legacy ? migrateReopens(JSON.parse(legacy) as Record<string, ProductExecution[]>) : memory;
    cachedRaw = JSON.stringify(memory);
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, cachedRaw);
  } catch {
    cachedRaw = null;
  }
  return memory;
}

function write(next: WorkspaceState) {
  memory = next;
  cachedRaw = JSON.stringify(next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, cachedRaw);
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

interface WorkspaceApi {
  ready: boolean;
  state: WorkspaceState;
  catalog: WorkspaceAudit[];
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
  createExecution: (auditId: string) => ProductExecution;
  closeExecution: (auditId: string, executionId: string) => ProductExecution;
  reopen: (auditId: string) => ProductExecution;
  addEvidence: (input: Parameters<typeof addEvidence>[1]) => LocalEvidence;
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
  }) => { findingIds: readonly string[] };
  exportSample: () => ReturnType<typeof buildSampleExport>;
  clearLocal: () => void;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, read, () => memory);
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
          evidenceCount:
            listEngineEvidence().filter((item) => item.auditId === audit.auditId).length +
            evidenceFor(state, audit.auditId).length,
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
      createAudit: (input) => {
        const result = createAudit(state, input);
        write(result.state);
        return result.audit;
      },
      createExecution: (auditId) => {
        const result = createExecution(state, auditId);
        write(result.state);
        return result.execution;
      },
      closeExecution: (auditId, executionId) => {
        const result = closeExecution(state, auditId, executionId);
        write(result.state);
        return result.execution;
      },
      reopen: (auditId) => {
        const result = createExecution(state, auditId);
        write(result.state);
        return result.execution;
      },
      addEvidence: (input) => {
        const result = addEvidence(state, input);
        write(result.state);
        return result.evidence;
      },
      addFinding: (input) => {
        const result = addFinding(state, input);
        write(result.state);
        return result.finding;
      },
      updateFinding: (findingId, status) => {
        const result = updateFindingStatus(state, findingId, status);
        write(result.state);
        return result.finding;
      },
      reviewFinding: (findingId, review, note) => {
        const result = reviewFinding(state, findingId, review, note);
        write(result.state);
        return result.finding;
      },
      messages: (auditId, executionId) => messagesFor(state, auditId, executionId),
      actions: (auditId, executionId) => actionsFor(state, auditId, executionId),
      applyAiTurn: (input) => {
        const result = applyAiTurn(state, input);
        write(result.state);
        return { findingIds: result.findingIds };
      },
      exportSample: () => buildSampleExport(state, catalog),
      clearLocal: () => write(clearLocalWorkspace(state)),
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
