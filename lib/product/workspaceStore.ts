/**
 * The single source of truth for product workspace state.
 *
 * Reducers in `localWorkspace` are pure; this store owns the committed value and
 * the persistence. Mutations always apply to the newest committed state, never
 * to a value captured by a React render. Two mutations dispatched in the same
 * tick used to both read the render snapshot, so the second silently discarded
 * the first — that dropped every sample evidence file except the last.
 */
import {
  EMPTY_WORKSPACE,
  migrateReopens,
  parseWorkspace,
  REOPEN_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceState,
} from "./localWorkspace";
import type { ProductExecution } from "./lineage";

export interface WorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WorkspaceStore {
  read(): WorkspaceState;
  /** Newest committed state, without touching storage. */
  snapshot(): WorkspaceState;
  write(next: WorkspaceState): void;
  /** Apply a reducer that returns state plus a result. */
  update<T>(reducer: (state: WorkspaceState) => { state: WorkspaceState } & T): T;
  /** Apply a reducer that returns only state. */
  mutate(reducer: (state: WorkspaceState) => WorkspaceState): void;
  subscribe(listener: () => void): () => void;
}

export function createWorkspaceStore(storage?: WorkspaceStorage | null): WorkspaceStore {
  let memory: WorkspaceState = { ...EMPTY_WORKSPACE };
  let cachedRaw: string | null = null;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function read(): WorkspaceState {
    if (!storage) return memory;
    try {
      const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
      if (raw && raw === cachedRaw) return memory;
      if (raw) {
        cachedRaw = raw;
        memory = parseWorkspace(JSON.parse(raw));
        return memory;
      }
      const legacy = storage.getItem(REOPEN_STORAGE_KEY);
      memory = legacy
        ? migrateReopens(JSON.parse(legacy) as Record<string, ProductExecution[]>)
        : memory;
      cachedRaw = JSON.stringify(memory);
      storage.setItem(WORKSPACE_STORAGE_KEY, cachedRaw);
    } catch {
      cachedRaw = null;
    }
    return memory;
  }

  /**
   * Persist first, then commit. A quota or serialisation failure must leave the
   * previous state in place and throw, so a caller can never render a final
   * state — accepted, ready, sealed — that was never written.
   */
  function write(next: WorkspaceState) {
    const raw = JSON.stringify(next);
    if (storage) storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    memory = next;
    cachedRaw = raw;
    emit();
  }

  return {
    read,
    snapshot: () => memory,
    write,
    update: (reducer) => {
      const result = reducer(read());
      write(result.state);
      return result;
    },
    mutate: (reducer) => {
      write(reducer(read()));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
