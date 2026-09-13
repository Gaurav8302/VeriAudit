/**
 * Demo session: identifiers and presentation state only.
 *
 * Backend remains the source of truth for audits, events, receipts, and
 * verification. This object must never hold fabricated findings or a
 * homemade `verified: true`.
 */
import type { Scenario } from "@/lib/audit/types";

export const DEMO_STATES = [
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
] as const;

export type DemoState = (typeof DEMO_STATES)[number];

export type PendingOperation =
  | "catalog"
  | "run"
  | "simulate"
  | "search"
  | "reconstruct"
  | "verify"
  | null;

export type VerificationStatus = "verified" | "failed" | "unavailable" | "not-recorded" | null;

export type DemoPhase = "ready" | "loading" | "error";

export interface DemoSession {
  readonly state: DemoState;
  readonly phase: DemoPhase;
  readonly pending: PendingOperation;
  readonly selectedScenario: Scenario | null;
  readonly auditId: string | null;
  readonly executionId: string | null;
  readonly simulationId: string | null;
  readonly searchQuery: string;
  readonly selectedResultAuditId: string | null;
  readonly selectedResultExecutionId: string | null;
  readonly verificationStatus: VerificationStatus;
  readonly lastError: string | null;
}

export type DemoEvent =
  | { readonly type: "begin" }
  | { readonly type: "select_scenario"; readonly scenarioId: Scenario }
  | { readonly type: "run_audit" }
  | { readonly type: "audit_succeeded"; readonly auditId: string; readonly executionId: string }
  | { readonly type: "audit_failed"; readonly error: string }
  | { readonly type: "continue_to_simulate" }
  | { readonly type: "start_simulation" }
  | { readonly type: "simulation_succeeded"; readonly simulationId: string }
  | { readonly type: "simulation_failed"; readonly error: string }
  | { readonly type: "ask_why" }
  | { readonly type: "submit_search"; readonly query: string }
  | { readonly type: "search_succeeded" }
  | { readonly type: "search_failed"; readonly error: string }
  | { readonly type: "open_result"; readonly auditId: string; readonly executionId: string }
  | { readonly type: "reconstruction_succeeded" }
  | { readonly type: "reconstruction_failed"; readonly error: string }
  | { readonly type: "open_trail" }
  | { readonly type: "open_verification" }
  | { readonly type: "verification_completed"; readonly status: Exclude<VerificationStatus, null> }
  | { readonly type: "verification_failed"; readonly error: string }
  | { readonly type: "back" }
  | { readonly type: "retry" }
  | { readonly type: "reset" };

export class IllegalTransitionError extends Error {
  readonly from: DemoState;
  readonly event: DemoEvent["type"];

  constructor(from: DemoState, event: DemoEvent["type"]) {
    super(`illegal demo transition: ${from} ← ${event}`);
    this.name = "IllegalTransitionError";
    this.from = from;
    this.event = event;
  }
}
