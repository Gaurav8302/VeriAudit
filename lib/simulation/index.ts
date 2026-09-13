/**
 * Historical simulation boundary.
 *
 * Pure, CooL-free, engine-free. Import from here rather than reaching
 * into the generator.
 */
export { ACTIVITY_DRAFTS, ACTIVITY_TYPES, AUDITS, HERO_SEARCH_TAGS } from "./catalog";
export { generateHistory, loadDemoState, simulationSummary } from "./generate";
export {
  DEMO_TODAY,
  HERO_AUDIT_ID,
  HERO_EXECUTION_ID,
  HERO_OPENED_AT,
  SEED,
  rng,
} from "./rng";
export type {
  Activity,
  ActivityStatus,
  ActivityType,
  SimulatedAudit,
  SimulatedExecution,
  SimulationResult,
  SimulationStats,
  SimulationSummary,
} from "./types";
