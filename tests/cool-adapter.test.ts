/**
 * The CooL adapter's contract tests. Test ids match docs/TESTING_PLAN.md §2.
 *
 * These are the tests that keep the integration honest. In particular C10
 * exists because discovery proved `verdict.ok === true` is NOT sufficient to
 * display VERIFIED: a receipt with its inclusion proof deleted still satisfies
 * the SDK with zero reasons.
 */
import { describe, expect, it } from "vitest";
import { canonicalEventPayload, contentDigest } from "@/lib/cool/canonical";
import { APP_ID, IMAGE_DIGEST, LOG_ID } from "@/lib/cool/config";
import {
  EXPECTED_MEASUREMENT,
  GENERATED_FOR,
  TRUSTED_RECORD_KEY_IDS,
  describeIdentity,
  sealedKeys,
} from "@/lib/cool/identity";
import { assertValidLogState, proveAppendOnly, rehydrate } from "@/lib/cool/log-state";
import { recordEvent, recordEvents } from "@/lib/cool/recorder";
import { verifyReceipt } from "@/lib/cool/verifier";
import { sampleEvent, sampleTrail } from "@/lib/proof/sample-trail";
import { clone, flipLastHex, runTamperMatrix, tamperCases } from "@/lib/proof/tamper";

/** One genuine recording, reused across tests to keep the suite quick. */
const genuine = await recordEvent(sampleEvent(), []);
const receipt = genuine.recorded[0]!.receipt as any;

describe("C0 — package and identity", () => {
  it("uses cool-nwc@3.0.0", async () => {
    // `cool-nwc` does not export "./package.json", so read the installed
    // manifest from disk rather than importing the subpath.
    const { readFile } = await import("node:fs/promises");
    const manifest = JSON.parse(
      await readFile("node_modules/cool-nwc/package.json", "utf8"),
    ) as { name: string; version: string };
    expect(manifest.name).toBe("cool-nwc");
    expect(manifest.version).toBe("3.0.0");
  });

  it("C1 — the live plane matches the committed identity pin", async () => {
    const identity = await describeIdentity();
    expect(identity.pinned.matches).toBe(true);
    expect(identity.pinned.differingRegisters).toEqual([]);
    expect(identity.applicationId).toBe(GENERATED_FOR.applicationId);
    expect(identity.imageDigest).toBe(GENERATED_FOR.imageDigest);
    expect(identity.logId).toBe(GENERATED_FOR.logId);
    expect(TRUSTED_RECORD_KEY_IDS).toContain(receipt.record.signature.key_id);
  });

  it("C1b — identity is a pure function of (appName, imageDigest)", async () => {
    const a = await describeIdentity();
    const b = await describeIdentity();
    expect(b.measurement).toEqual(a.measurement);
    expect(b.keyDirectory).toEqual(a.keyDirectory);
    expect(a.measurement).toEqual(EXPECTED_MEASUREMENT as unknown as Record<string, string>);
  });

  it("reports a simulated, non-hardware runtime honestly", async () => {
    const identity = await describeIdentity();
    expect(identity.hardware).toBe(false);
    expect(identity.runtimeMode).toBe("simulated");
  });
});

describe("C2 — canonicalisation is deterministic", () => {
  it("produces an identical payload every time", () => {
    const event = sampleEvent();
    expect(canonicalEventPayload(event)).toEqual(canonicalEventPayload(event));
    expect(contentDigest(event)).toBe(contentDigest(event));
  });

  it("is insensitive to input key order but sensitive to values", () => {
    const event = sampleEvent();
    const reordered = {
      ...event,
      detail: Object.fromEntries(Object.entries(event.detail).reverse()),
    };
    expect(contentDigest(reordered)).toBe(contentDigest(event));

    const changed = { ...event, detail: { ...event.detail, severity: "low" } };
    expect(contentDigest(changed)).not.toBe(contentDigest(event));
  });

  it("emits fixed key order and no unstable fields", () => {
    const payload = canonicalEventPayload(sampleEvent()) as unknown as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual([
      "schema",
      "actor",
      "artifact_ids",
      "audit_id",
      "detail",
      "event_id",
      "event_type",
      "execution_id",
      "occurred_at",
      "parent_event_id",
      "scenario",
      "sequence",
      "summary",
      "title",
    ]);
    // No sealing time, request id, or render state leaked into the commitment.
    expect(JSON.stringify(payload)).not.toContain("issued_at");
  });

  it("rejects values that cannot be committed deterministically", () => {
    const event = sampleEvent();
    expect(() => contentDigest({ ...event, detail: { n: NaN as never } })).toThrow(TypeError);
    expect(() => contentDigest({ ...event, sequence: 1.5 })).toThrow(TypeError);
    expect(() => contentDigest({ ...event, executionId: "" })).toThrow(TypeError);
  });
});

describe("C3 — record produces a real, verifiable receipt", () => {
  it("returns a cool.receipt.v2 envelope", () => {
    expect(receipt.schema ?? receipt.kind ?? "").toMatch(/cool\.receipt/);
    expect(receipt.binding_hash).toMatch(/^mh:sha256:[0-9a-f]{64}$/);
    expect(receipt.record.signature.alg).toBe("ml-dsa-65+ed25519");
  });

  it("record → verify → VERIFIED", async () => {
    const state = await verifyReceipt(receipt);
    expect(state.status).toBe("verified");
    expect(state.ok).toBe(true);
    expect(state.verdictOk).toBe(true);
    expect(state.signerTrusted).toBe(true);
    expect(state.measurementMatches).toBe(true);
    expect(state.logged).toBe(true);
    expect(state.failures).toEqual([]);
    expect(state.coolReasons).toEqual([]);
  });

  it("keeps the event type and execution id in cleartext, and the payload out", () => {
    expect(receipt.record.event.type).toBe("finding.created");
    expect(receipt.record.event.execution_id).toBe(sampleEvent().executionId);
    // The committed metadata and payloads must NOT be recoverable.
    const text = JSON.stringify(receipt);
    expect(text).not.toContain("revenue recognized before performance obligation satisfied");
    expect(text).not.toContain("C-1001");
    expect(text).not.toContain("J. Okafor");
  });

  it("survives a JSON round trip (it crosses HTTP and IndexedDB)", async () => {
    const state = await verifyReceipt(JSON.parse(JSON.stringify(receipt)));
    expect(state.ok).toBe(true);
  });

  it("C3b — the verdict carries the claim boundary, not an AI-correctness claim", async () => {
    const state = await verifyReceipt(receipt);
    expect(state.claim).toMatch(/does NOT mean the AI's conclusion was correct/);
    expect(state.hardware).toBe(false);
    expect(state.domains.attestation.status).not.toBe("pass");
    expect(state.domains.witnesses.status).toBe("absent");
  });
});

describe("C4 — the software.digest workaround", () => {
  it("verifies when digest is explicitly null", () => {
    expect(receipt.record.event.software).toEqual({
      name: "veriaudit-audit-engine",
      version: expect.any(String),
      digest: null,
    });
  });

  it("FAILS if the digest key is removed — this is why the workaround exists", async () => {
    const bad = clone(receipt);
    delete bad.record.event.software.digest;
    const state = await verifyReceipt(bad);
    expect(state.ok).toBe(false);
    expect(state.verdictOk).toBe(false);
    expect(state.coolReasons.join(" ")).toContain("software.digest");
  });
});

describe("C10 — trust checks beyond verdict.ok (the required tamper matrix)", () => {
  it("runs every case with the expected outcome", async () => {
    const { allPass, results } = await runTamperMatrix(receipt);
    const table = results
      .map((r) => `${r.id} ${r.pass ? "ok " : "BAD"} ${r.actual.padEnd(8)} ${r.name}`)
      .join("\n");
    expect(allPass, `tamper matrix:\n${table}`).toBe(true);
    expect(results).toHaveLength(13);
  });

  it("exercises each required case explicitly", async () => {
    const cases = await tamperCases(receipt);
    const byId = new Map(cases.map((c) => [c.id, c]));

    // valid receipt → VERIFIED
    expect((await byId.get("T1")!.run()).ok).toBe(true);

    // altered evidence → FAILED
    const altered = await byId.get("T3")!.run();
    expect(altered.ok).toBe(false);
    expect(altered.failures.some((f) => f.check === "cool")).toBe(true);

    // wrong measurement → FAILED, isolated from the key check
    const wrongMeasurement = await byId.get("T4")!.run();
    expect(wrongMeasurement.ok).toBe(false);
    expect(wrongMeasurement.measurementMatches).toBe(false);
    expect(wrongMeasurement.signerTrusted).toBe(true);
    expect(wrongMeasurement.failures.map((f) => f.check)).toContain("measurement");

    // wrong / untrusted key → FAILED, isolated from the measurement check
    const wrongKey = await byId.get("T5")!.run();
    expect(wrongKey.ok).toBe(false);
    expect(wrongKey.signerTrusted).toBe(false);
    expect(wrongKey.measurementMatches).toBe(true);
    expect(wrongKey.failures.map((f) => f.check)).toContain("signer");

    // missing inclusion → FAILED even though CooL itself is satisfied
    const noInclusion = await byId.get("T6")!.run();
    expect(noInclusion.ok).toBe(false);
    expect(noInclusion.logged).toBe(false);
    expect(noInclusion.domains.inclusion.status).toBe("absent");
    expect(noInclusion.failures.map((f) => f.check)).toContain("inclusion");
    // The whole reason this check exists: CooL accepts the receipt outright.
    expect(noInclusion.verdictOk).toBe(true);
    expect(noInclusion.coolReasons).toEqual([]);
  });

  it("distinguishes a null inclusion from a removed one", async () => {
    const cases = await tamperCases(receipt);
    const byId = new Map(cases.map((c) => [c.id, c]));
    // `null` is structurally valid and means "not logged" — CooL says ok.
    expect((await byId.get("T6")!.run()).verdictOk).toBe(true);
    // `undefined` is structurally invalid — CooL rejects the whole receipt.
    const removed = await byId.get("T6b")!.run();
    expect(removed.verdictOk).toBe(false);
    expect(removed.coolReasons.join(" ")).toMatch(/inclusion: expected an object/);
  });

  it("pins keys so an edited key directory cannot discredit real evidence", async () => {
    const cases = await tamperCases(receipt);
    const byId = new Map(cases.map((c) => [c.id, c]));
    // Swapping the receipt's self-asserted key is neutralised: still VERIFIED.
    expect((await byId.get("T9")!.run()).ok).toBe(true);
    // But a forgery relabelled with our key id fails the signature check,
    // even though it satisfies the allow-list.
    const relabelled = await byId.get("T9b")!.run();
    expect(relabelled.ok).toBe(false);
    expect(relabelled.signerTrusted).toBe(true);
    expect(relabelled.domains.signature.status).toBe("fail");
  });

  it("never throws, whatever it is handed", async () => {
    for (const input of [null, undefined, "", 0, [], {}, { record: {} }, { record: { signature: 1 } }]) {
      const state = await verifyReceipt(input);
      expect(state.ok).toBe(false);
      expect(state.failures.length).toBeGreaterThan(0);
    }
  });
});

describe("C5 — the shared append-only tree", () => {
  it("records a trail into one tree with leaf order preserved", async () => {
    const events = sampleTrail();
    const result = await recordEvents(events, []);

    expect(result.recorded).toHaveLength(9);
    expect(result.recorded.map((r) => r.reference.leafIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.recorded.at(-1)!.reference.treeSize).toBe(9);
    expect(result.treeHead).toMatchObject({ logId: LOG_ID, treeSize: 9 });

    const states = await Promise.all(result.recorded.map((r) => verifyReceipt(r.receipt)));
    expect(states.every((s) => s.ok)).toBe(true);
  });

  it("continues the same tree across a stateless second invocation", async () => {
    const events = sampleTrail();
    const first = await recordEvents(events.slice(0, 4), []);
    const second = await recordEvents(events.slice(4), first.logState);

    expect(second.recorded.map((r) => r.reference.leafIndex)).toEqual([4, 5, 6, 7, 8]);
    expect(second.treeHead!.treeSize).toBe(9);
    expect(second.logState).toHaveLength(9);

    // Receipts sealed in the first call still verify after the tree grew.
    const old = await verifyReceipt(first.recorded[0]!.receipt);
    expect(old.ok).toBe(true);

    // And rehydrating from stored hashes reproduces the signed root exactly.
    const keys = await sealedKeys();
    expect(rehydrate(keys.log, second.logState).rootHash()).toBe(second.treeHead!.rootHash);
  });

  it("proves honest growth and detects deleted history", async () => {
    const events = sampleTrail();
    const first = await recordEvents(events.slice(0, 4), []);
    const second = await recordEvents(events.slice(4), first.logState);
    const keys = await sealedKeys();
    const head = { treeSize: first.treeHead!.treeSize, rootHash: first.treeHead!.rootHash };

    expect(proveAppendOnly(keys.log, head, second.logState).ok).toBe(true);

    // Remove a historical entry: consistency must fail.
    const withHole = [...second.logState.slice(0, 2), ...second.logState.slice(3)];
    const deleted = proveAppendOnly(keys.log, head, withHole);
    expect(deleted.ok).toBe(false);
    expect(deleted.reason).toMatch(/removed, reordered, or altered/);

    // Forge the earlier root: consistency must fail.
    const forged = proveAppendOnly(
      keys.log,
      { ...head, rootHash: flipLastHex(head.rootHash) },
      second.logState,
    );
    expect(forged.ok).toBe(false);

    // Shrinking is caught before any proof is attempted.
    expect(proveAppendOnly(keys.log, { treeSize: 9, rootHash: head.rootHash }, []).ok).toBe(false);
  });

  it("rejects malformed log state rather than silently starting a new tree", () => {
    expect(assertValidLogState([])).toEqual([]);
    expect(assertValidLogState(null)).toEqual([]);
    expect(() => assertValidLogState("mh:sha256:abc")).toThrow(TypeError);
    expect(() => assertValidLogState(["not-a-hash"])).toThrow(TypeError);
    expect(() => assertValidLogState([receipt.binding_hash, 42])).toThrow(TypeError);
  });

  it("C2b — the same event recorded twice keeps a stable content digest", async () => {
    const event = sampleEvent();
    const a = await recordEvent(event, []);
    const b = await recordEvent(event, []);
    const refA = a.recorded[0]!.reference;
    const refB = b.recorded[0]!.reference;

    // Reproducible: the canonical payload digest.
    expect(refB.contentDigest).toBe(refA.contentDigest);
    // NOT reproducible, by design: randomSalt draws fresh bytes per record.
    expect(refB.bindingHash).not.toBe(refA.bindingHash);
    // Same plane, so the same signing key.
    expect(refB.keyId).toBe(refA.keyId);
  });
});

describe("adapter boundary", () => {
  it("keeps cool-nwc imports inside lib/cool and lib/proof", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join, extname } = await import("node:path");

    // The adapter, the proof harness, and the identity generator may import the
    // SDK. `tests/` is excluded because this very file names the package.
    const allowed = ["lib/cool/", "lib/proof/", "scripts/", "tests/"];
    const skipDirs = ["node_modules", ".next", "cool-sdk", "cool-proof", ".git", ".vercel"];

    const offenders: string[] = [];
    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (skipDirs.includes(entry.name)) continue;
          await walk(path);
          continue;
        }
        if (![".ts", ".tsx"].includes(extname(entry.name))) continue;
        const normalised = path.replaceAll("\\", "/");
        if (allowed.some((prefix) => normalised.includes(prefix))) continue;
        if ((await readFile(path, "utf8")).includes('"cool-nwc')) offenders.push(normalised);
      }
    }
    await walk(process.cwd());

    expect(offenders, `these files import cool-nwc outside the adapter: ${offenders.join(", ")}`)
      .toEqual([]);
  });

  it("records under the configured plane", () => {
    expect(APP_ID).toBe("veriaudit");
    expect(IMAGE_DIGEST).toBe(GENERATED_FOR.imageDigest);
    expect(receipt.sth.log_id).toBe(LOG_ID);
  });
});
