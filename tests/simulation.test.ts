/**
 * Milestone 4: deterministic three-month simulation.
 *
 * The corpus exists to bury the hero audit. These tests lock the properties
 * the demo and a later search engine depend on. They do not run CooL and
 * they do not call AuditEngine from inside generateHistory.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  buildEventChain,
  financialScenario,
  runAudit,
} from "@/lib/audit";
import {
  ACTIVITY_TYPES,
  DEMO_TODAY,
  HERO_AUDIT_ID,
  HERO_EXECUTION_ID,
  HERO_OPENED_AT,
  HERO_SEARCH_TAGS,
  SEED,
  generateHistory,
  loadDemoState,
} from "@/lib/simulation";

const first = generateHistory(SEED);
const second = generateHistory(SEED);

function eventFingerprint() {
  const result = runAudit(financialScenario);
  const chain = buildEventChain(financialScenario, result);
  return {
    auditId: result.auditId,
    executionId: result.executionId,
    conclusion: result.conclusion.statement,
    controls: [
      result.conclusion.controlsTested,
      result.conclusion.controlsPassed,
      result.conclusion.exceptions,
    ],
    eventIds: chain.events.map((e) => e.eventId),
    types: chain.events.map((e) => e.type),
    parents: chain.events.map((e) => e.parentEventId),
    spine: ancestorsOf(
      chain.events,
      chain.events.find((e) => e.type === "conclusion.created")!.eventId,
    ).map((e) => e.eventId),
  };
}

const beforeHero = eventFingerprint();
const afterSim = generateHistory(SEED);
const afterHero = eventFingerprint();

describe("N — volume, span, burial", () => {
  it("N1 — 55 activities over ~91 days", () => {
    expect(first.activities.length).toBe(55);
    expect(first.stats.totalActivities).toBe(55);
    expect(first.stats.spanDays).toBeGreaterThanOrEqual(88);
    expect(first.stats.spanDays).toBeLessThanOrEqual(92);
    expect(first.audits).toHaveLength(14);
  });

  it("N2 — nothing is dated after DEMO_TODAY, and the oldest row is the hero day", () => {
    for (const activity of first.activities) {
      expect(activity.occurredAt <= DEMO_TODAY).toBe(true);
    }
    const oldest = first.activities[first.activities.length - 1]!;
    expect(oldest.occurredAt.startsWith("2026-09-15")).toBe(true);
    expect(first.startDate.startsWith("2026-09-15")).toBe(true);
    expect(first.generatedAt).toBe(DEMO_TODAY);
  });

  it("N3 — the hero audit is buried: ≥40 newer rows, not in the first 20", () => {
    expect(first.stats.activitiesNewerThanHero).toBeGreaterThanOrEqual(40);
    const newestTwenty = first.activities.slice(0, 20).map((a) => a.title);
    expect(newestTwenty).not.toContain("September Revenue Recognition Audit");
    const heroRow = first.activities.find((a) => a.title === "September Revenue Recognition Audit");
    expect(heroRow).toBeDefined();
    expect(heroRow!.occurredAt).toBe(HERO_OPENED_AT);
  });
});

describe("O — variety and realism", () => {
  it("O1 — all 9 activity types appear at least twice; all 4 scenarios appear", () => {
    for (const type of ACTIVITY_TYPES) {
      expect(first.stats.byType[type]).toBeGreaterThanOrEqual(2);
    }
    expect(first.stats.scenariosCovered).toBe(4);
    expect(first.stats.byScenario.financial).toBeGreaterThan(0);
    expect(first.stats.byScenario.legal).toBeGreaterThan(0);
    expect(first.stats.byScenario.cyber).toBeGreaterThan(0);
    expect(first.stats.byScenario.procurement).toBeGreaterThan(0);
  });

  it("O2 — titles and timestamps are unique; weekdays only", () => {
    const titles = first.activities.map((a) => a.title);
    expect(new Set(titles).size).toBe(titles.length);
    const times = first.activities.map((a) => a.occurredAt);
    expect(new Set(times).size).toBe(times.length);

    for (const activity of first.activities) {
      const day = new Date(activity.occurredAt).getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
      const hour = new Date(activity.occurredAt).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(8);
      expect(hour).toBeLessThanOrEqual(18);
    }
  });

  it("O3 — activities span the three-month windows", () => {
    const daysBack = first.activities.map((a) => {
      const ms = Date.parse(DEMO_TODAY) - Date.parse(a.occurredAt);
      return ms / 86_400_000;
    });
    expect(Math.max(...daysBack)).toBeGreaterThanOrEqual(88);
    expect(Math.min(...daysBack)).toBeLessThan(15);
    const recent = daysBack.filter((d) => d <= 14).length;
    const oldest = daysBack.filter((d) => d >= 86).length;
    expect(recent).toBeGreaterThanOrEqual(10);
    expect(oldest).toBe(3);
  });
});

describe("P — hero preservation", () => {
  it("P1 — the hero audit and execution ids are the Milestone 2 constants", () => {
    expect(first.heroAuditId).toBe("AUD-FIN-2026-09");
    expect(first.heroExecutionId).toBe("EXEC-FIN-2026-09-001");
    expect(first.heroAuditId).toBe(HERO_AUDIT_ID);
    expect(first.heroExecutionId).toBe(HERO_EXECUTION_ID);

    const heroes = first.audits.filter((a) => a.isHero);
    expect(heroes).toHaveLength(1);
    expect(heroes[0]!.auditId).toBe(HERO_AUDIT_ID);
    expect(heroes[0]!.summary).toEqual({
      controlsTested: 12,
      controlsPassed: 9,
      exceptions: 3,
      findings: 3,
      humanReviewCompleted: true,
    });
  });

  it("P2 — the hero execution still names the real 30-event trail", () => {
    const execution = first.executions.find((e) => e.executionId === HERO_EXECUTION_ID);
    expect(execution).toBeDefined();
    expect(execution!.coolBacked).toBe(true);
    expect(execution!.eventIds).toHaveLength(30);
    expect(execution!.eventIds[0]).toBe("EVT-FIN-2609-001");
    expect(execution!.eventIds[29]).toBe("EVT-FIN-2609-030");
    expect(execution!.rootEventId).toBe("EVT-FIN-2609-001");
  });

  it("P3 — running the simulation does not change the hero engine result", () => {
    expect(afterSim.heroAuditId).toBe(beforeHero.auditId);
    expect(afterHero).toEqual(beforeHero);
    expect(afterHero.controls).toEqual([12, 9, 3]);
    expect(afterHero.eventIds).toHaveLength(30);
  });

  it("P4 — hero activities carry the documented searchable terms", () => {
    const heroActivities = first.activities.filter((a) => a.auditId === HERO_AUDIT_ID);
    expect(heroActivities.length).toBeGreaterThanOrEqual(3);
    const tags = new Set(heroActivities.flatMap((a) => a.searchTags));
    for (const term of [
      "revenue recognition exception",
      "REV-REC-01",
      "F-FIN-001",
      "1420000",
      "C-1001",
      "september",
    ]) {
      const inTags = tags.has(term);
      const inText = heroActivities.some(
        (a) => `${a.title} ${a.description} ${a.searchTags.join(" ")}`.includes(term),
      );
      expect(inTags || inText).toBe(true);
    }
    expect(first.audits.find((a) => a.isHero)!.searchTags).toEqual(
      expect.arrayContaining([...HERO_SEARCH_TAGS]),
    );
  });
});

describe("Q — determinism and idempotence", () => {
  it("Q1 — two runs with the same seed are deeply equal", () => {
    expect(second).toEqual(first);
    expect(loadDemoState(SEED)).toEqual(first);
  });

  it("Q2 — a third start does not grow the corpus", () => {
    const third = generateHistory(SEED);
    expect(third.activities).toHaveLength(55);
    expect(third.activities.map((a) => a.activityId)).toEqual(
      first.activities.map((a) => a.activityId),
    );
  });

  it("Q3 — a different seed changes dates but not authored titles", () => {
    const other = generateHistory(SEED + 1);
    expect(other.activities.map((a) => a.title).sort()).toEqual(
      first.activities.map((a) => a.title).sort(),
    );
    expect(other.activities.map((a) => a.occurredAt)).not.toEqual(
      first.activities.map((a) => a.occurredAt),
    );
  });

  it("Q4 — output ignores the wall clock", () => {
    const original = Date.now;
    Date.now = () => Date.parse("2027-06-01T00:00:00.000Z");
    try {
      expect(generateHistory(SEED)).toEqual(first);
    } finally {
      Date.now = original;
    }
  });
});

describe("R — references and discipline", () => {
  it("R1 — real scenario executions point at engine trails; simulated ones do not claim CooL", () => {
    const realIds = new Set([
      "AUD-FIN-2026-09",
      "AUD-LEG-2026-08",
      "AUD-CYB-2026-09",
      "AUD-PRC-2026-09",
    ]);
    for (const audit of first.audits) {
      if (realIds.has(audit.auditId)) {
        expect(audit.hasEngineTrail).toBe(true);
        expect(audit.executionIds.length).toBe(1);
      } else {
        expect(audit.hasEngineTrail).toBe(false);
        expect(audit.isHero).toBe(false);
      }
    }
    const coolBacked = first.activities.filter((a) => a.coolBacked);
    expect(coolBacked.every((a) => a.auditId === HERO_AUDIT_ID)).toBe(true);
    expect(coolBacked.length).toBeGreaterThanOrEqual(3);
  });

  it("R2 — lib/simulation contains no ambient randomness or clock reads", () => {
    const root = join(process.cwd(), "lib/simulation");
    const files = readdirSync(root).filter((f) => f.endsWith(".ts"));
    const banned =
      /\bMath\.random\b|\bDate\.now\b|\bcrypto\.randomUUID\b|\bperformance\.now\b/;
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      if (banned.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("R3 — generateHistory does not import the engine or CooL", () => {
    const source = readFileSync(join(process.cwd(), "lib/simulation/generate.ts"), "utf8");
    expect(source).not.toMatch(/runAudit|runAndSeal|lib\/cool|cool-nwc/);
  });
});
