/**
 * Milestone 3: the append-only execution trail.
 *
 * The event model and the canonical nine were built in Milestone 2. These
 * tests add the properties that make them a *trail*: append-only application
 * semantics, rehydration of the RFC 6962 tree from public hashes, and
 * historical tamper detection that uses the verified CooL behaviour rather
 * than a homemade failure flag.
 *
 * Milestone 1's PRODUCTION_POLICY is used unchanged.
 */
import { describe, expect, it } from "vitest";
import {
  AppendOnlyError,
  ExecutionTrail,
  ancestorsOf,
  bindReceipt,
  eventById,
  eventsByType,
  financialScenario,
  fingerprintLogState,
  proveTrailContinues,
  queryEvents,
  runAndSeal,
  SCENARIOS,
  submitReview,
  verifyTrail,
} from "@/lib/audit";
import { assertValidLogState } from "@/lib/cool/log-state";
import { recordEvent } from "@/lib/cool/recorder";
import { verifyReceipt } from "@/lib/cool/verifier";
import { flipLastHex } from "@/lib/proof/tamper";

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

const heroRun = await runAndSeal(financialScenario);
const heroTrail = ExecutionTrail.fromRun(heroRun);

describe("H — shared event model, all four scenarios", () => {
  it("H1 — every scenario produces one shared event shape and the nine-stage spine", async () => {
    for (const scenario of SCENARIOS) {
      const run = scenario.scenarioId === "financial" ? heroRun : await runAndSeal(scenario);
      const trail = ExecutionTrail.fromRun(run);
      const why = trail.whyConclusion();

      expect(why.path.map((s) => s.type)).toEqual([...CANONICAL_SPINE]);
      expect(why.path.every((s) => s.sealed)).toBe(true);
      expect(run.sealing.sealed).toBe(9);
      expect(run.sealing.error).toBeNull();

      for (const event of run.events) {
        expect(event.eventId).toMatch(/^EVT-/);
        expect(event.auditId).toBe(scenario.auditId);
        expect(event.executionId).toBe(scenario.executionId);
        expect(typeof event.sequence).toBe("number");
        expect(typeof event.occurredAt).toBe("string");
        expect(["ai", "human", "system"]).toContain(event.actor);
        expect(event).toHaveProperty("parentEventId");
        expect(event).toHaveProperty("artifactRefs");
      }
    }
  });

  it("H2 — event lookup and type filter are deterministic", () => {
    const byId = eventById(heroRun.events, "EVT-FIN-2609-016");
    expect(byId?.type).toBe("control.tested");
    expect(byId?.controlRef).toBe("REV-REC-01");

    const controls = eventsByType(heroRun.events, "control.tested");
    expect(controls).toHaveLength(12);
    expect(controls.map((e) => e.sequence)).toEqual([...controls].map((e) => e.sequence).sort((a, b) => a - b));

    const chronological = queryEvents(heroRun.events, { order: "occurredAt" });
    expect(chronological.map((e) => e.eventId)).toEqual(heroRun.events.map((e) => e.eventId));
  });
});

describe("I — append-only application semantics", () => {
  it("I1 — a sealed trail refuses replace, delete, and reorder", () => {
    const event = heroTrail.events[0]!;
    expect(() => heroTrail.replace(event.eventId, { ...event, title: "rewritten" })).toThrow(AppendOnlyError);
    expect(() => heroTrail.remove(event.eventId)).toThrow(AppendOnlyError);
    expect(() => heroTrail.reorder(heroTrail.events.map((e) => e.eventId).reverse())).toThrow(
      AppendOnlyError,
    );
    // The original is still addressable after the refused writes.
    expect(heroTrail.get("EVT-FIN-2609-001")?.type).toBe("audit.started");
    expect(heroTrail.events).toHaveLength(30);
  });

  it("I2 — a correction is a new event; history stays put", () => {
    const parent = heroTrail.get("EVT-FIN-2609-024")!;
    const correction = {
      ...parent,
      eventId: "EVT-FIN-2609-031",
      sequence: 30,
      type: "human.review.completed" as const,
      actor: "human" as const,
      parentEventId: parent.eventId,
      title: "Correction: severity confirmed high",
      summary: "A later reviewer recorded a correction; the original review remains.",
      reviewRef: "REV-FIN-001-L030",
      cool: null,
    };

    const next = heroTrail.append(correction);
    expect(next.events).toHaveLength(31);
    expect(heroTrail.events).toHaveLength(30);
    expect(heroTrail.get("EVT-FIN-2609-024")?.title).toBe(parent.title);
    expect(next.get("EVT-FIN-2609-024")?.title).toBe(parent.title);
    expect(next.get("EVT-FIN-2609-031")?.parentEventId).toBe(parent.eventId);

    expect(() => heroTrail.append({ ...correction, sequence: 17 })).toThrow(/next append must be 30/);
    expect(() => heroTrail.append({ ...correction, eventId: parent.eventId, sequence: 30 })).toThrow(
      /already exists/,
    );
  });
});

describe("J — reconstructability", () => {
  it("J1 — the backend answers 'what caused the final conclusion?'", () => {
    const why = heroTrail.whyConclusion();
    expect(why.question).toBe("What caused the final conclusion?");
    expect(why.path).toHaveLength(9);
    expect(why.path.map((s) => s.type)).toEqual([...CANONICAL_SPINE]);
    expect(why.path[0]!.parentEventId).toBeNull();
    for (let i = 1; i < why.path.length; i++) {
      expect(why.path[i]!.parentEventId).toBe(why.path[i - 1]!.eventId);
    }

    const conclusion = heroTrail.events.find((e) => e.type === "conclusion.created")!;
    expect(ancestorsOf(heroTrail.events, conclusion.eventId).map((e) => e.eventId)).toEqual(
      why.path.map((s) => s.eventId),
    );
    expect(conclusion.detail).toMatchObject({
      controls_tested: 12,
      controls_passed: 9,
      exceptions: 3,
    });
  });

  it("J2 — the snapshot names the first event, last event, and tree head", () => {
    const snapshot = heroTrail.snapshot();
    expect(snapshot.executionId).toBe("EXEC-FIN-2026-09-001");
    expect(snapshot.auditId).toBe("AUD-FIN-2026-09");
    expect(snapshot.eventCount).toBe(30);
    expect(snapshot.sealedCount).toBe(9);
    expect(snapshot.firstEvent?.eventId).toBe("EVT-FIN-2609-001");
    expect(snapshot.lastEvent?.eventId).toBe("EVT-FIN-2609-030");
    expect(snapshot.treeHead?.treeSize).toBe(9);
    expect(snapshot.treeHead?.rootHash).toMatch(/^mh:sha256:[0-9a-f]{64}$/);
    expect(snapshot.verificationStatus).toBe("unavailable");
  });
});

describe("K — rehydration", () => {
  it("K1 — create → append → capture root → destroy → rehydrate → match → continue", async () => {
    const original = await fingerprintLogState(heroRun.logState);
    expect(original.treeSize).toBe(9);
    expect(original.rootHash).toBe(heroRun.sealing.treeHead!.rootHash);

    // The live MemoryLog is gone. Only the public hashes remain.
    const rehydrated = await fingerprintLogState([...heroRun.logState]);
    expect(rehydrated.rootHash).toBe(original.rootHash);
    expect(rehydrated.treeSize).toBe(original.treeSize);

    const continued = await submitReview(financialScenario, {
      findingId: "F-FIN-002",
      decision: "accepted",
      note: "Rehydration probe: a later review appended after the tree was rebuilt from hashes.",
      sequence: 30,
      logState: heroRun.logState,
    });
    expect(continued.sealing.sealed).toBe(true);
    expect(continued.logState).toHaveLength(10);

    const after = await proveTrailContinues(
      { treeSize: original.treeSize, rootHash: original.rootHash },
      continued.logState,
    );
    expect(after.ok).toBe(true);
    expect(after.current.treeSize).toBe(10);
    expect(after.current.rootHash).not.toBe(original.rootHash);
  });
});

describe("L — historical tamper detection", () => {
  const head = {
    treeSize: heroRun.sealing.treeHead!.treeSize,
    rootHash: heroRun.sealing.treeHead!.rootHash,
  };
  const logState = assertValidLogState([...heroRun.logState]);

  it("L1 — modifying a sealed event's content is detected", async () => {
    const finding = heroRun.events.find((e) => e.type === "finding.created" && e.cool)!;
    const receipt = heroRun.receipts.get(finding.cool!.receiptRef);
    const rewritten = { ...finding, title: "zero exceptions actually" };

    const bound = await bindReceipt(rewritten, receipt, logState);
    expect(bound.state.ok).toBe(true);
    expect(bound.bound).toBe(false);
    expect(bound.bindFailures.some((f) => f.includes("content"))).toBe(true);
  });

  it("L2 — deleting a historical leaf fails the consistency proof", async () => {
    const withHole = [...heroRun.logState.slice(0, 3), ...heroRun.logState.slice(4)];
    const proof = await proveTrailContinues(head, withHole);
    expect(proof.ok).toBe(false);
    expect(proof.reason).toMatch(/shrank|consistency|removed|reordered/i);
  });

  it("L3 — reordering historical leaves fails the consistency proof", async () => {
    const swapped = [...heroRun.logState];
    const tmp = swapped[2]!;
    swapped[2] = swapped[5]!;
    swapped[5] = tmp;
    const proof = await proveTrailContinues(head, swapped);
    expect(proof.ok).toBe(false);
  });

  it("L4 — replacing a receipt with another genuine receipt is detected", async () => {
    const a = heroRun.events.find((e) => e.type === "finding.created" && e.cool)!;
    const b = heroRun.events.find((e) => e.type === "conclusion.created" && e.cool)!;
    const foreign = heroRun.receipts.get(b.cool!.receiptRef);

    const bound = await bindReceipt(a, foreign, logState);
    expect(bound.state.ok).toBe(true);
    expect(bound.bound).toBe(false);
    expect(bound.bindFailures.length).toBeGreaterThan(0);

    const state = await verifyReceipt(foreign);
    expect(state.ok).toBe(true);
  });

  it("L5 — modifying the conclusion receipt fails CooL verification", async () => {
    const conclusion = heroRun.events.find((e) => e.type === "conclusion.created" && e.cool)!;
    const original = heroRun.receipts.get(conclusion.cool!.receiptRef);
    const tampered = JSON.parse(JSON.stringify(original)) as {
      record: { event: { commitments: { output: string } } };
    };
    tampered.record.event.commitments.output = flipLastHex(
      tampered.record.event.commitments.output,
    );

    const state = await verifyReceipt(tampered);
    expect(state.ok).toBe(false);
    expect(state.status).toBe("failed");
    expect(state.verdictOk).toBe(false);
    expect((await verifyReceipt(original)).ok).toBe(true);
  });
});

describe("M — trail integrity and the hero flow", () => {
  it("M1 — verifyTrail reports 9/9 bound and a matching rehydrated root", async () => {
    const integrity = await verifyTrail(heroRun);
    expect(integrity.status).toBe("verified");
    expect(integrity.verified).toBe(9);
    expect(integrity.failed).toBe(0);
    expect(integrity.tree.rootsMatch).toBe(true);
    expect(integrity.tree.rehydrated?.rootHash).toBe(heroRun.sealing.treeHead!.rootHash);
    expect(integrity.snapshot.eventCount).toBe(30);
    expect(integrity.snapshot.verificationStatus).toBe("verified");
  });

  it("M2 — financial hero: 12/9/3, 30 events, 9 sealed, reconstructable, verified", async () => {
    expect(heroRun.result.conclusion.controlsTested).toBe(12);
    expect(heroRun.result.conclusion.controlsPassed).toBe(9);
    expect(heroRun.result.conclusion.exceptions).toBe(3);
    expect(heroRun.events).toHaveLength(30);
    expect(heroRun.sealing.sealed).toBe(9);

    const why = heroTrail.whyConclusion();
    expect(why.path).toHaveLength(9);
    expect(why.path.every((s) => s.sealed)).toBe(true);

    const integrity = await verifyTrail(heroRun);
    expect(integrity.status).toBe("verified");
    expect(integrity.failed).toBe(0);
  });

  it("M3 — a later sealed event continues the same tree after rehydration", async () => {
    const extra = heroRun.events.find((e) => e.type === "conclusion.created")!;
    const sealed = await recordEvent(
      {
        eventId: "EVT-FIN-2609-PROBE",
        auditId: extra.auditId,
        executionId: extra.executionId,
        sequence: 30,
        type: "human.review.completed",
        actor: "human",
        scenario: extra.scenario,
        occurredAt: "2026-12-14T10:00:00.000Z",
        parentEventId: extra.eventId,
        artifactRefs: [],
        title: "Integrity continuation probe",
        summary: "Appended after the tree was discarded and rebuilt from hashes.",
        detail: { probe: true },
      },
      heroRun.logState,
    );

    expect(sealed.logState).toHaveLength(10);
    const proof = await proveTrailContinues(
      { treeSize: 9, rootHash: heroRun.sealing.treeHead!.rootHash },
      sealed.logState,
    );
    expect(proof.ok).toBe(true);
    expect((await verifyReceipt(sealed.recorded[0]!.receipt)).ok).toBe(true);
  });
});
