import type { ScenarioBriefing } from "@/lib/audit/scenarios/briefs";
import type { Scenario } from "@/lib/audit/types";
import type { SearchResponse } from "@/lib/search/types";
import type { Activity, SimulationStats } from "@/lib/simulation/types";

export interface ScenarioBrief {
  readonly scenarioId: Scenario;
  readonly displayName: string;
  readonly description: string;
  readonly isHero: boolean;
  readonly auditId: string;
  readonly executionId: string;
  readonly title: string;
  readonly period: string;
  readonly controlsInScope: number;
  readonly artifactsInScope: number;
  readonly expected: {
    readonly controlsTested: number;
    readonly controlsPassed: number;
    readonly exceptions: number;
    readonly findings: number;
  };
  readonly briefing?: ScenarioBriefing;
}

export interface CatalogueResponse {
  readonly heroScenarioId: Scenario;
  readonly scenarios: readonly ScenarioBrief[];
}

export interface TreeHead {
  readonly logId: string;
  readonly treeSize: number;
  readonly rootHash: string;
}

export interface FindingView {
  readonly findingId: string;
  readonly controlId: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly recommendedAction: string;
  readonly evidenceArtifactIds: readonly string[];
  readonly amountUsd: number | null;
  readonly status: string;
  readonly originalSeverity: string | null;
}

export interface ReviewView {
  readonly reviewId: string;
  readonly findingId: string;
  readonly reviewer: { readonly name: string; readonly role: string };
  readonly decision: string;
  readonly note: string;
  readonly reviewedAt: string;
  readonly modifiedSeverity: string | null;
}

export interface ArtifactView {
  readonly artifactId: string;
  readonly kind: string;
  readonly title: string;
  readonly mimeType: string;
  readonly rows: number | null;
  readonly content?: string;
  readonly parsed?: Readonly<Record<string, unknown>>;
}

export interface WhyStep {
  readonly eventId: string;
  readonly type: string;
  readonly title: string;
  readonly parentEventId: string | null;
  readonly sealed: boolean;
}

export interface TrailEventView {
  readonly eventId: string;
  readonly type: string;
  readonly title: string;
  readonly summary: string;
  readonly occurredAt: string;
  readonly parentEventId: string | null;
  readonly artifactRefs: readonly string[];
  readonly findingRef: string | null;
  readonly reviewRef: string | null;
  readonly controlRef: string | null;
  readonly canonical: boolean;
  readonly cool: { recordId?: string; bindingHash?: string } | null;
}

export interface RunPayload {
  readonly audit: {
    readonly auditId: string;
    readonly executionId: string;
    readonly scenarioId: Scenario;
    readonly title: string;
    readonly period: string;
    readonly openedAt: string;
    readonly summary: {
      readonly controlsTested: number;
      readonly controlsPassed: number;
      readonly exceptions: number;
      readonly findings: number;
      readonly humanReviewsCompleted: number;
      readonly humanReviewsPending: number;
      readonly humanReviewCompleted: boolean;
    };
    readonly conclusion: {
      readonly statement: string;
      readonly concludedAt: string;
      readonly controlsTested: number;
      readonly controlsPassed: number;
      readonly exceptions: number;
      readonly findings: number;
      readonly humanReviewsCompleted: number;
      readonly humanReviewsPending: number;
    };
    readonly findings: readonly FindingView[];
    readonly reviews: readonly ReviewView[];
    readonly artifacts: readonly ArtifactView[];
    readonly reasoning: {
      readonly assessment: string;
      readonly observations: readonly string[];
      readonly model: { readonly name: string; readonly version: string };
    };
  };
  readonly trail: {
    readonly why: { readonly path: readonly WhyStep[] };
    readonly events: readonly TrailEventView[];
  };
  readonly sealing: {
    readonly attempted: number;
    readonly sealed: number;
    readonly error: string | null;
    readonly treeHead: TreeHead | null;
  };
  readonly logState: unknown;
  readonly receipts: Record<string, unknown>;
}

export interface IntegrityView {
  readonly status: "verified" | "failed" | "unavailable" | "not-recorded";
  readonly cool?: string;
  readonly identity?: string;
  readonly reason?: string;
  readonly reasons?: readonly string[];
  readonly verified?: number;
  readonly failed?: number;
  readonly rootsMatch?: boolean;
}

export interface ReconstructionPayload {
  readonly kind: "engine" | "catalog";
  readonly auditId: string;
  readonly executionId: string | null;
  readonly hasEngineTrail: boolean;
  readonly audit?: Record<string, unknown>;
  readonly evidence?: readonly ArtifactView[];
  readonly findings?: readonly FindingView[];
  readonly reviews?: readonly ReviewView[];
  readonly conclusion?: RunPayload["audit"]["conclusion"];
  readonly retrieval?: { readonly query: string; readonly passages: readonly string[] };
  readonly reasoning?: RunPayload["audit"]["reasoning"];
  readonly controls?: readonly {
    readonly controlId: string;
    readonly name: string;
    readonly status: string;
    readonly rationale: string;
    readonly findingId: string | null;
    readonly artifactIds: readonly string[];
  }[];
  readonly trail?: {
    readonly why?: { readonly path: readonly WhyStep[] };
    readonly events?: readonly TrailEventView[];
  };
  readonly why?: {
    readonly question: string;
    readonly answerSource: string;
    readonly note?: string;
    readonly path: readonly WhyStep[];
    readonly evidence?: readonly { readonly artifactId: string; readonly title: string }[];
    readonly primaryFinding?: FindingView | null;
    readonly primaryReview?: ReviewView | null;
    readonly conclusion?: RunPayload["audit"]["conclusion"];
  };
  readonly graph?: {
    readonly nodes: readonly {
      readonly eventId: string;
      readonly parentEventId: string | null;
      readonly eventType: string;
      readonly title: string;
      readonly references: {
        readonly artifacts: readonly string[];
        readonly finding: string | null;
        readonly review: string | null;
        readonly control: string | null;
      };
    }[];
    readonly edges: readonly { readonly from: string; readonly to: string }[];
    readonly spineEventIds: readonly string[];
  };
  readonly integrity: IntegrityView;
}

export interface SessionEvidence {
  readonly auditId: string;
  readonly executionId: string;
  readonly receipts: Record<string, unknown>;
  readonly logState: unknown;
  readonly treeHead: TreeHead | null;
}

export interface SimulationFeed {
  readonly simulationId: string;
  readonly seed: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly activityCount: number;
  readonly auditCount: number;
  readonly heroAuditId: string;
  readonly heroExecutionId: string;
  readonly stats: SimulationStats;
  readonly activities: readonly Activity[];
}

export type { Activity, SearchResponse };
