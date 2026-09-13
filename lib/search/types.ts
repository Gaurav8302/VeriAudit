import type { ActivityStatus, ActivityType } from "@/lib/simulation";
import type { Scenario } from "@/lib/audit/types";

export type SearchKind = "audit" | "activity" | "finding" | "event";

export interface SearchDoc {
  readonly id: string;
  readonly kind: SearchKind;
  readonly entityWeight: number;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly type: string;
  readonly domain: Scenario;
  readonly auditId: string;
  readonly executionId: string | null;
  readonly activityId: string | null;
  readonly eventId: string | null;
  readonly findingId: string | null;
  readonly occurredAt: string;
  readonly status: string;
  readonly coolBacked: boolean;
}

export interface SearchFilters {
  readonly after?: string;
  readonly before?: string;
  readonly sinceDays?: 7 | 30 | 90;
  readonly domain?: Scenario;
  readonly type?: string;
  readonly auditId?: string;
  readonly status?: ActivityStatus | "completed" | "exception" | "in_review" | "scheduled" | "open";
  readonly evidence?: "cool" | "none" | "any";
}

export interface SearchHit {
  readonly activityId: string | null;
  readonly eventId: string | null;
  readonly findingId: string | null;
  readonly kind: SearchKind;
  readonly title: string;
  readonly description: string;
  readonly timestamp: string;
  readonly type: string;
  readonly domain: Scenario;
  readonly auditId: string;
  readonly executionId: string | null;
  readonly relevance: number;
  readonly matchedTerms: readonly string[];
  readonly tags: readonly string[];
  readonly status: string;
  readonly coolBacked: boolean;
  readonly snippet: string;
}

export interface SearchGroup {
  readonly auditId: string;
  readonly executionId: string | null;
  readonly title: string;
  readonly domain: Scenario;
  readonly score: number;
  readonly hitCount: number;
  readonly topHit: SearchHit;
}

export interface SearchResponse {
  readonly query: string;
  readonly tokens: readonly string[];
  readonly total: number;
  readonly results: readonly SearchHit[];
  readonly groups: readonly SearchGroup[];
  readonly suggestions: readonly string[];
}

export const ACTIVITY_TYPE_SET = new Set<ActivityType>([
  "audit",
  "control_test",
  "evidence_review",
  "finding",
  "follow_up",
  "human_review",
  "compliance_check",
  "vendor_review",
  "access_review",
]);
