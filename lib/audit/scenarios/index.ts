/**
 * The scenario registry.
 *
 * Four scenarios, one engine. Anything added here is automatically runnable,
 * queryable by audit id, and covered by the cross-scenario test suite.
 */
import { assertUniqueScenarioIds } from "../ids";
import type { AuditScenario, Scenario } from "../types";
import { SCENARIO_BRIEFINGS } from "./briefs";
import { cyberScenario } from "./cyber";
import { financialScenario } from "./financial";
import { legalScenario } from "./legal";
import { procurementScenario } from "./procurement";

export { SCENARIO_BRIEFINGS, scenarioBriefing } from "./briefs";
export { cyberScenario, financialScenario, legalScenario, procurementScenario };

/**
 * `AuditScenario<never>` is the readable erasure: evidence types differ per
 * scenario and the engine never inspects evidence itself, only hands it to the
 * scenario's own rules.
 */
export const SCENARIOS = [
  financialScenario,
  legalScenario,
  cyberScenario,
  procurementScenario,
] as unknown as readonly AuditScenario<never>[];

assertUniqueScenarioIds(SCENARIOS);

export const HERO_SCENARIO_ID: Scenario = "financial";

export function scenarioById(scenarioId: string): AuditScenario<never> | undefined {
  return SCENARIOS.find((s) => s.scenarioId === scenarioId);
}

/** Resolve by audit id — how the GET routes find an audit without a database. */
export function scenarioByAuditId(auditId: string): AuditScenario<never> | undefined {
  return SCENARIOS.find((s) => s.auditId === auditId);
}

/** Accepts either a scenario id (`financial`) or an audit id (`AUD-FIN-2026-09`). */
export function resolveScenario(idOrAuditId: string): AuditScenario<never> | undefined {
  return scenarioById(idOrAuditId) ?? scenarioByAuditId(idOrAuditId);
}

export function scenarioCatalogue() {
  return SCENARIOS.map((s) => {
    const briefing = SCENARIO_BRIEFINGS[s.scenarioId];
    return {
      scenarioId: s.scenarioId,
      displayName: s.displayName,
      description: s.description,
      isHero: s.isHero,
      auditId: s.auditId,
      executionId: s.executionId,
      title: s.title,
      period: s.period,
      controlsInScope: s.controls.length,
      artifactsInScope: s.artifacts.length,
      expected: s.expected,
      briefing,
    };
  });
}
