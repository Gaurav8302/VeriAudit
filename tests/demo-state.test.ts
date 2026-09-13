/**
 * Milestone 6A: demo state machine.
 *
 * Presentation state only. These tests lock transitions, reset, and
 * verification semantics — not layout.
 */
import { describe, expect, it } from "vitest";
import {
  APPROVED_CLAIMS,
  FORBIDDEN_CLAIMS,
  GOLDEN_PATH,
  IllegalTransitionError,
  canTransition,
  createSession,
  transition,
  walkGoldenPath,
} from "@/lib/demo";

function at(state: ReturnType<typeof createSession>["state"]) {
  let session = createSession();
  if (state === "welcome") return session;
  const path = [
    { type: "begin" as const },
    { type: "select_scenario" as const, scenarioId: "financial" as const },
    { type: "run_audit" as const },
    {
      type: "audit_succeeded" as const,
      auditId: "AUD-FIN-2026-09",
      executionId: "EXEC-FIN-2026-09-001",
    },
    { type: "continue_to_simulate" as const },
    { type: "start_simulation" as const },
    { type: "simulation_succeeded" as const, simulationId: "SIM-20260915" },
    { type: "ask_why" as const },
    { type: "submit_search" as const, query: "revenue recognition exception" },
    { type: "search_succeeded" as const },
    {
      type: "open_result" as const,
      auditId: "AUD-FIN-2026-09",
      executionId: "EXEC-FIN-2026-09-001",
    },
    { type: "reconstruction_succeeded" as const },
    { type: "open_trail" as const },
    { type: "open_verification" as const },
    { type: "verification_completed" as const, status: "verified" as const },
  ];
  for (const event of path) {
    session = transition(session, event);
    if (session.state === state && session.phase === "ready") return session;
  }
  return session;
}

describe("D — valid transitions", () => {
  it("D1 — the golden path visits every documented state in order", () => {
    const end = walkGoldenPath();
    expect(end.state).toBe("verification");
    expect(end.phase).toBe("ready");
    expect(end.selectedScenario).toBe("financial");
    expect(end.auditId).toBe("AUD-FIN-2026-09");
    expect(end.executionId).toBe("EXEC-FIN-2026-09-001");
    expect(end.simulationId).toBe("SIM-20260915");
    expect(end.searchQuery).toBe("revenue recognition exception");
    expect(end.selectedResultAuditId).toBe("AUD-FIN-2026-09");
    expect(end.verificationStatus).toBe("verified");
    expect(GOLDEN_PATH[GOLDEN_PATH.length - 1]).toBe("verification");
  });

  it("D2 — audit selection is required before run", () => {
    const started = transition(createSession(), { type: "begin" });
    expect(started.state).toBe("scenario_select");
    expect(canTransition(started, { type: "run_audit" })).toBe(false);
    const selected = transition(started, { type: "select_scenario", scenarioId: "financial" });
    expect(selected.selectedScenario).toBe("financial");
    expect(canTransition(selected, { type: "run_audit" })).toBe(true);
  });

  it("D3 — a successful audit stores identifiers, not findings", () => {
    const result = at("result");
    expect(result.state).toBe("result");
    expect(result.auditId).toBe("AUD-FIN-2026-09");
    expect(result.executionId).toBe("EXEC-FIN-2026-09-001");
    expect(result.verificationStatus).toBe("unavailable");
    expect(result).not.toHaveProperty("findings");
    expect(result).not.toHaveProperty("receipts");
  });

  it("D4 — simulation and search keep backend ids only", () => {
    const history = at("history");
    expect(history.simulationId).toBe("SIM-20260915");
    const searched = at("search_results");
    expect(searched.searchQuery).toBe("revenue recognition exception");
    expect(searched.state).toBe("search_results");
  });
});

describe("D — illegal transitions and reset", () => {
  it("D5 — jumping to verification from welcome is rejected", () => {
    expect(() =>
      transition(createSession(), { type: "verification_completed", status: "verified" }),
    ).toThrow(IllegalTransitionError);
    expect(canTransition(createSession(), { type: "open_trail" })).toBe(false);
    expect(canTransition(createSession(), { type: "start_simulation" })).toBe(false);
  });

  it("D6 — reset returns to welcome and clears the session", () => {
    const reset = transition(walkGoldenPath(), { type: "reset" });
    expect(reset).toEqual(createSession());
    expect(reset.state).toBe("welcome");
    expect(reset.auditId).toBeNull();
    expect(reset.simulationId).toBeNull();
    expect(reset.searchQuery).toBe("");
    expect(reset.verificationStatus).toBeNull();
  });

  it("D7 — back follows the documented chain", () => {
    const fromTrail = transition(at("trail"), { type: "back" });
    expect(fromTrail.state).toBe("reconstruction");
    const fromSearch = transition(at("search_results"), { type: "back" });
    expect(fromSearch.state).toBe("investigation");
  });
});

describe("D — loading, errors, verification", () => {
  it("D8 — a failed audit stays in running and retry re-enters loading", () => {
    let session = transition(createSession(), { type: "begin" });
    session = transition(session, { type: "select_scenario", scenarioId: "legal" });
    session = transition(session, { type: "run_audit" });
    expect(session.state).toBe("running");
    expect(session.phase).toBe("loading");
    session = transition(session, { type: "audit_failed", error: "API unavailable" });
    expect(session.state).toBe("running");
    expect(session.phase).toBe("error");
    expect(session.lastError).toBe("API unavailable");
    session = transition(session, { type: "retry" });
    expect(session.phase).toBe("loading");
    expect(session.pending).toBe("run");
    expect(session.state).toBe("running");
  });

  it("D9 — verification can be verified, failed, or unavailable — never a boolean", () => {
    const verified = transition(at("verification"), {
      type: "verification_completed",
      status: "verified",
    });
    expect(verified.verificationStatus).toBe("verified");

    let failed = at("trail");
    failed = transition(failed, { type: "open_verification" });
    failed = transition(failed, { type: "verification_completed", status: "failed" });
    expect(failed.verificationStatus).toBe("failed");

    let unavailable = at("trail");
    unavailable = transition(unavailable, { type: "open_verification" });
    unavailable = transition(unavailable, {
      type: "verification_completed",
      status: "unavailable",
    });
    expect(unavailable.verificationStatus).toBe("unavailable");
    expect(typeof unavailable.verificationStatus).toBe("string");
  });

  it("D10 — a successful audit does not claim verified", () => {
    expect(at("result").verificationStatus).toBe("unavailable");
    expect(APPROVED_CLAIMS.unavailable).toMatch(/unavailable/i);
    expect(FORBIDDEN_CLAIMS).toContain("100% trustworthy");
    expect(FORBIDDEN_CLAIMS).toContain("Blockchain verified");
  });

  it("D11 — search failure does not become a result screen", () => {
    let session = at("investigation");
    session = transition(session, { type: "submit_search", query: "revenue" });
    session = transition(session, { type: "search_failed", error: "search unavailable" });
    expect(session.state).toBe("search_results");
    expect(session.phase).toBe("error");
    expect(session.selectedResultAuditId).toBeNull();
  });
});
