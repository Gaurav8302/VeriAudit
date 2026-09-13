import { describe, expect, it } from "vitest";
import { PRODUCT_SHORTCUT } from "@/components/marketing/product-shortcut";
import { loadAuditWorkspace } from "@/lib/product/load";
import {
  filterAudits,
  heroConclusion,
  HERO_AUDIT_ID,
  HERO_EXECUTION_ID,
  visibleAudits,
} from "@/lib/product/workspace";

describe("product entry", () => {
  it("sends the landing shortcut and the demo handoff to the same product", () => {
    expect(PRODUCT_SHORTCUT.href).toBe("/product");
    expect(PRODUCT_SHORTCUT.label).toMatch(/explore the product/i);
  });
});

describe("audits catalog", () => {
  it("lists eight featured sample audits from the authored corpus", () => {
    const audits = visibleAudits();
    expect(audits).toHaveLength(8);
    expect(audits.every((audit) => audit.record === "sample")).toBe(true);
    expect(audits.some((audit) => audit.auditId === HERO_AUDIT_ID)).toBe(true);
  });

  it("filters featured audits without inventing rows", () => {
    const matches = filterAudits("revenue recognition");
    expect(matches.some((audit) => audit.auditId === HERO_AUDIT_ID)).toBe(true);
    expect(filterAudits("AUD-PRD-FAKE")).toHaveLength(0);
  });
});

describe("hero audit workspace", () => {
  it("exposes the authored 12 / 9 / 3 conclusion", () => {
    const conclusion = heroConclusion();
    expect(conclusion.controlsTested).toBe(12);
    expect(conclusion.controlsPassed).toBe(9);
    expect(conclusion.exceptions).toBe(3);
    expect(conclusion.findings).toBe(3);
    expect(conclusion.humanReviews).toBe(3);
  });

  it("loads recorded hero evidence, findings, and the reconstruction trail", async () => {
    const workspace = await loadAuditWorkspace(HERO_AUDIT_ID);
    expect(workspace?.kind).toBe("engine");
    expect(workspace?.audit.executionId).toBe(HERO_EXECUTION_ID);
    expect(workspace?.findings.map((item) => item.findingId)).toEqual([
      "F-FIN-001",
      "F-FIN-002",
      "F-FIN-003",
    ]);
    expect(workspace?.evidence.map((item) => item.artifactId)).toEqual([
      "ART-FIN-001",
      "ART-FIN-002",
      "ART-FIN-003",
      "ART-FIN-004",
    ]);
    expect(workspace?.eventCount).toBe(30);
    expect(workspace?.spine.length).toBeGreaterThanOrEqual(9);
    expect(workspace?.spine.some((step) => step.type === "audit.started")).toBe(true);
    expect(workspace?.spine.some((step) => step.type === "conclusion.created")).toBe(true);
  });

  it("does not invent a second execution on the hero audit", async () => {
    const workspace = await loadAuditWorkspace(HERO_AUDIT_ID);
    expect(workspace?.audit.executionCount).toBe(1);
  });

  it("keeps catalog-only workspaces free of fabricated trails", async () => {
    const catalog = visibleAudits().find((audit) => !audit.hasEngineTrail);
    expect(catalog).toBeTruthy();
    const workspace = await loadAuditWorkspace(catalog!.auditId);
    expect(workspace?.kind).toBe("catalog");
    expect(workspace?.spine).toEqual([]);
    expect(workspace?.eventCount).toBeNull();
  });
});
