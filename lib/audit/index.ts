/**
 * The audit domain boundary.
 *
 * Import from here rather than reaching into submodules. The engine, the event
 * manager, and the scenarios are free of `cool-nwc`; only `run.ts`,
 * `review.ts`, and `integrity.ts` cross into `lib/cool/`.
 */
export { runAudit, stepAt } from "./engine";
export { ancestorsOf, buildEventChain, childrenOf } from "./events";
export type { AuditEvent, EventChain } from "./events";
export { assertUniqueScenarioIds, eventId, findingId, reviewId } from "./ids";
export { bindReceipt, fingerprintLogState, proveTrailContinues, verifyTrail } from "./integrity";
export type { BoundReceipt, TrailIntegrity, TreeFingerprint } from "./integrity";
export { eventById, eventsByType, queryEvents } from "./query";
export type { EventOrder, EventQuery } from "./query";
export { deterministicReasoner } from "./reasoner";
export { ReviewError, submitReview } from "./review";
export type { ReviewOutcome, ReviewSubmission } from "./review";
export { runAndSeal, verifyRun } from "./run";
export type { AuditRun, RunOptions, SealedEvent } from "./run";
export { AppendOnlyError, ExecutionTrail } from "./trail";
export type { ExecutionSnapshot, WhyConclusion } from "./trail";
export {
  HERO_SCENARIO_ID,
  SCENARIOS,
  cyberScenario,
  financialScenario,
  legalScenario,
  procurementScenario,
  resolveScenario,
  scenarioByAuditId,
  scenarioById,
  scenarioCatalogue,
} from "./scenarios";
export type * from "./types";
export {
  auditView,
  briefView,
  evidenceView,
  eventDetailView,
  eventView,
  executionView,
  trailView,
} from "./views";
