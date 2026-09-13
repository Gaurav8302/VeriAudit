/**
 * Milestone 2: the audit engine, the four scenarios, and their CooL evidence.
 *
 * Sections A–D are pure and fast (no cryptography). Sections E–F stand up real
 * evidence planes, which is why the suite timeout is 60 s.
 *
 * Milestone 1's rules are used unchanged: `verifyReceipt` with the default
 * `PRODUCTION_POLICY`. Nothing here weakens them.
 */
import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  buildEventChain,
  childrenOf,
  financialScenario,
  cyberScenario,
  legalScenario,
  procurementScenario,
  ReviewError,
  runAndSeal,
  runAudit,
  SCENARIOS,
  scenarioCatalogue,
  submitReview,
  trailView,
  verifyRun,
} from "@/lib/audit";
import type { AuditScenario, Control } from "@/lib/audit";
import { SOFTWARE_NAME } from "@/lib/cool/config";
import { verifyReceipt } from "@/lib/cool/verifier";
import { flipLastHex } from "@/lib/proof/tamper";

/** The nine-stage causal spine from docs/EVENT_MODEL.md §3. */
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

// ─────────────────────────────────────────────────────────────────────────────
describe("A — one engine, four scenarios", () => {
  it("A1 — every scenario runs and matches its own declared expectation", () => {
    expect(SCENARIOS).toHaveLength(4);
    for (const scenario of SCENARIOS) {
      const result = runAudit(scenario);
      expect(result.conclusion.controlsTested, scenario.scenarioId).toBe(
        scenario.expected.controlsTested,
      );
      expect(result.conclusion.controlsPassed, scenario.scenarioId).toBe(
        scenario.expected.controlsPassed,
      );
      expect(result.conclusion.exceptions, scenario.scenarioId).toBe(scenario.expected.exceptions);
      expect(result.findings.length, scenario.scenarioId).toBe(scenario.expected.findings);
      expect(result.conclusion.controlsPassed + result.conclusion.exceptions).toBe(
        result.conclusion.controlsTested,
      );
    }
  });

  it("A2 — the financial hero is 12 tested / 9 passed / 3 exceptions", () => {
    const result = runAudit(financialScenario);
    expect(result.controlResults).toHaveLength(12);
    expect(result.controlResults.filter((c) => c.status === "pass")).toHaveLength(9);
    expect(result.controlResults.filter((c) => c.status === "exception")).toHaveLength(3);
    expect(result.conclusion.statement).toContain("12 controls tested, 9 passed, 3 exceptions");
    expect(result.conclusion.humanReviewCompleted).toBe(true);
  });

  it("A3 — results are byte-identical across runs", () => {
    for (const scenario of SCENARIOS) {
      const a = JSON.stringify(runAudit(scenario));
      const b = JSON.stringify(runAudit(scenario));
      expect(b, scenario.scenarioId).toBe(a);
    }
  });

  it("A4 — twelve DIFFERENT rules, not twelve copies of one", () => {
    const ids = financialScenario.controls.map((c) => c.controlId);
    expect(new Set(ids).size).toBe(12);
    // Distinct rule bodies: identical evaluators would collapse to one source.
    const bodies = new Set(financialScenario.controls.map((c) => c.evaluate.toString()));
    expect(bodies.size).toBe(12);
    // Spread across categories rather than one category repeated.
    expect(new Set(financialScenario.controls.map((c) => c.category)).size).toBeGreaterThanOrEqual(8);
  });

  it("A5 — the engine refuses a scenario whose numbers have drifted", () => {
    const drifted = { ...financialScenario, expected: { ...financialScenario.expected, exceptions: 2 } };
    expect(() => runAudit(drifted)).toThrow(/does not match its declared expectation/);
  });

  it("A6 — the engine refuses an exception with no finding", () => {
    const bad: Control<unknown> = {
      controlId: "BAD-01",
      name: "Broken control",
      description: "Raises an exception without a finding.",
      category: "test",
      artifactIds: [financialScenario.artifacts[0]!.artifactId],
      evaluate: () => ({ status: "exception", observed: {}, rationale: "no finding attached" }),
    };
    const scenario = {
      ...financialScenario,
      controls: [bad],
    } as unknown as AuditScenario<unknown>;
    expect(() => runAudit(scenario)).toThrow(/without a finding/);
  });

  it("A7 — the engine refuses a control citing evidence not in scope", () => {
    const bad: Control<unknown> = {
      controlId: "BAD-02",
      name: "Dangling control",
      description: "Cites an artifact that does not exist.",
      category: "test",
      artifactIds: ["ART-DOES-NOT-EXIST"],
      evaluate: () => ({ status: "pass", observed: {}, rationale: "n/a" }),
    };
    const scenario = { ...financialScenario, controls: [bad] } as unknown as AuditScenario<unknown>;
    expect(() => runAudit(scenario)).toThrow(/unknown artifact/);
  });

  it("A8 — every reasoner is deterministic, and the engine enforces it", () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.reasoner.deterministic, scenario.scenarioId).toBe(true);
    }
    const nondeterministic = {
      ...financialScenario,
      reasoner: { ...financialScenario.reasoner, deterministic: false },
    };
    expect(() => runAudit(nondeterministic)).toThrow(/non-deterministic reasoner/);
  });

  it("A9 — the catalogue exposes all four with one hero", () => {
    const catalogue = scenarioCatalogue();
    expect(catalogue).toHaveLength(4);
    expect(catalogue.filter((s) => s.isHero)).toHaveLength(1);
    expect(catalogue.find((s) => s.isHero)?.scenarioId).toBe("financial");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B — findings reference their control and their evidence", () => {
  it("B1 — every finding names a control that actually raised an exception", () => {
    for (const scenario of SCENARIOS) {
      const result = runAudit(scenario);
      for (const finding of result.findings) {
        const control = result.controlResults.find((c) => c.controlId === finding.controlId);
        expect(control, `${finding.findingId} → ${finding.controlId}`).toBeDefined();
        expect(control!.status).toBe("exception");
        // And the link is bidirectional, so neither side can drift.
        expect(control!.findingId).toBe(finding.findingId);
      }
    }
  });

  it("B2 — every finding cites evidence held in scope", () => {
    for (const scenario of SCENARIOS) {
      const result = runAudit(scenario);
      const known = new Set(scenario.artifacts.map((a) => a.artifactId));
      for (const finding of result.findings) {
        expect(finding.evidenceArtifactIds.length).toBeGreaterThan(0);
        for (const artifactId of finding.evidenceArtifactIds) {
          expect(known.has(artifactId), `${finding.findingId} → ${artifactId}`).toBe(true);
        }
      }
    }
  });

  it("B3 — exceptions and findings are one-to-one, with no orphans either way", () => {
    for (const scenario of SCENARIOS) {
      const result = runAudit(scenario);
      const exceptions = result.controlResults.filter((c) => c.status === "exception");
      expect(exceptions.map((c) => c.findingId).sort()).toEqual(
        result.findings.map((f) => f.findingId).sort(),
      );
      // A passing control never carries a finding.
      for (const passed of result.controlResults.filter((c) => c.status === "pass")) {
        expect(passed.findingId).toBeNull();
      }
    }
  });

  it("B4 — every finding explains itself well enough to act on", () => {
    for (const scenario of SCENARIOS) {
      for (const finding of runAudit(scenario).findings) {
        expect(finding.title.length).toBeGreaterThan(10);
        expect(finding.description.length).toBeGreaterThan(20);
        expect(finding.rationale.length).toBeGreaterThan(40);
        expect(finding.recommendedAction.length).toBeGreaterThan(10);
        expect(["high", "medium", "low"]).toContain(finding.severity);
        expect(Object.keys(finding.observed).length).toBeGreaterThan(0);
      }
    }
  });

  it("B5 — F-FIN-001 is the revenue recognition finding the demo searches for", () => {
    const result = runAudit(financialScenario);
    const hero = result.findings[0]!;
    expect(hero.findingId).toBe("F-FIN-001");
    expect(hero.controlId).toBe("REV-REC-01");
    expect(hero.originalSeverity ?? hero.severity).toBe("high");
    expect(hero.amountUsd).toBe(1_420_000);
    expect(hero.title.toLowerCase()).toContain("revenue recognised");
    expect(hero.title.toLowerCase()).toContain("performance obligation");
    // The rationale must name the evidence, not just assert a conclusion.
    expect(hero.rationale).toContain("E-1001");
    expect(hero.rationale).toContain("C-1001");
    expect(hero.rationale).toContain("REV-POL-3");
    expect(hero.observed["milestone_delivered_on"]).toBeNull();
    expect(financialScenario.searchTags).toContain("revenue recognition exception");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C — human review", () => {
  it("C1 — the financial audit routes all three exceptions to a person", () => {
    const result = runAudit(financialScenario);
    expect(result.findings.every((f) => f.reviewRequired)).toBe(true);
    expect(result.reviews).toHaveLength(3);
    for (const review of result.reviews) {
      expect(result.findings.some((f) => f.findingId === review.findingId)).toBe(true);
      expect(review.note.length).toBeGreaterThan(20);
      expect(review.reviewer.name).toBe("J. Okafor");
    }
  });

  it("C2 — a reviewer can MODIFY the AI's severity, and both are kept", () => {
    const result = runAudit(financialScenario);
    const modified = result.findings.find((f) => f.status === "modified")!;
    expect(modified.controlId).toBe("SEG-DUT-10");
    expect(modified.originalSeverity).toBe("medium");
    expect(modified.severity).toBe("low");
    const review = result.reviews.find((r) => r.findingId === modified.findingId)!;
    expect(review.decision).toBe("modified");
    expect(review.modifiedSeverity).toBe("low");
  });

  it("C3 — nothing is auto-approved: cyber leaves a finding PENDING", () => {
    const result = runAudit(cyberScenario);
    const pending = result.findings.filter((f) => f.status === "open");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.controlId).toBe("PRV-MIN-08");
    expect(pending[0]!.reviewRequired).toBe(true);
    expect(pending[0]!.reviewId).toBeNull();
    expect(result.conclusion.humanReviewsPending).toBe(1);
    expect(result.conclusion.humanReviewCompleted).toBe(false);
    expect(result.conclusion.statement).toContain("awaiting human verification");
  });

  it("C4 — a reviewer can REJECT the AI outright", () => {
    const result = runAudit(procurementScenario);
    const rejected = result.findings.find((f) => f.status === "rejected")!;
    expect(rejected.controlId).toBe("PO-MATCH-02");
    const review = result.reviews.find((r) => r.findingId === rejected.findingId)!;
    expect(review.decision).toBe("rejected");
    expect(review.note).toContain("CO-88");
  });

  it("C5 — all four review states occur across the scenarios", () => {
    const states = new Set(SCENARIOS.flatMap((s) => runAudit(s).findings.map((f) => f.status)));
    expect([...states].sort()).toEqual(["accepted", "modified", "open", "rejected"]);
  });

  it("C6 — a live review decision is validated before it is recorded", async () => {
    const base = { decision: "accepted" as const, note: "Looks right to me on re-read." };

    await expect(
      submitReview(financialScenario, { ...base, findingId: "F-FIN-999" }),
    ).rejects.toThrow(ReviewError);

    await expect(
      submitReview(financialScenario, { findingId: "F-FIN-001", decision: "accepted", note: "  " }),
    ).rejects.toThrow(/review note is required/);

    await expect(
      submitReview(financialScenario, {
        findingId: "F-FIN-001",
        decision: "modified",
        note: "Downgrading this one.",
      }),
    ).rejects.toThrow(/requires modifiedSeverity/);

    await expect(
      submitReview(financialScenario, {
        findingId: "F-FIN-001",
        decision: "rejected",
        note: "Disagree.",
        modifiedSeverity: "low",
      }),
    ).rejects.toThrow(/only meaningful with decision "modified"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D — execution events and their relationships", () => {
  it("D1 — the hero execution is 30 events with the documented fan-out", () => {
    const result = runAudit(financialScenario);
    const chain = buildEventChain(financialScenario, result);
    expect(chain.events).toHaveLength(30);

    const counts = trailView({
      result,
      events: chain.events.map((e) => ({ ...e, cool: null })),
      canonicalEventIds: chain.canonical.map((e) => e.eventId),
      rootEventId: chain.rootEventId,
      sealing: { attempted: 0, sealed: 0, error: null, treeHead: null, timings: null },
      logState: [],
      receipts: new Map(),
    }).counts.byType;

    expect(counts).toEqual({
      "audit.started": 1,
      "artifact.ingested": 4,
      "artifact.parsed": 4,
      "retrieval.executed": 1,
      "model.executed": 1,
      "control.tested": 12,
      "finding.created": 3,
      "human.review.completed": 3,
      "conclusion.created": 1,
    });
  });

  it("D2 — every meaningful stage emits an event, in every scenario", () => {
    for (const scenario of SCENARIOS) {
      const result = runAudit(scenario);
      const chain = buildEventChain(scenario, result);
      const types = new Set(chain.events.map((e) => e.type));
      for (const stage of CANONICAL_SPINE) {
        expect(types.has(stage), `${scenario.scenarioId} missing ${stage}`).toBe(true);
      }
      // One event per artifact, per control, per finding, per review.
      expect(chain.events.filter((e) => e.type === "artifact.ingested")).toHaveLength(
        scenario.artifacts.length,
      );
      expect(chain.events.filter((e) => e.type === "control.tested")).toHaveLength(
        result.controlResults.length,
      );
      expect(chain.events.filter((e) => e.type === "finding.created")).toHaveLength(
        result.findings.length,
      );
      expect(chain.events.filter((e) => e.type === "human.review.completed")).toHaveLength(
        result.reviews.length,
      );
    }
  });

  it("D3 — the chain is a tree: one root, every parent resolves, no cycles", () => {
    for (const scenario of SCENARIOS) {
      const chain = buildEventChain(scenario, runAudit(scenario));
      const ids = new Set(chain.events.map((e) => e.eventId));

      expect(ids.size, scenario.scenarioId).toBe(chain.events.length);
      expect(chain.events.filter((e) => e.parentEventId === null)).toHaveLength(1);
      expect(chain.events[0]!.type).toBe("audit.started");

      for (const event of chain.events) {
        expect(event.auditId).toBe(scenario.auditId);
        expect(event.executionId).toBe(scenario.executionId);
        if (event.parentEventId !== null) {
          expect(ids.has(event.parentEventId), `${event.eventId} → ${event.parentEventId}`).toBe(true);
        }
        // Walking up terminates at the root; ancestorsOf throws on a cycle.
        const path = ancestorsOf(chain.events, event.eventId);
        expect(path[0]!.eventId).toBe(chain.rootEventId);
      }

      chain.events.forEach((event, index) => {
        expect(event.sequence).toBe(index);
        // A parent must precede its child, or "causal order" means nothing.
        if (event.parentEventId !== null) {
          const parent = chain.events.find((e) => e.eventId === event.parentEventId)!;
          expect(parent.sequence).toBeLessThan(event.sequence);
        }
      });
    }
  });

  it("D4 — Evidence → Control → Finding → Review is wired through parents", () => {
    const result = runAudit(financialScenario);
    const chain = buildEventChain(financialScenario, result);

    for (const finding of result.findings) {
      const findingEvent = chain.events.find(
        (e) => e.type === "finding.created" && e.findingRef === finding.findingId,
      )!;
      const controlEvent = chain.events.find((e) => e.eventId === findingEvent.parentEventId)!;
      expect(controlEvent.type).toBe("control.tested");
      expect(controlEvent.controlRef).toBe(finding.controlId);
      expect(controlEvent.detail["status"]).toBe("exception");
      // The control event cites the same evidence the finding does.
      expect([...controlEvent.artifactRefs].sort()).toEqual(
        [...finding.evidenceArtifactIds].sort(),
      );

      const review = result.reviews.find((r) => r.findingId === finding.findingId);
      if (!review) continue;
      const reviewEvent = chain.events.find(
        (e) => e.type === "human.review.completed" && e.reviewRef === review.reviewId,
      )!;
      expect(reviewEvent.parentEventId).toBe(findingEvent.eventId);
      expect(reviewEvent.actor).toBe("human");
    }
  });

  it("D5 — the canonical nine are an unbroken path in the documented order", () => {
    for (const scenario of SCENARIOS) {
      const chain = buildEventChain(scenario, runAudit(scenario));
      expect(chain.canonical, scenario.scenarioId).toHaveLength(9);
      expect(chain.canonical.map((e) => e.type)).toEqual([...CANONICAL_SPINE]);
      // Each one's parent is the previous one — no unsealed gap in the middle.
      for (let i = 1; i < chain.canonical.length; i++) {
        expect(chain.canonical[i]!.parentEventId, `${scenario.scenarioId} link ${i}`).toBe(
          chain.canonical[i - 1]!.eventId,
        );
      }
    }
  });

  it("D6 — 'why did this conclusion happen?' walks back to the evidence", () => {
    const result = runAudit(financialScenario);
    const chain = buildEventChain(financialScenario, result);
    const conclusion = chain.events.find((e) => e.type === "conclusion.created")!;

    const path = ancestorsOf(chain.events, conclusion.eventId);
    expect(path.map((e) => e.type)).toEqual([...CANONICAL_SPINE]);
    expect(path.map((e) => e.eventId)).toEqual(chain.canonical.map((e) => e.eventId));

    // The path names the hero finding, its control, and the ledger it read.
    expect(path.find((e) => e.type === "finding.created")!.findingRef).toBe("F-FIN-001");
    expect(path.find((e) => e.type === "control.tested")!.controlRef).toBe("REV-REC-01");
    expect(path[1]!.artifactRefs).toContain("ART-FIN-001");
  });

  it("D7 — the representative control event is the one behind the hero finding", () => {
    const chain = buildEventChain(financialScenario, runAudit(financialScenario));
    const representative = chain.canonical.find((e) => e.type === "control.tested")!;
    expect(representative.controlRef).toBe("REV-REC-01");
    // Its siblings are the other eleven controls.
    expect(childrenOf(chain.events, representative.parentEventId!)).toHaveLength(12);
  });

  it("D8 — event ids and logical times are deterministic and ordered", () => {
    const a = buildEventChain(financialScenario, runAudit(financialScenario));
    const b = buildEventChain(financialScenario, runAudit(financialScenario));
    expect(b.events.map((e) => e.eventId)).toEqual(a.events.map((e) => e.eventId));
    expect(a.events[0]!.eventId).toBe("EVT-FIN-2609-001");
    expect(a.events[29]!.eventId).toBe("EVT-FIN-2609-030");

    const times = a.events.map((e) => Date.parse(e.occurredAt));
    expect(times).toEqual([...times].sort((x, y) => x - y));
    // Logical time, not wall-clock: the hero audit is dated in the past.
    expect(a.events[0]!.occurredAt.startsWith("2026-09-15")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real cryptography from here down.
// ─────────────────────────────────────────────────────────────────────────────
const heroRun = await runAndSeal(financialScenario);

describe("E — CooL integration", () => {
  it("E1 — the hero execution seals its nine canonical events for real", () => {
    expect(heroRun.sealing.error).toBeNull();
    expect(heroRun.sealing.attempted).toBe(9);
    expect(heroRun.sealing.sealed).toBe(9);
    expect(heroRun.receipts.size).toBe(9);

    const sealed = heroRun.events.filter((e) => e.cool !== null);
    expect(sealed.map((e) => e.eventId)).toEqual([...heroRun.canonicalEventIds]);
    expect(sealed.map((e) => e.type)).toEqual([...CANONICAL_SPINE]);

    for (const event of sealed) {
      // A real receipt, not an application log dressed up as one.
      expect(event.cool!.recordId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(event.cool!.bindingHash).toMatch(/^mh:sha256:[0-9a-f]{64}$/);
      expect(event.cool!.signatureAlg).toContain("ml-dsa");
      expect(event.cool!.receiptRef).toBe(`${financialScenario.executionId}:${event.eventId}`);
    }
  });

  it("E2 — the other twenty-one events honestly carry no evidence", () => {
    const unsealed = heroRun.events.filter((e) => e.cool === null);
    expect(unsealed).toHaveLength(21);
    expect(unsealed.every((e) => !e.canonical)).toBe(true);
  });

  it("E3 — all nine receipts verify under the Milestone 1 production policy", async () => {
    const verification = await verifyRun(heroRun);
    expect(verification.results).toHaveLength(9);
    expect(verification.verified).toBe(9);
    expect(verification.failed).toBe(0);

    for (const { state } of verification.results) {
      expect(state.status).toBe("verified");
      expect(state.ok).toBe(true);
      expect(state.verdictOk).toBe(true);
      expect(state.signerTrusted).toBe(true);
      expect(state.measurementMatches).toBe(true);
      expect(state.logged).toBe(true);
      expect(state.domains.inclusion.status).toBe("pass");
      // Still honest about what is simulated.
      expect(state.hardware).toBe(false);
    }
  });

  it("E4 — the nine leaves form one append-only tree in causal order", () => {
    expect(heroRun.logState).toHaveLength(9);
    expect(heroRun.sealing.treeHead?.treeSize).toBe(9);

    const sealed = heroRun.events.filter((e) => e.cool !== null);
    sealed.forEach((event, index) => {
      // sequence and leaf_index move together within an execution.
      expect(event.cool!.leafIndex).toBe(index);
      expect(event.cool!.bindingHash).toBe(heroRun.logState[index]);
    });
  });

  it("E5 — one execution id ties the nine receipts into a single trail", () => {
    for (const event of heroRun.events.filter((e) => e.cool !== null)) {
      const receipt = heroRun.receipts.get(event.cool!.receiptRef) as any;
      expect(receipt.record.event.execution_id).toBe(financialScenario.executionId);
      expect(receipt.record.event.type).toBe(event.type);
      expect(receipt.record.event.software.name).toBe(SOFTWARE_NAME);
      // The digest workaround from Milestone 1 is still in force.
      expect(receipt.record.event.software.digest).toBeNull();
    }
  });

  it("E6 — the receipts leak none of the audit's content", () => {
    const serialised = JSON.stringify([...heroRun.receipts.values()]);
    for (const secret of [
      "AUD-FIN-2026-09",
      "REV-REC-01",
      "F-FIN-001",
      "C-1001",
      "Northwind",
      "J. Okafor",
      "1420000",
      "12 controls tested",
    ]) {
      expect(serialised.includes(secret), `receipt leaked ${secret}`).toBe(false);
    }
  });

  it("E7 — altering a sealed finding breaks verification", async () => {
    const findingEvent = heroRun.events.find((e) => e.type === "finding.created" && e.cool)!;
    const original = heroRun.receipts.get(findingEvent.cool!.receiptRef);
    const tampered = JSON.parse(JSON.stringify(original)) as any;

    // The demo's tamper story: rewrite the committed content.
    tampered.record.event.commitments.output = flipLastHex(
      tampered.record.event.commitments.output as string,
    );

    const state = await verifyReceipt(tampered);
    expect(state.ok).toBe(false);
    expect(state.status).toBe("failed");
    expect(state.verdictOk).toBe(false);
    expect(state.coolReasons.length).toBeGreaterThan(0);

    // And the untouched receipt still verifies, so the failure is specific.
    expect((await verifyReceipt(original)).ok).toBe(true);
  });

  it("E8 — an audit whose sealing fails still completes, and says so", async () => {
    const run = await runAndSeal(financialScenario, { seal: false });
    expect(run.result.conclusion.controlsTested).toBe(12);
    expect(run.events).toHaveLength(30);
    expect(run.events.every((e) => e.cool === null)).toBe(true);
    expect(run.sealing.sealed).toBe(0);
    expect(run.receipts.size).toBe(0);
  });

  it("E9 — a live human review produces its own verifiable receipt", async () => {
    const outcome = await submitReview(financialScenario, {
      findingId: "F-FIN-002",
      decision: "modified",
      modifiedSeverity: "high",
      note: "On re-read the approval breach is systemic, not a one-off. Raising severity.",
      reviewer: { name: "A. Demir", role: "Audit Partner" },
      reviewedAt: "2026-12-14T10:05:00.000Z",
      sequence: 30,
      logState: heroRun.logState,
    });

    expect(outcome.sealing.sealed).toBe(true);
    expect(outcome.sealing.error).toBeNull();
    expect(outcome.event.eventId).toBe("EVT-FIN-2609-031");
    expect(outcome.event.type).toBe("human.review.completed");
    expect(outcome.event.actor).toBe("human");
    expect(outcome.finding.severity).toBe("high");
    expect(outcome.finding.originalSeverity).toBe("medium");
    expect(outcome.finding.status).toBe("modified");

    // Appended to the existing tree rather than starting a new one.
    expect(outcome.logState).toHaveLength(10);
    expect(outcome.logState.slice(0, 9)).toEqual([...heroRun.logState]);
    expect(outcome.event.cool!.leafIndex).toBe(9);

    const state = await verifyReceipt(outcome.receipt!.evidence);
    expect(state.ok).toBe(true);
    expect(state.logged).toBe(true);

    // It hangs off the same finding.created event as the baseline review, so
    // both decisions are readable in order.
    const baseline = heroRun.events.find(
      (e) => e.type === "finding.created" && e.findingRef === "F-FIN-002",
    )!;
    expect(outcome.event.parentEventId).toBe(baseline.eventId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G — source discipline", () => {
  /**
   * Every `.ts` file under a directory, with comments stripped.
   *
   * Comments have to go: this file's own prose says "never `Date.now()`", and a
   * scanner that cannot tell a warning from a violation is a scanner nobody
   * trusts.
   */
  async function sources(dir: string): Promise<{ path: string; text: string }[]> {
    const { readdir, readFile } = await import("node:fs/promises");
    const out: { path: string; text: string }[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const path = `${entry.parentPath ?? entry.path}/${entry.name}`.replace(/\\/g, "/");
      const raw = await readFile(path, "utf8");
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      out.push({ path, text: code });
    }
    return out;
  }

  it("G1 — the audit domain contains no source of nondeterminism", async () => {
    // `run.ts`, `review.ts`, and `integrity.ts` are exempt: sealing time, a
    // live reviewer's timestamp, and `verifiedAt` are genuinely "now".
    const exempt = ["lib/audit/run.ts", "lib/audit/review.ts", "lib/audit/integrity.ts"];
    const offenders: string[] = [];

    for (const file of await sources("lib/audit")) {
      if (exempt.some((e) => file.path.endsWith(e))) continue;
      for (const banned of [
        /Math\.random/,
        /Date\.now/,
        /crypto\.randomUUID/,
        // `new Date(x)` is fine; `new Date()` reads the wall clock.
        /new Date\(\s*\)/,
        /performance\.now/,
      ]) {
        if (banned.test(file.text)) offenders.push(`${file.path}: ${banned.source}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("G2 — nothing in lib/ calls an external model provider", async () => {
    const offenders: string[] = [];
    for (const file of await sources("lib")) {
      for (const banned of [
        /api\.openai\.com/,
        /api\.anthropic\.com/,
        /generativelanguage\.googleapis\.com/,
        /from ["'](openai|@anthropic-ai\/sdk|@google\/gener)/,
      ]) {
        if (banned.test(file.text)) offenders.push(`${file.path}: ${banned.source}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("G3 — the audit domain reaches cool-nwc only through the adapter", async () => {
    const offenders: string[] = [];
    for (const file of await sources("lib/audit")) {
      if (/from ["']cool-nwc/.test(file.text)) offenders.push(`${file.path}: cool-nwc`);

      // `import type` from lib/cool/types is the designed seam — that module
      // imports no SDK code, so a type-only import pulls nothing into the
      // graph. A VALUE import is what couples the domain to cryptography, and
      // only run.ts and review.ts may do it.
      const valueImport = /(^|\n)\s*import\s+(?!type\b)[^;]*from\s+["']@\/lib\/cool/.test(file.text);
      const allowed =
        file.path.endsWith("lib/audit/run.ts") ||
        file.path.endsWith("lib/audit/review.ts") ||
        file.path.endsWith("lib/audit/integrity.ts");
      if (valueImport && !allowed) offenders.push(`${file.path}: value import of @/lib/cool`);
    }
    expect(offenders).toEqual([]);

    // And the seam is real: the engine and the event manager are value-free of
    // the adapter, so sections A–D need no evidence plane.
    const engineFiles = (await sources("lib/audit")).filter((f) =>
      /(engine|events|ids|reasoner|types|views)\.ts$/.test(f.path),
    );
    expect(engineFiles.length).toBeGreaterThanOrEqual(6);
  });

  it("G4 — nothing joins on an unstable CooL identifier", () => {
    // bindingHash and recordId change on every sealing, so using either as a
    // lookup key would break silently across regenerations.
    for (const scenario of SCENARIOS) {
      const chain = buildEventChain(scenario, runAudit(scenario));
      for (const event of chain.events) {
        const keys = Object.keys(event);
        expect(keys).not.toContain("bindingHash");
        expect(keys).not.toContain("recordId");
      }
    }
    // Receipts are keyed by `${executionId}:${eventId}` — both VeriAudit ids.
    for (const [ref] of heroRun.receipts) {
      expect(ref.startsWith(`${financialScenario.executionId}:EVT-`)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F — the complete financial execution (the demo, as one test)", () => {
  it("F1 — run → 12/9/3 → review → conclusion → events → CooL verification", async () => {
    const run = heroRun;

    // 1. The audit ran and produced the source-of-truth result.
    expect(run.result.auditId).toBe("AUD-FIN-2026-09");
    expect(run.result.executionId).toBe("EXEC-FIN-2026-09-001");
    expect(run.result.conclusion.controlsTested).toBe(12);
    expect(run.result.conclusion.controlsPassed).toBe(9);
    expect(run.result.conclusion.exceptions).toBe(3);

    // 2. Three findings, each traceable to a control and to evidence.
    expect(run.result.findings).toHaveLength(3);
    expect(run.result.findings.map((f) => f.controlId)).toEqual([
      "REV-REC-01",
      "APR-CHAIN-06",
      "SEG-DUT-10",
    ]);

    // 3. A person reviewed all three, and did not simply approve them.
    expect(run.result.reviews).toHaveLength(3);
    expect(run.result.reviews.map((r) => r.decision)).toEqual([
      "accepted",
      "accepted",
      "modified",
    ]);
    expect(run.result.conclusion.humanReviewCompleted).toBe(true);

    // 4. The whole execution is on record, with nine events sealed.
    expect(run.events).toHaveLength(30);
    expect(run.sealing.sealed).toBe(9);

    // 5. The conclusion is reconstructable back to the ledger it was read from.
    const conclusion = run.events.find((e) => e.type === "conclusion.created")!;
    const path = ancestorsOf(run.events, conclusion.eventId);
    expect(path.map((e) => e.type)).toEqual([...CANONICAL_SPINE]);
    expect(path.every((e) => e.cool !== null)).toBe(true);
    expect(conclusion.detail).toMatchObject({
      controls_tested: 12,
      controls_passed: 9,
      exceptions: 3,
      human_review_completed: true,
    });

    // 6. Every step of that reconstruction verifies cryptographically.
    const verification = await verifyRun(run);
    expect(verification.verified).toBe(9);
    expect(verification.failed).toBe(0);

    // 7. And the trail a frontend would render is complete.
    const trail = trailView(run);
    expect(trail.counts).toMatchObject({ events: 30, canonical: 9, sealed: 9 });
    expect(trail.spineEventIds).toHaveLength(9);
    expect(trail.edges).toHaveLength(29);
    expect(trail.rootEventId).toBe("EVT-FIN-2609-001");
  });
});
