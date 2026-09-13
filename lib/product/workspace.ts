/**
 * Read-only product views over the locked catalog and hero scenario.
 *
 * Every row here is SAMPLE / NOT RECORDED unless a live verification call
 * actually succeeded. This module does not run CooL and does not invent AI.
 */
import { financialScenario, SCENARIOS } from "@/lib/audit/scenarios";
import { AUDITS } from "@/lib/simulation/catalog";
import { generateHistory } from "@/lib/simulation";
import type { Scenario } from "@/lib/audit/types";

export const HERO_AUDIT_ID = financialScenario.auditId;
export const HERO_EXECUTION_ID = financialScenario.executionId;

export type ProductDomain = Scenario | "vendor" | "access";
export type RecordLabel = "sample" | "not-recorded";

export interface WorkspaceAudit {
  readonly auditId: string;
  readonly title: string;
  readonly domain: ProductDomain;
  readonly status: "completed" | "in_review" | "open";
  readonly period: string;
  readonly openedAt: string;
  readonly lastActivity: string;
  readonly findingCount: number;
  readonly executionId: string | null;
  readonly executionCount: number;
  readonly hasEngineTrail: boolean;
  readonly record: RecordLabel;
  readonly featured: boolean;
  readonly evidenceCount?: number;
  readonly origin?: "catalog" | "local";
  readonly description?: string;
}

export interface WorkspaceFinding {
  readonly findingId: string;
  readonly title: string;
  readonly auditId: string;
  readonly auditTitle: string;
  readonly severity: "high" | "medium" | "low";
  readonly review: "accepted" | "modified" | "open";
  readonly controlId: string;
  readonly evidence: readonly string[];
  readonly record: RecordLabel;
  readonly description?: string;
  readonly rationale?: string;
  readonly recommendedAction?: string;
  readonly amountUsd?: number | null;
  readonly reviewNote?: string;
  readonly reviewer?: string;
}

export interface WorkspaceArtifact {
  readonly artifactId: string;
  readonly title: string;
  readonly kind: string;
  readonly auditId: string;
  readonly auditTitle: string;
  readonly mimeType: string;
  readonly record: RecordLabel;
}

export interface WorkspaceExecution {
  readonly executionId: string;
  readonly auditId: string;
  readonly auditTitle: string;
  readonly domain: ProductDomain;
  readonly startedAt: string;
  readonly status: string;
  readonly record: RecordLabel;
  readonly hasEngineTrail: boolean;
  readonly note: string;
}

export const FEATURED_AUDIT_IDS = [
  "AUD-FIN-2026-09",
  "AUD-LEG-2026-08",
  "AUD-CYB-2026-09",
  "AUD-PRC-2026-09",
  "AUD-FIN-2026-12",
  "AUD-LEG-2026-10",
  "AUD-CYB-2026-10",
  "AUD-PRC-2026-10",
] as const;

const HERO_FINDINGS: readonly WorkspaceFinding[] = [
  {
    findingId: "F-FIN-001",
    title: "Revenue recognised before performance obligation satisfied",
    auditId: HERO_AUDIT_ID,
    auditTitle: financialScenario.title,
    severity: "high",
    review: "accepted",
    controlId: "REV-REC-01",
    evidence: ["ART-FIN-001", "ART-FIN-002", "ART-FIN-004"],
    record: "sample",
  },
  {
    findingId: "F-FIN-002",
    title: "Revenue entry approved above delegated authority",
    auditId: HERO_AUDIT_ID,
    auditTitle: financialScenario.title,
    severity: "medium",
    review: "accepted",
    controlId: "APR-CHAIN-06",
    evidence: ["ART-FIN-001"],
    record: "sample",
  },
  {
    findingId: "F-FIN-003",
    title: "Revenue entry posted and approved by the same person",
    auditId: HERO_AUDIT_ID,
    auditTitle: financialScenario.title,
    severity: "low",
    review: "modified",
    controlId: "SEG-DUT-10",
    evidence: ["ART-FIN-001", "ART-FIN-004"],
    record: "sample",
  },
];

export function domainLabel(domain: ProductDomain): string {
  if (domain === "cyber") return "Cybersecurity";
  if (domain === "legal") return "Legal";
  if (domain === "procurement") return "Procurement";
  if (domain === "vendor") return "Vendor Compliance";
  if (domain === "access") return "Access Control";
  return "Financial";
}

export function listWorkspaceAudits(): WorkspaceAudit[] {
  return AUDITS.map((audit) => ({
    auditId: audit.auditId,
    title: audit.title,
    domain: audit.scenario,
    status: audit.status,
    period: audit.period,
    openedAt: audit.openedAt,
    lastActivity: audit.closedAt ?? audit.openedAt,
    findingCount: audit.summary?.findings ?? 0,
    executionId: audit.executionIds[0] ?? null,
    executionCount: audit.executionIds.length,
    hasEngineTrail: audit.hasEngineTrail,
    record: "sample",
    featured: FEATURED_AUDIT_IDS.includes(audit.auditId as (typeof FEATURED_AUDIT_IDS)[number]),
  }));
}

export function featuredAudits(): WorkspaceAudit[] {
  const all = listWorkspaceAudits();
  return FEATURED_AUDIT_IDS.map((id) => all.find((audit) => audit.auditId === id)).filter(
    (audit): audit is WorkspaceAudit => Boolean(audit),
  );
}

export function getWorkspaceAudit(auditId: string): WorkspaceAudit | null {
  return listWorkspaceAudits().find((audit) => audit.auditId === auditId) ?? null;
}

export function listWorkspaceExecutions(): WorkspaceExecution[] {
  return listWorkspaceAudits()
    .filter((audit) => audit.executionId)
    .map((audit) => ({
      executionId: audit.executionId!,
      auditId: audit.auditId,
      auditTitle: audit.title,
      domain: audit.domain,
      startedAt: audit.openedAt,
      status: audit.status,
      record: "sample",
      hasEngineTrail: audit.hasEngineTrail,
      note: audit.hasEngineTrail
        ? "Catalog execution with an engine trail. Not verified in this product view."
        : "Catalog-only simulated execution. No CooL receipts.",
    }));
}

export function listHeroEvidence(): WorkspaceArtifact[] {
  return financialScenario.artifacts.map((artifact) => ({
    artifactId: artifact.artifactId,
    title: artifact.title,
    kind: artifact.kind,
    auditId: financialScenario.auditId,
    auditTitle: financialScenario.title,
    mimeType: artifact.mimeType,
    record: "sample",
  }));
}

export function listEngineEvidence(): WorkspaceArtifact[] {
  return SCENARIOS.flatMap((scenario) =>
    scenario.artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      title: artifact.title,
      kind: artifact.kind,
      auditId: scenario.auditId,
      auditTitle: scenario.title,
      mimeType: artifact.mimeType,
      record: "sample" as const,
    })),
  );
}

export function getArtifactContent(artifactId: string): { filename: string; text: string } | null {
  for (const scenario of SCENARIOS) {
    const artifact = scenario.artifacts.find((item) => item.artifactId === artifactId);
    if (artifact) {
      return { filename: `${artifact.artifactId}.txt`, text: artifact.content };
    }
  }
  return null;
}

export function listHeroFindings(): readonly WorkspaceFinding[] {
  return HERO_FINDINGS;
}

export function recentActivity(limit = 8) {
  const history = generateHistory();
  return history.activities.slice(0, limit).map((activity) => ({
    activityId: activity.activityId,
    title: activity.title,
    occurredAt: activity.occurredAt,
    type: activity.type,
    domain: activity.scenario,
    auditId: activity.auditId,
    status: activity.status,
    record: "sample" as const,
  }));
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return formatDay(iso);
  const delta = Math.max(0, now - then);
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDay(iso);
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function recordLabel(record: RecordLabel): string {
  return record === "sample" ? "Sample" : "Not recorded";
}

export function heroConclusion() {
  return {
    controlsTested: financialScenario.expected.controlsTested,
    controlsPassed: financialScenario.expected.controlsPassed,
    exceptions: financialScenario.expected.exceptions,
    findings: financialScenario.expected.findings,
    humanReviews: Object.keys(financialScenario.reviewPolicy.decisions).length,
    period: financialScenario.period,
    openedAt: financialScenario.openedAt,
    statement:
      "Controls were tested against authored evidence. Exceptions are the three recorded findings.",
  };
}

export function visibleAudits(): WorkspaceAudit[] {
  return featuredAudits();
}

export function filterAudits(query: string, audits = visibleAudits()): WorkspaceAudit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return audits;
  return audits.filter((audit) => {
    const hay = [audit.title, audit.auditId, domainLabel(audit.domain), audit.executionId ?? ""]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}
