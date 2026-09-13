/**
 * Milestone 5: historical search + reconstruction.
 *
 * The eight SEARCH_SPEC.md §6 queries are release blockers. Ranking is
 * deterministic arithmetic over the seeded corpus — no LLM, no randomness.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  bindReceipt,
  financialScenario,
  resolveScenario,
  runAndSeal,
  verifyTrail,
} from "@/lib/audit";
import { assertValidLogState } from "@/lib/cool/log-state";
import { flipLastHex } from "@/lib/proof/tamper";
import { verifyReceipt } from "@/lib/cool/verifier";
import {
  DEMO_QUERIES,
  SUGGESTION_CHIPS,
  buildIndex,
  reconstructAudit,
  search,
} from "@/lib/search";
import {
  generateHistory,
  HERO_AUDIT_ID,
  HERO_EXECUTION_ID,
} from "@/lib/simulation";

const NEAR_MISSES = [
  "AUD-FIN-2026-10",
  "AUD-FIN-2026-11",
  "AUD-FIN-2026-12",
  "AUD-LEG-2026-10",
];

const CANONICAL_SPINE = [
  "audit.started",
  "artifact.ingested",
  "artifact.parsed",
  "retrieval.executed",
  "model.executed",
  "control.tested",
  "finding.created",
  "human.review.completed",
  "conclusion.created",
] as const;

const simulation = generateHistory();
const index = buildIndex();
const sealed = await runAndSeal(financialScenario);

describe("S — asserted demo queries", () => {
  it.each([...DEMO_QUERIES, "1.42M"])(
    "S1 — %s ranks the hero audit first",
    (query) => {
      const result = search(query, {}, index);
      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.groups[0]!.auditId).toBe(HERO_AUDIT_ID);
      expect(result.groups[0]!.executionId).toBe(HERO_EXECUTION_ID);
      expect(result.results[0]!.auditId).toBe(HERO_AUDIT_ID);
    },
  );

  it("S2 — the boss's exact words retrieve the original execution", () => {
    const result = search("why did we flag this revenue transaction", {}, index);
    expect(result.groups[0]!.auditId).toBe(HERO_AUDIT_ID);
    expect(result.groups[0]!.executionId).toBe(HERO_EXECUTION_ID);
    expect(result.groups[0]!.executionId).toBe(financialScenario.executionId);
  });

  it("S3 — near-misses do not outrank the hero for the precise query", () => {
    const result = search("revenue recognition exception", {}, index);
    expect(result.groups[0]!.auditId).toBe(HERO_AUDIT_ID);
    const nearMissRanks = result.groups
      .map((g, i) => ({ id: g.auditId, rank: i, score: g.score }))
      .filter((g) => NEAR_MISSES.includes(g.id));
    for (const miss of nearMissRanks) {
      expect(miss.rank).toBeGreaterThan(0);
      expect(miss.score).toBeLessThan(result.groups[0]!.score);
    }
  });

  it("S4 — the same query is byte-identical across 10 runs", () => {
    const first = search("revenue recognition exception", {}, index);
    for (let i = 0; i < 9; i++) {
      expect(search("revenue recognition exception", {}, index)).toEqual(first);
    }
  });
});

describe("S — filters and empty states", () => {
  it("S5 — date, domain, type, audit, status, and evidence filters compose", () => {
    const financial = search("revenue", { domain: "financial" }, index);
    expect(financial.results.every((r) => r.domain === "financial")).toBe(true);
    expect(financial.results.length).toBeGreaterThan(1);

    const controls = search("", { type: "control_test" }, index);
    expect(controls.results.length).toBe(11);
    expect(controls.results.every((r) => r.type === "control_test")).toBe(true);

    const oneAudit = search("revenue", { auditId: HERO_AUDIT_ID }, index);
    expect(oneAudit.results.every((r) => r.auditId === HERO_AUDIT_ID)).toBe(true);

    const after = search("", { after: "2026-11-01T00:00:00.000Z" }, index);
    expect(after.results.every((r) => r.timestamp >= "2026-11-01T00:00:00.000Z")).toBe(true);
    expect(after.results.some((r) => r.auditId === HERO_AUDIT_ID && r.kind === "activity" && r.title.includes("September Revenue Recognition Audit"))).toBe(false);

    const before = search("", { before: "2026-10-01T00:00:00.000Z" }, index);
    expect(before.results.every((r) => r.timestamp <= "2026-10-01T00:00:00.000Z")).toBe(true);

    const recent = search("", { sinceDays: 7 }, index);
    expect(recent.results.every((r) => r.timestamp >= "2026-12-08T09:00:00.000Z")).toBe(true);

    const coolOnly = search("revenue", { evidence: "cool" }, index);
    expect(coolOnly.results.every((r) => r.coolBacked)).toBe(true);
    expect(coolOnly.results.every((r) => r.auditId === HERO_AUDIT_ID)).toBe(true);

    const exceptions = search("revenue", { domain: "financial", status: "exception" }, index);
    expect(exceptions.results.every((r) => r.status === "exception" && r.domain === "financial")).toBe(true);
  });

  it("S7 — empty query is recent history; nonsense returns suggestions", () => {
    const empty = search("", {}, index);
    expect(empty.results.length).toBe(55);
    expect(empty.results[0]!.timestamp >= empty.results[empty.results.length - 1]!.timestamp).toBe(true);
    expect(empty.suggestions).toEqual([...SUGGESTION_CHIPS]);

    const none = search("xyzzy-no-such-term-veriaudit", {}, index);
    expect(none.results).toEqual([]);
    expect(none.groups).toEqual([]);
    expect(none.suggestions).toEqual([...SUGGESTION_CHIPS]);
  });
});

describe("S — result shape and generic ranking", () => {
  it("S6 — every hit names an audit that exists, and event ids resolve", () => {
    const result = search("revenue recognition exception", {}, index);
    const auditIds = new Set(simulation.audits.map((a) => a.auditId));
    for (const hit of result.results) {
      expect(auditIds.has(hit.auditId)).toBe(true);
      expect(hit).toHaveProperty("title");
      expect(hit).toHaveProperty("timestamp");
      expect(hit).toHaveProperty("relevance");
      expect(hit).toHaveProperty("matchedTerms");
      expect(hit).toHaveProperty("tags");
      if (hit.eventId) {
        expect(hit.eventId.startsWith("EVT-")).toBe(true);
      }
    }
    expect(resolveScenario(result.groups[0]!.auditId)?.executionId).toBe(HERO_EXECUTION_ID);
  });

  it("S8 — generic 'revenue' returns several audits and the hero still leads", () => {
    const result = search("revenue", {}, index);
    const auditIds = new Set(result.groups.map((g) => g.auditId));
    expect(auditIds.size).toBeGreaterThan(1);
    expect(result.groups[0]!.auditId).toBe(HERO_AUDIT_ID);
    expect(NEAR_MISSES.some((id) => auditIds.has(id))).toBe(true);
  });
});

describe("S — discipline", () => {
  it("S9 — lib/search has no ambient randomness and no LLM", () => {
    const root = join(process.cwd(), "lib/search");
    const banned = /\bMath\.random\b|\bDate\.now\b|\bcrypto\.randomUUID\b|openai|anthropic|pinecone|elasticsearch/i;
    const offenders: string[] = [];
    for (const file of readdirSync(root).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(join(root, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      if (banned.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("T — reconstruction", () => {
  it("T1 — hero reconstruction is the original 12/9/3 execution", async () => {
    const found = search("revenue recognition exception", {}, index);
    const reconstruction = await reconstructAudit(found.groups[0]!.auditId);
    expect(reconstruction).not.toBeNull();
    if (!reconstruction || reconstruction.kind !== "engine") {
      throw new Error("expected an engine reconstruction");
    }

    expect(reconstruction.auditId).toBe(HERO_AUDIT_ID);
    expect(reconstruction.executionId).toBe(HERO_EXECUTION_ID);
    expect(reconstruction.audit.summary).toMatchObject({
      controlsTested: 12,
      controlsPassed: 9,
      exceptions: 3,
    });
    expect(reconstruction.findings).toHaveLength(3);
    expect(reconstruction.reviews).toHaveLength(3);
    expect(reconstruction.evidence).toHaveLength(4);
    expect(reconstruction.conclusion.statement).toBe(sealed.result.conclusion.statement);
    expect(reconstruction.why.path.map((s) => s.type)).toEqual([...CANONICAL_SPINE]);
    expect(reconstruction.graph.spineEventIds).toHaveLength(9);
    expect(reconstruction.integrity.status).toBe("unavailable");
  });

  it("T2 — GET reconstruction does not invent a verified status", async () => {
    const reconstruction = await reconstructAudit(HERO_AUDIT_ID);
    expect(reconstruction?.integrity.status).toBe("unavailable");
    expect(reconstruction?.integrity.cool).toBe("unavailable");
  });

  it("T3 — catalog-only audits are honest about the missing trail", async () => {
    const reconstruction = await reconstructAudit("AUD-FIN-2026-11");
    expect(reconstruction?.kind).toBe("catalog");
    expect(reconstruction?.integrity.status).toBe("not-recorded");
    expect(reconstruction?.hasEngineTrail).toBe(false);
  });
});

describe("U — search → trail → verify (the demo)", () => {
  it("U1 — simulate → search → open → reconstruct → verify the original conclusion", async () => {
    expect(simulation.activities).toHaveLength(55);

    const found = search("revenue recognition exception", {}, index);
    expect(found.groups[0]!.auditId).toBe(HERO_AUDIT_ID);
    expect(found.groups[0]!.executionId).toBe(HERO_EXECUTION_ID);

    const reconstruction = await reconstructAudit(found.groups[0]!.auditId, {
      receipts: Object.fromEntries(sealed.receipts),
      logState: sealed.logState,
      treeHead: sealed.sealing.treeHead ?? undefined,
    });
    expect(reconstruction?.kind).toBe("engine");
    if (reconstruction?.kind !== "engine") return;

    expect(reconstruction.trail.events).toHaveLength(30);
    expect(reconstruction.why.path.map((s) => s.type)).toEqual([...CANONICAL_SPINE]);
    const conclusion = reconstruction.trail.events.find((e) => e.type === "conclusion.created");
    expect(conclusion).toBeDefined();
    expect(
      ancestorsOf(
        sealed.events,
        sealed.events.find((e) => e.type === "conclusion.created")!.eventId,
      ).map((e) => e.type),
    ).toEqual([...CANONICAL_SPINE]);

    expect(reconstruction.integrity.status).toBe("verified");
    expect(reconstruction.integrity.cool).toBe("verified");
    expect(reconstruction.integrity.identity).toBe("verified");
    expect(reconstruction.conclusion.controlsTested).toBe(12);
    expect(reconstruction.conclusion.exceptions).toBe(3);

    const integrity = await verifyTrail(sealed);
    expect(integrity.status).toBe("verified");
    expect(integrity.verified).toBe(9);
    expect(integrity.failed).toBe(0);
  });

  it("U2 — a tampered conclusion is not rendered as trustworthy", async () => {
    const conclusion = sealed.events.find((e) => e.type === "conclusion.created" && e.cool)!;
    const original = sealed.receipts.get(conclusion.cool!.receiptRef);
    const tampered = JSON.parse(JSON.stringify(original)) as {
      record: { event: { commitments: { output: string } } };
    };
    tampered.record.event.commitments.output = flipLastHex(
      tampered.record.event.commitments.output,
    );

    const state = await verifyReceipt(tampered);
    expect(state.ok).toBe(false);
    expect(state.status).toBe("failed");

    const rewritten = { ...conclusion, title: "zero exceptions actually" };
    const bound = await bindReceipt(
      rewritten,
      original,
      assertValidLogState([...sealed.logState]),
    );
    expect(bound.bound).toBe(false);

    const reconstruction = await reconstructAudit(HERO_AUDIT_ID, {
      receipts: {
        ...Object.fromEntries(sealed.receipts),
        [conclusion.cool!.receiptRef]: tampered,
      },
      logState: sealed.logState,
      treeHead: sealed.sealing.treeHead ?? undefined,
    });
    expect(reconstruction?.integrity.status).toBe("failed");
    expect(reconstruction?.integrity.cool).toBe("failed");
  });
});
