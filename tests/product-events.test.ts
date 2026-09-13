import { describe, expect, it } from "vitest";
import { contentDigest } from "@/lib/cool/canonical";
import { canonicalEventsFor } from "@/lib/product/canonicalEvents";
import {
  addEvidence,
  applyAiTurn,
  attachSeal,
  closeExecution,
  createAudit,
  createExecution,
  EMPTY_WORKSPACE,
  reviewFinding,
} from "@/lib/product/localWorkspace";
import { snapshotExecution, HERO_ORIGINAL_SNAPSHOT, catalogExecutions } from "@/lib/product/lineage";
import {
  assertAppendOnlyChain,
  buildSealSnapshot,
  eventsFromSnapshot,
  PRODUCT_TO_COOL,
} from "@/lib/product/productEvents";
import { PRODUCT_SEAL_SCHEMA, type ExecutionSealBundle } from "@/lib/product/sealTypes";
import { HERO_AUDIT_ID, HERO_EXECUTION_ID } from "@/lib/product/workspace";

function reviewedWorkspace(closed = true) {
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
        chunkIds: [],
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
    requestId: "r1",
    mode: "mock",
    status: "ok",
    occurredAt: "2026-09-15T09:10:00.000Z",
  });
  const finding = applied.state.findings[0]!;
  const reviewed = reviewFinding(
    applied.state,
    finding.findingId,
    "accepted",
    undefined,
    "2026-09-15T09:20:00.000Z",
  );
  const next = closed
    ? closeExecution(
        reviewed.state,
        created.audit.auditId,
        created.execution.executionId,
        "2026-09-15T09:30:00.000Z",
      )
    : { state: reviewed.state, execution: created.execution };
  return {
    audit: created.audit,
    execution: next.execution,
    evidence: withEvidence.evidence,
    finding,
    state: next.state,
  };
}

function emptySeal(executionId: string, auditId: string): ExecutionSealBundle {
  return {
    schema: PRODUCT_SEAL_SCHEMA,
    executionId,
    auditId,
    sealedAt: "2026-09-15T10:00:00.000Z",
    status: "sealed",
    logState: [],
    treeHead: null,
    contentDigests: [],
    eventIds: [],
    events: [],
    references: [],
    receipts: {},
  };
}

describe("canonical product events", () => {
  it("builds an ordered parent chain with evidence fingerprints", () => {
    const fixture = reviewedWorkspace();
    const snapshot = buildSealSnapshot(fixture.state, fixture.audit.auditId, fixture.execution.executionId);
    expect(JSON.stringify(snapshot)).not.toMatch(/textExcerpt|Check revenue transactions/);
    const events = eventsFromSnapshot(snapshot);
    expect(assertAppendOnlyChain(events)).toBeNull();
    const names = events.map((item) => item.detail.product_event);
    expect(names[0]).toBe("audit.execution.started");
    expect(names.at(-1)).toBe("audit.execution.closed");
    expect(names).toContain("evidence.ingested");
    expect(names).toContain("evidence.read");
    expect(names).toContain("ai.action.started");
    expect(names).toContain("ai.action.completed");
    expect(names).toContain("finding.created");
    expect(names).toContain("finding.reviewed");
    expect(names.filter((item) => item === "ai.action.started")).toHaveLength(2);
    expect(events[0]!.parentEventId).toBeNull();
    expect(events[1]!.parentEventId).toBe(events[0]!.eventId);
    const ingested = events.find((item) => item.detail.product_event === "evidence.ingested")!;
    expect(ingested.detail.evidence_refs).toEqual([
      { evidence_id: fixture.evidence.artifactId, fingerprint: "sha256:abc123def456" },
    ]);
    expect(ingested.type).toBe(PRODUCT_TO_COOL["evidence.ingested"]);
  });

  it("hashes the same canonical event deterministically", () => {
    const fixture = reviewedWorkspace();
    const snapshot = buildSealSnapshot(fixture.state, fixture.audit.auditId, fixture.execution.executionId);
    const a = eventsFromSnapshot(snapshot);
    const b = eventsFromSnapshot(snapshot);
    expect(a.map(contentDigest)).toEqual(b.map(contentDigest));
    expect(contentDigest(a[0]!)).not.toBe(contentDigest({ ...a[0]!, title: "altered" }));
  });

  it("records human review as a human decision, never as the AI reviewer", () => {
    const fixture = reviewedWorkspace();
    const events = eventsFromSnapshot(
      buildSealSnapshot(fixture.state, fixture.audit.auditId, fixture.execution.executionId),
    );
    const reviewed = events.find((item) => item.detail.product_event === "finding.reviewed")!;
    expect(reviewed.actor).toBe("human");
    expect(reviewed.detail.reviewer_type).toBe("human");
    expect(reviewed.detail.decision).toBe("accepted");
    expect(reviewed.type).toBe("human.review.completed");
  });

  it("includes AI start/complete and evidence.read events", () => {
    const fixture = reviewedWorkspace();
    const names = eventsFromSnapshot(
      buildSealSnapshot(fixture.state, fixture.audit.auditId, fixture.execution.executionId),
    ).map((item) => item.detail.product_event);
    expect(names).toContain("ai.action.started");
    expect(names).toContain("ai.action.completed");
    expect(names).toContain("evidence.read");
    expect(
      canonicalEventsFor(fixture.state, fixture.execution.executionId).some((item) => item.type === "evidence.read"),
    ).toBe(true);
  });

  it("keeps the closed original unchanged when a later execution is opened", () => {
    const fixture = reviewedWorkspace();
    const before = snapshotExecution(fixture.execution);
    const sealed = attachSeal(
      fixture.state,
      fixture.execution.executionId,
      emptySeal(fixture.execution.executionId, fixture.audit.auditId),
    );
    const reopened = createExecution(sealed, fixture.audit.auditId, "2026-12-15T09:00:00.000Z");
    const original = reopened.state.extras[fixture.audit.auditId]!.find(
      (item) => item.executionId === fixture.execution.executionId,
    )!;
    expect(reopened.execution.executionId).toBe("EXEC-LOCAL-001-002");
    expect(reopened.execution.parentExecutionId).toBe(fixture.execution.executionId);
    expect(snapshotExecution(original)).toEqual(before);
    expect(sealed.seals[fixture.execution.executionId]?.status).toBe("sealed");
    expect(reopened.state.seals[fixture.execution.executionId]?.status).toBe("sealed");
    expect(reopened.state.seals[reopened.execution.executionId]).toBeUndefined();
  });

  it("refuses to attach a seal to the hero original", () => {
    expect(() =>
      attachSeal(EMPTY_WORKSPACE, HERO_EXECUTION_ID, emptySeal(HERO_EXECUTION_ID, HERO_AUDIT_ID)),
    ).toThrow(/original/i);
    expect(() =>
      buildSealSnapshot(EMPTY_WORKSPACE, HERO_AUDIT_ID, HERO_EXECUTION_ID),
    ).toThrow(/original/i);
    expect(snapshotExecution(catalogExecutions(HERO_AUDIT_ID)[0]!)).toEqual(HERO_ORIGINAL_SNAPSHOT);
  });
});
