import { describe, expect, it } from "vitest";
import { loadAuditWorkspace } from "@/lib/product/load";
import {
  addEvidence,
  addFinding,
  activitiesFor,
  buildSampleExport,
  closeExecution,
  createAudit,
  createExecution,
  EMPTY_WORKSPACE,
  evidenceFor,
  findingsFor,
  heroOriginalUnchanged,
  parseWorkspace,
  selectedExecutionId,
  selectExecution,
} from "@/lib/product/localWorkspace";
import {
  HERO_ORIGINAL_EVENT_COUNT,
  HERO_ORIGINAL_SNAPSHOT,
  snapshotExecution,
  catalogExecutions,
} from "@/lib/product/lineage";
import { featuredAudits, HERO_AUDIT_ID, HERO_EXECUTION_ID } from "@/lib/product/workspace";
import { PRODUCT_SHORTCUT } from "@/components/marketing/product-shortcut";

describe("local workspace operations", () => {
  it("creates a local open audit with one empty execution", () => {
    const { state, audit, execution } = createAudit(EMPTY_WORKSPACE, {
      title: "Q4 Access Review",
      domain: "access",
      description: "Sample review",
      createdAt: "2026-12-10T10:40:00.000Z",
    });
    expect(audit.auditId).toBe("AUD-LOCAL-001");
    expect(audit.status).toBe("open");
    expect(execution.executionId).toBe("EXEC-LOCAL-001-001");
    expect(execution.status).toBe("open");
    expect(execution.eventCount).toBe(0);
    expect(execution.hasEngineTrail).toBe(false);
    expect(state.audits).toHaveLength(1);
  });

  it("persists a local audit through serialize and parse", () => {
    const { state } = createAudit(EMPTY_WORKSPACE, {
      title: "Vendor review",
      domain: "vendor",
      description: "Sample",
    });
    const restored = parseWorkspace(JSON.parse(JSON.stringify(state)));
    expect(restored.audits[0]?.auditId).toBe("AUD-LOCAL-001");
    expect(restored.extras["AUD-LOCAL-001"]?.[0]?.executionId).toBe("EXEC-LOCAL-001-001");
  });

  it("adds sample evidence to the open execution", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Q4 Access Review",
      domain: "access",
      description: "Sample",
    });
    const { state, evidence } = addEvidence(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      title: "Access Log — Production",
      kind: "Access log",
      source: "IAM export",
      description: "December access review extract",
    });
    expect(evidence.artifactId).toBe("ART-LOCAL-001");
    expect(evidence.sample).toBe(true);
    expect(evidenceFor(state, created.audit.auditId)).toHaveLength(1);
  });

  it("adds a sample finding to the open execution", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Q4 Access Review",
      domain: "access",
      description: "Sample",
    });
    const { state, finding } = addFinding(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      title: "Stale privileged account",
      severity: "high",
      description: "Account still active after transfer",
    });
    expect(finding.findingId).toBe("F-LOCAL-001");
    expect(finding.executionId).toBe(created.execution.executionId);
    expect(findingsFor(state, created.audit.auditId)).toHaveLength(1);
  });

  it("creates another execution under the same audit", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Q4 Access Review",
      domain: "access",
      description: "Sample",
    });
    const closed = closeExecution(created.state, created.audit.auditId, created.execution.executionId, "2026-12-10T10:55:00.000Z");
    const { state, execution } = createExecution(closed.state, created.audit.auditId, "2026-12-10T11:00:00.000Z");
    expect(execution.executionId).toBe("EXEC-LOCAL-001-002");
    expect(execution.parentExecutionId).toBe(created.execution.executionId);
    expect(state.extras[created.audit.auditId]).toHaveLength(2);
  });

  it("reopens the sealed hero execution without rewriting it", () => {
    const { state, execution } = createExecution(EMPTY_WORKSPACE, HERO_AUDIT_ID);
    expect(execution.executionId).toBe("EXEC-FIN-2026-12-002");
    expect(execution.parentExecutionId).toBe(HERO_EXECUTION_ID);
    expect(snapshotExecution(catalogExecutions(HERO_AUDIT_ID)[0]!)).toEqual(HERO_ORIGINAL_SNAPSHOT);
    expect(heroOriginalUnchanged(state)).toBe(true);
  });

  it("refuses to attach work to the sealed hero original", () => {
    expect(() =>
      addEvidence(EMPTY_WORKSPACE, {
        auditId: HERO_AUDIT_ID,
        executionId: HERO_EXECUTION_ID,
        title: "Should fail",
        kind: "Ledger",
        source: "x",
        description: "x",
      }),
    ).toThrow(/sealed original/i);
  });

  it("records new activity on the new execution only", () => {
    const reopened = createExecution(EMPTY_WORKSPACE, HERO_AUDIT_ID);
    const withEvidence = addEvidence(reopened.state, {
      auditId: HERO_AUDIT_ID,
      executionId: reopened.execution.executionId,
      title: "Q3 General Ledger",
      kind: "Ledger",
      source: "Finance",
      description: "Sample",
    });
    expect(activitiesFor(withEvidence.state, HERO_AUDIT_ID, HERO_EXECUTION_ID)).toEqual([]);
    expect(activitiesFor(withEvidence.state, HERO_AUDIT_ID, reopened.execution.executionId).map((item) => item.type)).toEqual([
      "execution.opened",
      "evidence.added",
    ]);
    expect(withEvidence.state.activities.every((item) => item.sealed === false)).toBe(true);
  });

  it("keeps activity execution-specific after switching", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Split work",
      domain: "financial",
      description: "Sample",
    });
    const closed = closeExecution(created.state, created.audit.auditId, created.execution.executionId);
    const second = createExecution(closed.state, created.audit.auditId);
    const withFinding = addFinding(second.state, {
      auditId: created.audit.auditId,
      executionId: second.execution.executionId,
      title: "Revenue variance",
      severity: "medium",
      description: "Sample",
    });
    expect(findingsFor(withFinding.state, created.audit.auditId, created.execution.executionId)).toEqual([]);
    expect(findingsFor(withFinding.state, created.audit.auditId, second.execution.executionId)).toHaveLength(1);
    const switched = selectExecution(withFinding.state, created.audit.auditId, created.execution.executionId);
    expect(selectedExecutionId(switched, created.audit.auditId)).toBe(created.execution.executionId);
    expect(findingsFor(switched, created.audit.auditId, second.execution.executionId)[0]?.title).toBe("Revenue variance");
  });

  it("never claims CooL verification for a local WIP execution", () => {
    const { execution } = createAudit(EMPTY_WORKSPACE, {
      title: "Local",
      domain: "legal",
      description: "Sample",
    });
    expect(execution.hasEngineTrail).toBe(false);
    expect(execution.immutable).toBe(false);
    expect(execution.status).toBe("open");
  });

  it("leaves the hero reconstruction unchanged after local work", async () => {
    const before = await loadAuditWorkspace(HERO_AUDIT_ID);
    const reopened = createExecution(EMPTY_WORKSPACE, HERO_AUDIT_ID);
    const afterWork = addFinding(reopened.state, {
      auditId: HERO_AUDIT_ID,
      executionId: reopened.execution.executionId,
      title: "Local note",
      severity: "low",
      description: "Sample",
    });
    const after = await loadAuditWorkspace(HERO_AUDIT_ID);
    expect(after?.eventCount).toBe(HERO_ORIGINAL_EVENT_COUNT);
    expect(after?.events.map((event) => event.eventId)).toEqual(before?.events.map((event) => event.eventId));
    expect(after?.findings.map((item) => item.findingId)).toEqual(["F-FIN-001", "F-FIN-002", "F-FIN-003"]);
    expect(heroOriginalUnchanged(afterWork.state)).toBe(true);
  });

  it("exports sample data without claiming sealed receipts", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Export check",
      domain: "procurement",
      description: "Sample",
    });
    const exported = buildSampleExport(created.state, featuredAudits());
    expect(exported.notice).toMatch(/not an export of cryptographically sealed/i);
    expect(exported.hero.executionId).toBe(HERO_EXECUTION_ID);
    expect(exported.local.audits[0]?.auditId).toBe("AUD-LOCAL-001");
    expect(exported.catalog.some((row) => (row as { auditId: string }).auditId === HERO_AUDIT_ID)).toBe(true);
  });

  it("keeps the demo and product entry routes unchanged", () => {
    expect(PRODUCT_SHORTCUT.href).toBe("/product");
  });
});
