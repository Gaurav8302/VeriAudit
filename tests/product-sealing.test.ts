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
import { snapshotExecution } from "@/lib/product/lineage";
import { buildSealSnapshot } from "@/lib/product/productEvents";
import { sealProductExecution, verifyProductExecution } from "@/lib/product/seal";

function closedReviewWorkspace() {
  const created = createAudit(EMPTY_WORKSPACE, {
    title: "Revenue Recognition Review",
    domain: "financial",
    description: "Review revenue transactions.",
    createdAt: "2026-09-15T09:00:00.000Z",
  });
  const withEvidence = addEvidence(created.state, {
    auditId: created.audit.auditId,
    executionId: created.execution.executionId,
    title: "Q4 General Ledger",
    kind: "Ledger",
    source: "Upload",
    description: "Sample ledger",
    filename: "ledger.csv",
    fingerprint: "sha256:abc123def456",
    extraction: "text",
    createdAt: "2026-09-15T09:05:00.000Z",
  });
  const applied = applyAiTurn(withEvidence.state, {
    auditId: created.audit.auditId,
    executionId: created.execution.executionId,
    prompt: "Check revenue transactions.",
    reply: "One exception needs review.",
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
        findingTitle: "Revenue recognized too early",
        findingSeverity: "high",
        findingDescription: "Needs review",
      },
    ],
    provider: "mock",
    model: "veriaudit-mock",
    requestId: "r-seal",
    mode: "mock",
    status: "ok",
    occurredAt: "2026-09-15T09:10:00.000Z",
  });
  const reviewed = reviewFinding(
    applied.state,
    applied.state.findings[0]!.findingId,
    "accepted",
    undefined,
    "2026-09-15T09:20:00.000Z",
  );
  const closed = closeExecution(
    reviewed.state,
    created.audit.auditId,
    created.execution.executionId,
    "2026-09-15T09:30:00.000Z",
  );
  return {
    audit: created.audit,
    execution: closed.execution,
    state: closed.state,
    snapshot: buildSealSnapshot(closed.state, created.audit.auditId, closed.execution.executionId),
  };
}

const fixture = closedReviewWorkspace();
const seal = await sealProductExecution(fixture.snapshot);

describe("product CooL sealing", () => {
  it("records receipts and verifies identity, measurement, inclusion, and tree root", async () => {
    expect(seal.status).toBe("sealed");
    expect(seal.references.length).toBeGreaterThan(0);
    expect(Object.keys(seal.receipts).length).toBe(seal.eventIds.length);
    const verification = await verifyProductExecution(fixture.snapshot, seal);
    expect(verification.status).toBe("verified");
    expect(verification.eventsVerified).toBe(seal.eventIds.length);
    expect(verification.inclusion).toBe("pass");
    expect(verification.identity).toBe("verified");
    expect(verification.measurement).toBe("verified");
    expect(verification.integrity).toBe("verified");
    expect(verification.history).toBe("consistent");
    expect(verification.checks.trustedIdentity).toBe(true);
    expect(verification.checks.measurementPinned).toBe(true);
    expect(verification.checks.inclusion).toBe(true);
  });

  it("fails when a historical event payload is changed", async () => {
    const verification = await verifyProductExecution(fixture.snapshot, seal, {
      simulateTamper: "payload",
    });
    expect(verification.status).toBe("failed");
    expect(verification.claim).toMatch(/no longer matches/i);
  });

  it("fails when a historical leaf is removed", async () => {
    const verification = await verifyProductExecution(fixture.snapshot, seal, {
      simulateTamper: "delete-leaf",
    });
    expect(verification.status).toBe("failed");
  });

  it("fails when an evidence fingerprint is changed", async () => {
    const verification = await verifyProductExecution(fixture.snapshot, seal, {
      simulateTamper: "fingerprint",
    });
    expect(verification.status).toBe("failed");
  });

  it("fails when a finding or human review is changed", async () => {
    const finding = await verifyProductExecution(fixture.snapshot, seal, {
      simulateTamper: "finding",
    });
    const review = await verifyProductExecution(fixture.snapshot, seal, {
      simulateTamper: "review",
    });
    expect(finding.status).toBe("failed");
    expect(review.status).toBe("failed");
  });

  it("leaves the sealed original immutable after reopen", () => {
    const before = snapshotExecution(fixture.execution);
    const reopened = createExecution(fixture.state, fixture.audit.auditId, "2026-12-15T09:00:00.000Z");
    const original = reopened.state.extras[fixture.audit.auditId]!.find(
      (item) => item.executionId === fixture.execution.executionId,
    )!;
    expect(reopened.execution.parentExecutionId).toBe(fixture.execution.executionId);
    expect(original.status).toBe("closed");
    expect(snapshotExecution(original)).toEqual(before);
    expect(original.executionId).not.toBe(reopened.execution.executionId);
  });
});
