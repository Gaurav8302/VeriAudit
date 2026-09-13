/**
 * Deterministic, human-legible identifiers. Formats from docs/DATA_MODEL.md §3.
 *
 *   AUD-FIN-2026-09        audit
 *   EXEC-FIN-2026-09-001   execution
 *   EVT-FIN-2609-004       event     (scenario code + zero-padded sequence)
 *   ART-FIN-001            artifact
 *   F-FIN-001              finding
 *   REV-FIN-001            human review
 *
 * The rule these exist to enforce: **never join on a CooL identifier.** The
 * SDK's `record_id` and `binding_hash` change on every sealing (a fresh salt
 * per record), so they identify one sealing of an event, not the event. These
 * are the primary keys.
 */
import type { AuditScenario } from "./types";

function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

/** `EVT-FIN-2609-004`. `sequence` is 0-based; ids are 1-based. */
export function eventId(scenario: { eventCode: string }, sequence: number): string {
  return `EVT-${scenario.eventCode}-${pad(sequence + 1)}`;
}

/** `F-FIN-001`. `index` is 1-based. */
export function findingId(scenario: { eventCode: string }, index: number): string {
  return `F-${prefixOf(scenario.eventCode)}-${pad(index)}`;
}

/** `REV-FIN-001`. `index` is 1-based. */
export function reviewId(scenario: { eventCode: string }, index: number): string {
  return `REV-${prefixOf(scenario.eventCode)}-${pad(index)}`;
}

/** `FIN-2609` → `FIN`. */
function prefixOf(eventCode: string): string {
  return eventCode.split("-")[0] ?? eventCode;
}

/** Guard against two scenarios colliding on ids, which would corrupt lookups. */
export function assertUniqueScenarioIds(scenarios: readonly AuditScenario<never>[]): void {
  const fields = ["scenarioId", "auditId", "executionId", "eventCode"] as const;
  for (const field of fields) {
    const values = scenarios.map((s) => s[field]);
    const duplicates = values.filter((v, i) => values.indexOf(v) !== i);
    if (duplicates.length > 0) {
      throw new Error(`scenarios share a ${field}: ${[...new Set(duplicates)].join(", ")}`);
    }
  }
}
