import { describe, expect, it } from "vitest";
import { loadAuditWorkspace } from "@/lib/product/load";
import {
  applyReopen,
  catalogExecutions,
  getExecution,
  HERO_ORIGINAL_EVENT_COUNT,
  HERO_ORIGINAL_FINDING_IDS,
  HERO_ORIGINAL_SNAPSHOT,
  mergeExecutions,
  reopenAudit,
  snapshotExecution,
} from "@/lib/product/lineage";
import { HERO_AUDIT_ID, HERO_EXECUTION_ID } from "@/lib/product/workspace";

describe("product reopen lifecycle", () => {
  it("starts the hero audit with only Execution 001", () => {
    const executions = catalogExecutions(HERO_AUDIT_ID);
    expect(executions).toHaveLength(1);
    expect(executions[0]?.executionId).toBe(HERO_EXECUTION_ID);
    expect(executions[0]?.label).toBe("Execution 001");
  });

  it("keeps Execution 001 sealed and immutable", () => {
    const original = catalogExecutions(HERO_AUDIT_ID)[0];
    expect(original?.status).toBe("sealed");
    expect(original?.immutable).toBe(true);
    expect(original?.parentExecutionId).toBeNull();
    expect(original?.eventCount).toBe(HERO_ORIGINAL_EVENT_COUNT);
    expect(original?.findingCount).toBe(HERO_ORIGINAL_FINDING_IDS.length);
  });

  it("creates Execution 002 linked to Execution 001", () => {
    const next = reopenAudit(HERO_AUDIT_ID, []);
    expect(next.executionId).toBe("EXEC-FIN-2026-12-002");
    expect(next.label).toBe("Execution 002");
    expect(next.parentExecutionId).toBe(HERO_EXECUTION_ID);
    expect(next.status).toBe("open");
    expect(next.createdAt).toBe("2026-12-10T09:00:00.000Z");
    expect(next.eventCount).toBe(0);
    expect(next.hasEngineTrail).toBe(false);
  });

  it("does not mutate Execution 001 when reopening", () => {
    const before = snapshotExecution(catalogExecutions(HERO_AUDIT_ID)[0]!);
    const { extras } = applyReopen(HERO_AUDIT_ID, []);
    const after = snapshotExecution(mergeExecutions(HERO_AUDIT_ID, extras)[0]!);
    expect(before).toEqual(HERO_ORIGINAL_SNAPSHOT);
    expect(after).toEqual(HERO_ORIGINAL_SNAPSHOT);
    expect(extras.some((item) => item.executionId === HERO_EXECUTION_ID)).toBe(false);
  });

  it("keeps Execution 001 events and findings unchanged", async () => {
    const before = await loadAuditWorkspace(HERO_AUDIT_ID);
    const { extras } = applyReopen(HERO_AUDIT_ID, []);
    const after = await loadAuditWorkspace(HERO_AUDIT_ID);
    const original = mergeExecutions(HERO_AUDIT_ID, extras)[0]!;
    expect(after?.events.map((event) => event.eventId)).toEqual(
      before?.events.map((event) => event.eventId),
    );
    expect(after?.eventCount).toBe(HERO_ORIGINAL_EVENT_COUNT);
    expect(original.eventCount).toBe(HERO_ORIGINAL_EVENT_COUNT);
    expect(after?.findings.map((item) => item.findingId)).toEqual([...HERO_ORIGINAL_FINDING_IDS]);
  });

  it("starts Execution 002 as a separate empty trace", () => {
    const next = reopenAudit(HERO_AUDIT_ID, []);
    expect(next.eventCount).toBe(0);
    expect(next.findingCount).toBe(0);
    expect(next.hasEngineTrail).toBe(false);
    expect(next.executionId).not.toBe(HERO_EXECUTION_ID);
  });

  it("does not mutate previous executions when reopening twice", () => {
    const first = applyReopen(HERO_AUDIT_ID, []);
    const firstChild = snapshotExecution(first.next);
    const second = applyReopen(HERO_AUDIT_ID, first.extras);
    const list = mergeExecutions(HERO_AUDIT_ID, second.extras);
    expect(list).toHaveLength(3);
    expect(snapshotExecution(list[0]!)).toEqual(HERO_ORIGINAL_SNAPSHOT);
    expect(snapshotExecution(list[1]!)).toEqual(firstChild);
    expect(second.next.executionId).toBe("EXEC-FIN-2026-12-003");
    expect(second.next.parentExecutionId).toBe(first.next.executionId);
    expect(second.next.createdAt).toBe("2026-12-11T09:00:00.000Z");
  });

  it("can still open the original execution after reopening", () => {
    const { extras, next } = applyReopen(HERO_AUDIT_ID, []);
    const original = getExecution(HERO_AUDIT_ID, HERO_EXECUTION_ID, extras);
    const child = getExecution(HERO_AUDIT_ID, next.executionId, extras);
    expect(original?.executionId).toBe(HERO_EXECUTION_ID);
    expect(original?.status).toBe("sealed");
    expect(child?.parentExecutionId).toBe(HERO_EXECUTION_ID);
  });

  it("orders executions chronologically", () => {
    const first = applyReopen(HERO_AUDIT_ID, []);
    const second = applyReopen(HERO_AUDIT_ID, first.extras);
    const times = mergeExecutions(HERO_AUDIT_ID, second.extras).map((item) => item.createdAt);
    expect(times).toEqual([...times].sort());
    expect(times[0]).toBe("2026-09-15T09:00:00.000Z");
    expect(times[1]).toBe("2026-12-10T09:00:00.000Z");
  });

  it("keeps the parent relationship deterministic", () => {
    const a = reopenAudit(HERO_AUDIT_ID, []);
    const b = reopenAudit(HERO_AUDIT_ID, []);
    expect(a).toEqual(b);
    expect(a.parentExecutionId).toBe(HERO_EXECUTION_ID);
  });

  it("ignores a tampered original if someone stores it with extras", () => {
    const tampered = {
      ...catalogExecutions(HERO_AUDIT_ID)[0]!,
      eventCount: 99,
      status: "open" as const,
    };
    const list = mergeExecutions(HERO_AUDIT_ID, [tampered]);
    expect(snapshotExecution(list[0]!)).toEqual(HERO_ORIGINAL_SNAPSHOT);
  });

  it("refuses to reopen a catalog-only audit", () => {
    expect(() => reopenAudit("AUD-FIN-2026-12", [])).toThrow(/engine-backed/i);
  });

  it("reopens legal, cyber, and procurement without rewriting the original", () => {
    for (const auditId of ["AUD-LEG-2026-08", "AUD-CYB-2026-09", "AUD-PRC-2026-09"]) {
      const original = catalogExecutions(auditId)[0]!;
      const next = reopenAudit(auditId, []);
      expect(next.parentExecutionId).toBe(original.executionId);
      expect(mergeExecutions(auditId, [next])[0]?.executionId).toBe(original.executionId);
      expect(original.immutable).toBe(true);
    }
  });
});
