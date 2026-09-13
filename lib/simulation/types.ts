/**
 * Simulation entities. Shapes follow docs/DATA_MODEL.md §2.
 *
 * Simulated audits are catalog entries, not a second AuditEngine. Only the
 * four existing scenarios have a real execution trail, and only the hero
 * is CooL-backed in P0 (docs/SIMULATION_SPEC.md §6).
 */
import type { Actor, Scenario } from "@/lib/audit/types";

export type ActivityType =
  | "audit"
  | "control_test"
  | "evidence_review"
  | "finding"
  | "follow_up"
  | "human_review"
  | "compliance_check"
  | "vendor_review"
  | "access_review";

export type ActivityStatus = "completed" | "exception" | "in_review" | "scheduled";
export type AuditStatus = "completed" | "in_review" | "open";

export interface SimulatedAudit {
  readonly auditId: string;
  readonly scenario: Scenario;
  readonly title: string;
  readonly period: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly status: AuditStatus;
  readonly isHero: boolean;
  readonly executionIds: readonly string[];
  readonly artifactIds: readonly string[];
  readonly summary: {
    readonly controlsTested: number;
    readonly controlsPassed: number;
    readonly exceptions: number;
    readonly findings: number;
    readonly humanReviewCompleted: boolean;
  } | null;
  readonly searchTags: readonly string[];
  /** True when GET /api/audits/:id can regenerate a real engine execution. */
  readonly hasEngineTrail: boolean;
}

export interface SimulatedExecution {
  readonly executionId: string;
  readonly auditId: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly engine: { readonly name: string; readonly version: string };
  readonly eventIds: readonly string[];
  readonly rootEventId: string | null;
  readonly coolBacked: boolean;
  readonly logHead: { logId: string; treeSize: number; rootHash: string } | null;
}

export interface Activity {
  readonly activityId: string;
  readonly occurredAt: string;
  readonly type: ActivityType;
  readonly scenario: Scenario;
  readonly title: string;
  readonly description: string;
  readonly auditId: string | null;
  readonly executionId: string | null;
  readonly status: ActivityStatus;
  readonly findingId: string | null;
  readonly actor: Actor;
  readonly searchTags: readonly string[];
  readonly coolBacked: boolean;
}

export interface SimulationStats {
  readonly totalActivities: number;
  readonly totalAudits: number;
  readonly spanDays: number;
  readonly activitiesNewerThanHero: number;
  readonly scenariosCovered: number;
  readonly byType: Readonly<Record<ActivityType, number>>;
  readonly byScenario: Readonly<Record<Scenario, number>>;
}

export interface SimulationResult {
  readonly simulationId: string;
  readonly generatedAt: string;
  readonly seed: number;
  readonly demoToday: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly heroAuditId: string;
  readonly heroExecutionId: string;
  readonly audits: readonly SimulatedAudit[];
  readonly executions: readonly SimulatedExecution[];
  readonly activities: readonly Activity[];
  readonly stats: SimulationStats;
}

export interface SimulationSummary {
  readonly simulationId: string;
  readonly seed: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly activityCount: number;
  readonly auditCount: number;
  readonly heroAuditId: string;
  readonly heroExecutionId: string;
  readonly stats: SimulationStats;
}
