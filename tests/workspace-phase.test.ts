import { describe, expect, it } from "vitest";
import {
  addEvidence,
  applyAiTurn,
  closeExecution,
  createAudit,
  createExecution,
  EMPTY_WORKSPACE,
  reviewFinding,
} from "@/lib/product/localWorkspace";
import { HERO_ORIGINAL_EXECUTION } from "@/lib/product/lineage";
import {
  canSealOnServer,
  primaryWorkspaceAction,
  sealReadiness,
  workspacePhase,
} from "@/lib/product/workspacePhase";

function seeded() {
  const created = createAudit(EMPTY_WORKSPACE, {
    title: "September Revenue Recognition",
    domain: "financial",
    description: "Review revenue recognition.",
    createdAt: "2026-09-15T09:00:00.000Z",
  });
  const withEvidence = addEvidence(created.state, {
    auditId: created.audit.auditId,
    executionId: created.execution.executionId,
    title: "Q3 Revenue Ledger",
    kind: "Ledger",
    source: "Upload",
    description: "Ledger",
    filename: "ledger.csv",
    fingerprint: "sha256:abc123",
    extraction: "text",
    createdAt: "2026-09-15T09:05:00.000Z",
  });
  const applied = applyAiTurn(withEvidence.state, {
    auditId: created.audit.auditId,
    executionId: created.execution.executionId,
    prompt: "Review the uploaded revenue evidence.",
    reply: "Revenue of $1,420,000 was recognized early.",
    actions: [
      {
        type: "READ_EVIDENCE",
        title: "Read ledger",
        detail: "Used extracted text",
        evidenceIds: [withEvidence.evidence.artifactId],
      },
      {
        type: "CREATE_FINDING",
        title: "Create finding",
        detail: "exception",
        evidenceIds: [withEvidence.evidence.artifactId],
        findingTitle: "Revenue recognized before performance obligation satisfied",
        findingSeverity: "high",
        findingDescription: "Needs review",
      },
    ],
    provider: "mock",
    model: "veriaudit-mock",
    requestId: "r-phase",
    mode: "mock",
    status: "ok",
    occurredAt: "2026-09-15T09:10:00.000Z",
  });
  return { created, applied, finding: applied.state.findings[0]! };
}

describe("workspace phase and seal CTA", () => {
  it("keeps an open AI run in review until humans decide", () => {
    const { created, applied, finding } = seeded();
    expect(finding.review).toBe("pending");
    expect(
      workspacePhase({
        execution: created.execution,
        hasSeal: false,
        findings: applied.state.findings,
        isCatalogSample: false,
      }),
    ).toBe("review");
    expect(
      primaryWorkspaceAction({ phase: "review", hasSeal: false, canReopen: false }),
    ).toBe("review");
  });

  it("does not offer Seal Execution while the run is still open", () => {
    const { created } = seeded();
    expect(canSealOnServer(created.execution, false)).toBe(false);
    expect(
      primaryWorkspaceAction({ phase: "active", hasSeal: false, canReopen: false }),
    ).toBe("continue");
  });

  it("requires human decisions and recorded events before a seal request", () => {
    const { created, applied, finding } = seeded();
    const reviewed = reviewFinding(applied.state, finding.findingId, "accepted");
    const closed = closeExecution(reviewed.state, created.audit.auditId, created.execution.executionId);
    const ready = sealReadiness({
      execution: closed.execution,
      hasSeal: false,
      findings: closed.state.findings,
      evidenceCount: closed.state.evidence.length,
      activityCount: closed.state.activities.length,
    });
    expect(workspacePhase({
      execution: closed.execution,
      hasSeal: false,
      findings: closed.state.findings,
      isCatalogSample: false,
    })).toBe("ready_to_seal");
    expect(ready.canRequestSeal).toBe(true);
    expect(primaryWorkspaceAction({ phase: "ready_to_seal", hasSeal: false, canReopen: true })).toBe("seal");
  });

  it("blocks the seal CTA when a finding is still pending", () => {
    const { created, applied } = seeded();
    const closed = closeExecution(applied.state, created.audit.auditId, created.execution.executionId);
    const ready = sealReadiness({
      execution: closed.execution,
      hasSeal: false,
      findings: closed.state.findings,
      evidenceCount: closed.state.evidence.length,
      activityCount: closed.state.activities.length,
    });
    expect(workspacePhase({
      execution: closed.execution,
      hasSeal: false,
      findings: closed.state.findings,
      isCatalogSample: false,
    })).toBe("review");
    expect(ready.canRequestSeal).toBe(false);
    expect(ready.checks.some((item) => item.label.toLowerCase().includes("human review") && !item.ok)).toBe(true);
  });

  it("never treats the hero catalog original as CooL-sealable", () => {
    expect(canSealOnServer(HERO_ORIGINAL_EXECUTION, false)).toBe(false);
    expect(
      workspacePhase({
        execution: HERO_ORIGINAL_EXECUTION,
        hasSeal: false,
        findings: [],
        isCatalogSample: true,
      }),
    ).toBe("sealed");
    expect(
      primaryWorkspaceAction({ phase: "sealed", hasSeal: false, canReopen: true }),
    ).toBe("reopen");
  });

  it("shows verify only after a real local seal bundle exists", () => {
    expect(primaryWorkspaceAction({ phase: "sealed", hasSeal: true, canReopen: true })).toBe("verify");
  });

  it("keeps the parent execution unchanged when a later run is opened", () => {
    const { created, applied, finding } = seeded();
    const reviewed = reviewFinding(applied.state, finding.findingId, "accepted");
    const closed = closeExecution(reviewed.state, created.audit.auditId, created.execution.executionId);
    const reopened = createExecution(closed.state, created.audit.auditId);
    const original = reopened.state.extras[created.audit.auditId]?.[0];
    expect(original?.executionId).toBe(created.execution.executionId);
    expect(original?.status).toBe("closed");
    expect(reopened.execution.parentExecutionId).toBe(created.execution.executionId);
    expect(reopened.execution.status).toBe("open");
    expect(
      workspacePhase({
        execution: reopened.execution,
        hasSeal: false,
        findings: [],
        isCatalogSample: false,
      }),
    ).toBe("reopened");
  });
});
