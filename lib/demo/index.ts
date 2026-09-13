/**
 * Demo contract boundary. Presentation state only — no CooL, no engine.
 */
export { APPROVED_CLAIMS, DEMO_TIMING_SECONDS, FORBIDDEN_CLAIMS, SUGGESTION_CHIPS } from "./copy";
export {
  GOLDEN_PATH,
  INITIAL_SESSION,
  canTransition,
  createSession,
  transition,
  walkGoldenPath,
} from "./state-machine";
export { IllegalTransitionError } from "./types";
export type {
  DemoEvent,
  DemoPhase,
  DemoSession,
  DemoState,
  PendingOperation,
  VerificationStatus,
} from "./types";
export { DEMO_STATES } from "./types";
