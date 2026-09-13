/**
 * First-class coverage for all four live scenarios.
 *
 * Financial remains the 12/9/3 reference. Legal, cyber, and procurement must
 * produce their own evidence, findings, events, reconstruction, and a truthful
 * verification state — never a copied financial story.
 */
import { describe, expect, it } from "vitest";
import {
  SCENARIO_BRIEFINGS,
  SCENARIOS,
  buildEventChain,
  cyberScenario,
  financialScenario,
  legalScenario,
  procurementScenario,
  runAndSeal,
  runAudit,
  scenarioCatalogue,
  verifyRun,
} from "@/lib/audit";
import { buildIndex, reconstructAudit, search } from "@/lib/search";
import { catalogExecutions, mergeExecutions, reopenAudit } from "@/lib/product/lineage";
import { scenarioInquiry } from "@/lib/demo/scenario-copy";

const index = buildIndex();

const FINANCIAL_MARKERS = [
  "AUD-FIN",
  "EXEC-FIN",
  "EVT-FIN",
  "REV-REC",
  "revenue recognition",
  "ART-FIN",
  "F-FIN",
];

describe("four first-class scenarios", () => {
  it("exposes four domains with Financial as the only recommended hero", () => {
    const catalogue = scenarioCatalogue();
    expect(catalogue.map((item) => item.scenarioId)).toEqual([
      "financial",
      "legal",
      "cyber",
      "procurement",
    ]);
    expect(catalogue.filter((item) => item.isHero)).toHaveLength(1);
    expect(catalogue[0]?.isHero).toBe(true);
    for (const item of catalogue) {
      expect(item.briefing?.oneLine.length).toBeGreaterThan(20);
      expect(item.briefing?.checking.length).toBeGreaterThan(20);
      expect(item.controlsInScope).toBe(item.expected.controlsTested);
    }
  });

  it("preserves the financial 12/9/3 reference result", () => {
    const result = runAudit(financialScenario);
    expect(result.conclusion.controlsTested).toBe(12);
    expect(result.conclusion.controlsPassed).toBe(9);
    expect(result.conclusion.exceptions).toBe(3);
    expect(result.findings).toHaveLength(3);
    expect(buildEventChain(financialScenario, result).events).toHaveLength(30);
  });

  it.each(SCENARIOS)(
    "$scenarioId runs deterministically and matches its own expected result",
    (scenario) => {
      const first = runAudit(scenario);
      const second = runAudit(scenario);
      expect(first.conclusion.controlsTested).toBe(scenario.expected.controlsTested);
      expect(first.conclusion.controlsPassed).toBe(scenario.expected.controlsPassed);
      expect(first.conclusion.exceptions).toBe(scenario.expected.exceptions);
      expect(first.findings).toHaveLength(scenario.expected.findings);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(first.auditId).toBe(scenario.auditId);
      expect(first.executionId).toBe(scenario.executionId);
    },
  );

  it("keeps findings, evidence, and events inside the chosen scenario", () => {
    for (const scenario of SCENARIOS) {
      const result = runAudit(scenario);
      const chain = buildEventChain(scenario, result);
      const prefix = scenario.eventCode.split("-")[0];
      expect(result.findings.every((finding) => finding.findingId.includes(prefix!))).toBe(true);
      expect(result.artifacts.every((artifact) => artifact.artifactId.startsWith(`ART-${prefix}`))).toBe(
        true,
      );
      expect(chain.events.every((event) => event.eventId.startsWith(`EVT-${scenario.eventCode}`))).toBe(
        true,
      );
      expect(chain.canonical).toHaveLength(9);
      if (scenario.scenarioId !== "financial") {
        const blob = JSON.stringify({
          artifacts: result.artifacts,
          findings: result.findings,
          events: chain.events.map((event) => ({ title: event.title, summary: event.summary })),
        }).toLowerCase();
        for (const marker of FINANCIAL_MARKERS) {
          expect(blob, `${scenario.scenarioId} leaked ${marker}`).not.toContain(marker.toLowerCase());
        }
      }
    }
  });

  it("reconstructs each engine audit with that audit's own path", async () => {
    for (const scenario of SCENARIOS) {
      const reconstruction = await reconstructAudit(scenario.auditId);
      expect(reconstruction?.kind).toBe("engine");
      if (reconstruction?.kind !== "engine") continue;
      expect(reconstruction.auditId).toBe(scenario.auditId);
      expect(reconstruction.executionId).toBe(scenario.executionId);
      expect(reconstruction.findings).toHaveLength(scenario.expected.findings);
      expect(reconstruction.evidence.map((item) => item.artifactId)).toEqual(
        scenario.artifacts.map((item) => item.artifactId),
      );
      expect(reconstruction.why.path.length).toBe(9);
      expect(reconstruction.why.path[0]?.type).toBe("audit.started");
      expect(reconstruction.why.path.at(-1)?.type).toBe("conclusion.created");
      expect(reconstruction.integrity.status).toBe("unavailable");
    }
  });

  it("tells the truth about CooL: live seal verifies; reconstruction without receipts does not claim verified", async () => {
    for (const scenario of SCENARIOS.filter((item) => item.scenarioId !== "financial")) {
      const sealed = await runAndSeal(scenario);
      const verified = await verifyRun(sealed);
      expect(verified.failed, scenario.scenarioId).toBe(0);
      expect(verified.verified, scenario.scenarioId).toBe(9);
      expect(sealed.sealing.sealed).toBe(9);

      const withoutReceipts = await reconstructAudit(scenario.auditId);
      expect(withoutReceipts?.integrity.status).toBe("unavailable");
    }
  });

  it("supports reopen lineage without rewriting the original execution", () => {
    for (const scenario of SCENARIOS) {
      const before = catalogExecutions(scenario.auditId)[0]!;
      const next = reopenAudit(scenario.auditId, []);
      const after = mergeExecutions(scenario.auditId, [next]);
      expect(after[0]?.executionId).toBe(before.executionId);
      expect(after[0]?.parentExecutionId).toBeNull();
      expect(snapshotSafe(after[0]!)).toEqual(snapshotSafe(before));
      expect(next.parentExecutionId).toBe(before.executionId);
      expect(next.status).toBe("open");
      expect(next.executionId).not.toBe(before.executionId);
    }
  });
});

describe("scenario-specific search", () => {
  it.each([
    ["GDPR processor obligations", legalScenario.auditId],
    ["privileged access", cyberScenario.auditId],
    ["MFA exception", cyberScenario.auditId],
    ["three-way match", procurementScenario.auditId],
    ["vendor invoice variance", procurementScenario.auditId],
  ] as const)("%s ranks the matching engine audit first", (query, auditId) => {
    const result = search(query, {}, index);
    expect(result.groups[0]?.auditId, query).toBe(auditId);
  });

  it("does not break the financial hero queries", () => {
    const result = search("revenue recognition exception", {}, index);
    expect(result.groups[0]?.auditId).toBe(financialScenario.auditId);
  });
});

describe("judge briefing copy", () => {
  it("answers what / checking / human cares for every scenario", () => {
    for (const scenario of SCENARIOS) {
      const briefing = SCENARIO_BRIEFINGS[scenario.scenarioId];
      expect(briefing.what).toMatch(/[A-Za-z]/);
      expect(briefing.checking).toMatch(/AI is checking/i);
      expect(briefing.humanCares).toMatch(/human auditor cares/i);
      expect(scenarioInquiry(scenario.scenarioId).chips.length).toBeGreaterThan(0);
    }
  });
});

function snapshotSafe(execution: { executionId: string; eventCount: number | null; findingCount: number; status: string }) {
  return {
    executionId: execution.executionId,
    eventCount: execution.eventCount,
    findingCount: execution.findingCount,
    status: execution.status,
  };
}
