/**
 * The demo state machine.
 *
 * One `state`, one `phase`. No scattered `isSearching` / `showTrail` flags.
 * Illegal transitions throw `IllegalTransitionError` so a UI cannot wander
 * into a success screen it did not earn.
 *
 * This file does not fetch. The frontend dispatches events after the
 * backend responds. Animations are presentation; they do not move state.
 */
import { IllegalTransitionError, type DemoEvent, type DemoSession, type DemoState } from "./types";

export const INITIAL_SESSION: DemoSession = {
  state: "welcome",
  phase: "ready",
  pending: null,
  selectedScenario: null,
  auditId: null,
  executionId: null,
  simulationId: null,
  searchQuery: "",
  selectedResultAuditId: null,
  selectedResultExecutionId: null,
  verificationStatus: null,
  lastError: null,
};

/** The judge-facing golden path. Secondary scenarios may branch at `run_audit`. */
export const GOLDEN_PATH: readonly DemoState[] = [
  "welcome",
  "scenario_select",
  "running",
  "result",
  "simulate_ready",
  "simulating",
  "history",
  "investigation",
  "search_results",
  "reconstruction",
  "trail",
  "verification",
];

const BACK: Partial<Record<DemoState, DemoState>> = {
  scenario_select: "welcome",
  running: "scenario_select",
  result: "scenario_select",
  simulate_ready: "result",
  simulating: "simulate_ready",
  history: "simulate_ready",
  investigation: "history",
  search_results: "investigation",
  reconstruction: "search_results",
  trail: "reconstruction",
  verification: "trail",
};

export function createSession(): DemoSession {
  return INITIAL_SESSION;
}

export function transition(session: DemoSession, event: DemoEvent): DemoSession {
  if (event.type === "reset") return createSession();

  if (event.type === "retry") {
    if (session.phase !== "error" || session.lastError === null) {
      throw new IllegalTransitionError(session.state, event.type);
    }
    return retry(session);
  }

  if (event.type === "back") {
    const target = BACK[session.state];
    if (!target) throw new IllegalTransitionError(session.state, event.type);
    return { ...session, state: target, phase: "ready", pending: null, lastError: null };
  }

  switch (session.state) {
    case "welcome":
      if (event.type === "begin") {
        return ready({ ...session, state: "scenario_select" });
      }
      break;
    case "scenario_select":
      if (event.type === "select_scenario") {
        return ready({ ...session, selectedScenario: event.scenarioId });
      }
      if (event.type === "run_audit") {
        if (session.selectedScenario === null) {
          throw new IllegalTransitionError(session.state, event.type);
        }
        return loading({ ...session, state: "running" }, "run");
      }
      break;
    case "running":
      if (event.type === "audit_succeeded") {
        return ready({
          ...session,
          state: "result",
          auditId: event.auditId,
          executionId: event.executionId,
          verificationStatus: "unavailable",
        });
      }
      if (event.type === "audit_failed") return failed(session, event.error);
      break;
    case "result":
      if (event.type === "continue_to_simulate") {
        return ready({ ...session, state: "simulate_ready" });
      }
      if (event.type === "open_trail") {
        return ready({ ...session, state: "trail" });
      }
      break;
    case "simulate_ready":
      if (event.type === "start_simulation") {
        return loading({ ...session, state: "simulating" }, "simulate");
      }
      break;
    case "simulating":
      if (event.type === "simulation_succeeded") {
        return ready({ ...session, state: "history", simulationId: event.simulationId });
      }
      if (event.type === "simulation_failed") return failed(session, event.error);
      break;
    case "history":
      if (event.type === "ask_why") {
        return ready({
          ...session,
          state: "investigation",
          searchQuery: "",
        });
      }
      if (event.type === "submit_search") {
        return loading(
          { ...session, state: "search_results", searchQuery: event.query },
          "search",
        );
      }
      break;
    case "investigation":
      if (event.type === "submit_search") {
        return loading(
          { ...session, state: "search_results", searchQuery: event.query },
          "search",
        );
      }
      break;
    case "search_results":
      if (event.type === "search_succeeded") {
        return ready(session);
      }
      if (event.type === "search_failed") return failed(session, event.error);
      if (event.type === "submit_search") {
        return loading({ ...session, searchQuery: event.query }, "search");
      }
      if (event.type === "open_result") {
        return loading(
          {
            ...session,
            state: "reconstruction",
            selectedResultAuditId: event.auditId,
            selectedResultExecutionId: event.executionId,
          },
          "reconstruct",
        );
      }
      break;
    case "reconstruction":
      if (event.type === "reconstruction_succeeded") {
        return ready(session);
      }
      if (event.type === "reconstruction_failed") return failed(session, event.error);
      if (event.type === "open_trail") {
        if (session.phase !== "ready") throw new IllegalTransitionError(session.state, event.type);
        return ready({ ...session, state: "trail" });
      }
      break;
    case "trail":
      if (event.type === "open_verification") {
        return loading({ ...session, state: "verification" }, "verify");
      }
      if (event.type === "ask_why") {
        return ready({ ...session, state: "reconstruction" });
      }
      break;
    case "verification":
      if (event.type === "verification_completed") {
        return ready({ ...session, verificationStatus: event.status });
      }
      if (event.type === "verification_failed") return failed(session, event.error);
      if (event.type === "open_trail") {
        return ready({ ...session, state: "trail" });
      }
      if (event.type === "ask_why") {
        return ready({ ...session, state: "reconstruction" });
      }
      break;
    default:
      break;
  }

  throw new IllegalTransitionError(session.state, event.type);
}

export function canTransition(session: DemoSession, event: DemoEvent): boolean {
  try {
    transition(session, event);
    return true;
  } catch (error) {
    if (error instanceof IllegalTransitionError) return false;
    throw error;
  }
}

function ready(session: DemoSession): DemoSession {
  return { ...session, phase: "ready", pending: null, lastError: null };
}

function loading(session: DemoSession, pending: NonNullable<DemoSession["pending"]>): DemoSession {
  return { ...session, phase: "loading", pending, lastError: null };
}

function failed(session: DemoSession, error: string): DemoSession {
  return { ...session, phase: "error", pending: null, lastError: error };
}

function retry(session: DemoSession): DemoSession {
  switch (session.state) {
    case "running":
      return loading({ ...session, lastError: null }, "run");
    case "simulating":
      return loading({ ...session, lastError: null }, "simulate");
    case "search_results":
      return loading({ ...session, lastError: null }, "search");
    case "reconstruction":
      return loading({ ...session, lastError: null }, "reconstruct");
    case "verification":
      return loading({ ...session, lastError: null }, "verify");
    default:
      throw new IllegalTransitionError(session.state, "retry");
  }
}

export function walkGoldenPath(): DemoSession {
  let session = createSession();
  const steps: DemoEvent[] = [
    { type: "begin" },
    { type: "select_scenario", scenarioId: "financial" },
    { type: "run_audit" },
    { type: "audit_succeeded", auditId: "AUD-FIN-2026-09", executionId: "EXEC-FIN-2026-09-001" },
    { type: "continue_to_simulate" },
    { type: "start_simulation" },
    { type: "simulation_succeeded", simulationId: "SIM-20260915" },
    { type: "ask_why" },
    { type: "submit_search", query: "revenue recognition exception" },
    { type: "search_succeeded" },
    { type: "open_result", auditId: "AUD-FIN-2026-09", executionId: "EXEC-FIN-2026-09-001" },
    { type: "reconstruction_succeeded" },
    { type: "open_trail" },
    { type: "open_verification" },
    { type: "verification_completed", status: "verified" },
  ];
  for (const event of steps) session = transition(session, event);
  return session;
}
