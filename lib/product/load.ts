/**
 * Product workspace loaders. Reconstruction is the existing search path
 * (deterministic trail, no seal). This is not a new audit run and does not
 * claim verification.
 */
import { reconstructAudit } from "@/lib/search";
import type { Finding, HumanReview } from "@/lib/audit";
import {
  getWorkspaceAudit,
  listHeroEvidence,
  listHeroFindings,
  type WorkspaceArtifact,
  type WorkspaceAudit,
  type WorkspaceFinding,
} from "./workspace";

export interface AuditWorkspaceData {
  readonly audit: WorkspaceAudit;
  readonly kind: "engine" | "catalog";
  readonly findings: readonly WorkspaceFinding[];
  readonly evidence: readonly WorkspaceArtifact[];
  readonly eventCount: number | null;
  readonly spine: readonly { eventId: string; title: string; type: string }[];
  readonly events: readonly {
    eventId: string;
    title: string;
    type: string;
    occurredAt?: string;
    executionId?: string;
    findingRef?: string | null;
    artifactRefs?: readonly string[];
  }[];
  readonly retrievalQuery: string | null;
  readonly assessment: string | null;
  readonly conclusion: {
    readonly controlsTested: number;
    readonly controlsPassed: number;
    readonly exceptions: number;
    readonly findings: number;
    readonly humanReviews: number;
  } | null;
}

export async function loadAuditWorkspace(auditId: string): Promise<AuditWorkspaceData | null> {
  const audit = getWorkspaceAudit(auditId);
  if (!audit) return null;

  if (!audit.hasEngineTrail) {
    return {
      audit,
      kind: "catalog",
      findings: [],
      evidence: [],
      eventCount: null,
      spine: [],
      events: [],
      retrievalQuery: null,
      assessment: null,
      conclusion: null,
    };
  }

  const reconstruction = await reconstructAudit(auditId);
  if (!reconstruction || reconstruction.kind !== "engine") {
    return {
      audit,
      kind: "catalog",
      findings: audit.auditId === listHeroFindings()[0]?.auditId ? listHeroFindings() : [],
      evidence: audit.auditId === listHeroFindings()[0]?.auditId ? listHeroEvidence() : [],
      eventCount: null,
      spine: [],
      events: [],
      retrievalQuery: null,
      assessment: null,
      conclusion: null,
    };
  }

  const reviews = "reviews" in reconstruction ? reconstruction.reviews : [];
  const findings =
    "findings" in reconstruction
      ? reconstruction.findings.map((finding) =>
          mapEngineFinding(finding, reviews, reconstruction.audit.title),
        )
      : listHeroFindings();

  const evidence =
    "evidence" in reconstruction
      ? reconstruction.evidence.map((item) => ({
          artifactId: item.artifactId,
          title: item.title,
          kind: item.kind,
          auditId: reconstruction.auditId,
          auditTitle: reconstruction.audit.title,
          mimeType: item.mimeType,
          record: "sample" as const,
        }))
      : listHeroEvidence();

  const spine =
    "why" in reconstruction
      ? reconstruction.why.path.map((step) => ({
          eventId: step.eventId,
          title: step.title,
          type: step.type,
        }))
      : [];

  const events =
    "trail" in reconstruction
      ? reconstruction.trail.events.map((event) => ({
          eventId: event.eventId,
          title: event.title,
          type: event.type,
          occurredAt: "occurredAt" in event ? event.occurredAt : undefined,
          executionId: "executionId" in event ? event.executionId : undefined,
          findingRef: "findingRef" in event ? event.findingRef : undefined,
          artifactRefs: "artifactRefs" in event ? event.artifactRefs : undefined,
        }))
      : [];

  return {
    audit,
    kind: "engine",
    findings,
    evidence,
    eventCount: "trail" in reconstruction ? reconstruction.trail.counts.events : events.length,
    spine,
    events,
    retrievalQuery: "retrieval" in reconstruction ? reconstruction.retrieval.query : null,
    assessment: "reasoning" in reconstruction ? reconstruction.reasoning.assessment : null,
    conclusion:
      "conclusion" in reconstruction
        ? {
            controlsTested: reconstruction.conclusion.controlsTested,
            controlsPassed: reconstruction.conclusion.controlsPassed,
            exceptions: reconstruction.conclusion.exceptions,
            findings: reconstruction.conclusion.findings,
            humanReviews: reconstruction.conclusion.humanReviewsCompleted,
          }
        : null,
  };
}

function mapEngineFinding(
  finding: Finding,
  reviews: readonly HumanReview[],
  auditTitle: string,
): WorkspaceFinding {
  const review = reviews.find((item) => item.findingId === finding.findingId);
  return {
    findingId: finding.findingId,
    title: finding.title,
    auditId: finding.auditId,
    auditTitle,
    severity: finding.severity,
    review: review?.decision === "modified" ? "modified" : review ? "accepted" : "open",
    controlId: finding.controlId,
    evidence: finding.evidenceArtifactIds,
    record: "sample",
    description: finding.description,
    rationale: finding.rationale,
    recommendedAction: finding.recommendedAction,
    amountUsd: finding.amountUsd,
    reviewNote: review?.note,
    reviewer: review ? `${review.reviewer.name}, ${review.reviewer.role}` : undefined,
  };
}

export function relatedFindings(
  artifactId: string,
  findings: readonly WorkspaceFinding[],
): readonly WorkspaceFinding[] {
  return findings.filter((finding) => finding.evidence.includes(artifactId));
}
