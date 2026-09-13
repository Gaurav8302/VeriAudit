import { describe, expect, it } from "vitest";
import { isAuditWorkspace, pageMeta } from "@/lib/product/pageMeta";
import {
  featuredAudits,
  listHeroFindings,
  listWorkspaceAudits,
  listWorkspaceExecutions,
} from "@/lib/product/workspace";

describe("product workspace catalog", () => {
  it("surfaces eight featured sample audits without claiming verification", () => {
    const featured = featuredAudits();
    expect(featured).toHaveLength(8);
    expect(featured.every((audit) => audit.record === "sample")).toBe(true);
    expect(featured.some((audit) => audit.auditId === "AUD-FIN-2026-09")).toBe(true);
  });

  it("keeps catalog executions labelled sample", () => {
    const executions = listWorkspaceExecutions();
    expect(executions.length).toBeGreaterThan(0);
    expect(executions.every((item) => item.record === "sample")).toBe(true);
    expect(executions.some((item) => item.executionId === "EXEC-FIN-2026-09-001")).toBe(true);
  });

  it("exposes the three hero findings as sample records", () => {
    const findings = listHeroFindings();
    expect(findings.map((item) => item.findingId)).toEqual(["F-FIN-001", "F-FIN-002", "F-FIN-003"]);
    expect(findings.every((item) => item.record === "sample")).toBe(true);
  });

  it("keeps product page titles distinct from workspace chrome", () => {
    expect(pageMeta("/product/audits").title).toBe("Audits");
    expect(pageMeta("/product/executions").lede).toMatch(/not the same as an audit/i);
    expect(pageMeta("/product/audits/AUD-FIN-2026-09/executions/EXEC-FIN-2026-09-001").chrome).toBe(
      "Execution",
    );
    expect(
      pageMeta("/product/audits/AUD-FIN-2026-09/executions/EXEC-FIN-2026-09-001/trace").chrome,
    ).toBe("Trace");
    expect(isAuditWorkspace("/product/audits/AUD-FIN-2026-09")).toBe(true);
    expect(isAuditWorkspace("/product/audits")).toBe(false);
  });

  it("does not invent audits outside the simulation catalog", () => {
    const ids = new Set(listWorkspaceAudits().map((audit) => audit.auditId));
    expect(ids.has("AUD-FIN-2026-09")).toBe(true);
    expect(ids.has("AUD-PRD-FAKE")).toBe(false);
  });
});
