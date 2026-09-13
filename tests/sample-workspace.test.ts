import { describe, expect, it } from "vitest";
import {
  addEvidence,
  applyAiTurn,
  closeExecution,
  createExecution,
  EMPTY_WORKSPACE,
  ensureSampleWorkspace,
  isWritableExecution,
  resetSampleWorkspace,
  reviewFinding,
  SAMPLE_AUDIT_ID,
  SAMPLE_EXECUTION_ID,
} from "@/lib/product/localWorkspace";
import { HERO_AUDIT_ID } from "@/lib/product/workspace";
import { snapshotExecution } from "@/lib/product/lineage";
import { catalogExecutions } from "@/lib/product/lineage";
import { workspacePhase } from "@/lib/product/workspacePhase";

function withFinding(state = EMPTY_WORKSPACE) {
  const sample = resetSampleWorkspace(state, "2026-09-14T09:00:00.000Z");
  const withEvidence = addEvidence(sample.state, {
    auditId: SAMPLE_AUDIT_ID,
    executionId: SAMPLE_EXECUTION_ID,
    title: "Q3 Revenue Ledger",
    kind: "Ledger",
    source: "Sample pack",
    description: "Ledger",
    filename: "ledger.csv",
    fingerprint: "sha256:sample",
    extraction: "text",
    createdAt: "2026-09-14T09:05:00.000Z",
  });
  const applied = applyAiTurn(withEvidence.state, {
    auditId: SAMPLE_AUDIT_ID,
    executionId: SAMPLE_EXECUTION_ID,
    prompt: "Review the uploaded revenue evidence.",
    reply: "Revenue of $1,420,000 was recognized early.",
    actions: [
      {
        type: "ANALYZE_EVIDENCE",
        title: "Analyze ledger",
        detail: "Used extracted text",
        evidenceIds: [withEvidence.evidence.artifactId],
      },
      {
        type: "CREATE_FINDING",
        title: "Create finding",
        detail: "exception",
        evidenceIds: [withEvidence.evidence.artifactId],
        findingTitle: "Revenue recognition exception",
        findingSeverity: "high",
        findingDescription: "Needs human review",
      },
    ],
    provider: "mock",
    model: "veriaudit-mock",
    requestId: "r-sample",
    mode: "mock",
    status: "ok",
    occurredAt: "2026-09-14T09:10:00.000Z",
  });
  return { sample, applied, finding: applied.state.findings[0]! };
}

describe("canonical sample workspace", () => {
  it("starts on writable Execution 001, not the sealed catalog hero", () => {
    const { state, audit, execution } = resetSampleWorkspace(EMPTY_WORKSPACE, "2026-09-14T09:00:00.000Z");
    expect(audit.auditId).toBe(SAMPLE_AUDIT_ID);
    expect(audit.auditId).not.toBe(HERO_AUDIT_ID);
    expect(audit.title).toBe("September Revenue Recognition Audit");
    expect(execution.executionId).toBe(SAMPLE_EXECUTION_ID);
    expect(execution.label).toBe("Execution 001");
    expect(execution.status).toBe("open");
    expect(isWritableExecution(execution)).toBe(true);
    expect(
      workspacePhase({
        execution,
        hasSeal: false,
        findings: state.findings,
        isCatalogSample: false,
      }),
    ).toBe("active");
    expect(state.extras[SAMPLE_AUDIT_ID]).toHaveLength(1);
  });

  it("does not accumulate extra executions across a fresh sample start", () => {
    const first = resetSampleWorkspace(EMPTY_WORKSPACE, "2026-09-14T09:00:00.000Z");
    const closed = closeExecution(first.state, SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID);
    const reopened = createExecution(closed.state, SAMPLE_AUDIT_ID, "2026-09-14T10:00:00.000Z");
    expect(reopened.state.extras[SAMPLE_AUDIT_ID]).toHaveLength(2);

    const reset = resetSampleWorkspace(reopened.state, "2026-09-14T11:00:00.000Z");
    expect(reset.execution.executionId).toBe(SAMPLE_EXECUTION_ID);
    expect(reset.execution.label).toBe("Execution 001");
    expect(reset.state.extras[SAMPLE_AUDIT_ID]).toHaveLength(1);
    expect(reset.state.findings).toEqual([]);
    expect(ensureSampleWorkspace(reset.state).created).toBe(false);
  });

  it("records Accept and Dismiss as persisted human-review events", () => {
    const { applied, finding } = withFinding();
    const accepted = reviewFinding(applied.state, finding.findingId, "accepted");
    expect(accepted.finding.review).toBe("accepted");
    expect(accepted.state.findings[0]?.review).toBe("accepted");
    expect(
      accepted.state.activities.some(
        (item) => item.type === "finding.reviewed" && item.subjectId === finding.findingId,
      ),
    ).toBe(true);

    const dismissed = reviewFinding(applied.state, finding.findingId, "rejected");
    expect(dismissed.finding.review).toBe("rejected");
    expect(
      dismissed.state.activities.some(
        (item) =>
          item.type === "finding.reviewed" &&
          item.subjectId === finding.findingId &&
          item.detail.toLowerCase().includes("reject"),
      ),
    ).toBe(true);
  });

  it("leaves the sealed catalog original untouched", () => {
    const { applied, finding } = withFinding();
    const accepted = reviewFinding(applied.state, finding.findingId, "accepted");
    const original = catalogExecutions(HERO_AUDIT_ID)[0]!;
    expect(snapshotExecution(original).executionId).toBe("EXEC-FIN-2026-09-001");
    expect(accepted.state.extras[HERO_AUDIT_ID]).toBeUndefined();
  });
});
