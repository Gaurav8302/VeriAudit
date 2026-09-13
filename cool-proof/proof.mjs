/**
 * cool-nwc SDK verification harness for VeriAudit.
 *
 * This is NOT application code. It exists to answer, with real output, the
 * questions the VeriAudit design depends on:
 *
 *   1. Can we record a VeriAudit-shaped audit event and get evidence back?
 *   2. Does verifyEvidence() actually verify it, and which domains pass?
 *   3. Does the evidence survive JSON round-trip (DB / HTTP / client)?
 *   4. Is a record deterministic across runs (can we snapshot receipts)?
 *   5. Does tampering with a stored receipt produce a real FAILED verdict?
 *   6. Does a chain of events share an executionId and produce inclusion proofs?
 *   7. How long does a record take (serverless budget)?
 *   8. What does the runtime/attestation state report on a laptop / Vercel?
 */
import { CooL, verifyEvidence, formatVerdict, saltedCommit, randomSalt } from "cool-nwc";
import { performance } from "node:perf_hooks";

const out = [];
const log = (...a) => {
  const line = a.join(" ");
  out.push(line);
  console.log(line);
};
const section = (t) => log(`\n=== ${t} ===`);

/* ── 1. construct + connect ──────────────────────────────────────────── */
section("1. CONSTRUCT + CONNECT");

const t0 = performance.now();
const cool = new CooL({ applicationId: "veriaudit" });
log(`new CooL() returned in ${(performance.now() - t0).toFixed(1)}ms (no I/O expected)`);

const t1 = performance.now();
await cool.ready();
const connectMs = performance.now() - t1;
log(`ready() (attest + seal keys + RA-TLS) took ${connectMs.toFixed(1)}ms`);
log(`environment = ${JSON.stringify(cool.environment, null, 2)}`);
log(`attestation.ok = ${cool.attestation.ok}`);
log(`attestation transcript keys = ${Object.keys(cool.attestation).join(", ")}`);
log(`attestation.reasons = ${JSON.stringify(cool.attestation.reasons)}`);
log(`keyDirectory key_ids = ${Object.keys(cool.keyDirectory).join(", ")}`);

/* ── 2. record a VeriAudit-shaped event ──────────────────────────────── */
section("2. RECORD A VERIAUDIT EVENT");

const executionId = "exec-FIN-2026-09-001";

const t2 = performance.now();
const res = await cool.record({
  type: "finding.created",
  executionId,
  metadata: {
    audit_id: "AUD-FIN-2026-09",
    finding_id: "F-001",
    control: "REV-REC-01",
    severity: "high",
    exceptions: 3,
    controls_tested: 12,
  },
  payloads: {
    input: JSON.stringify({ ledger_rows: 412, contract_ids: ["C-1001", "C-1002"] }),
    output: JSON.stringify({ conclusion: "revenue recognized before performance obligation satisfied" }),
    state: undefined,
  },
  software: { name: "veriaudit-audit-engine", version: "0.1.0" },
});
const recordMs = performance.now() - t2;

log(`record() took ${recordMs.toFixed(1)}ms`);
log(`EvidenceResult keys = ${Object.keys(res).join(", ")}`);
log(`recordId    = ${res.recordId}`);
log(`executionId = ${res.executionId}`);
log(`digest      = ${res.digest}`);
log(`evidence.schema = ${res.evidence.schema}`);
log(`evidence top-level keys = ${Object.keys(res.evidence).join(", ")}`);
log(`record core keys = ${Object.keys(res.evidence.record).join(", ")}`);
log(`event keys = ${Object.keys(res.evidence.record.event).join(", ")}`);
log(`runtime = ${JSON.stringify(res.evidence.record.runtime)}`);
log(`inclusion = ${JSON.stringify(res.evidence.inclusion)}`);
log(`sth (trimmed) = ${JSON.stringify(res.evidence.sth && { log_id: res.evidence.sth.log_id, tree_size: res.evidence.sth.tree_size, root_hash: res.evidence.sth.root_hash })}`);
log(`attestation.mode = ${res.evidence.attestation?.mode}`);
log(`anchor = ${JSON.stringify(res.evidence.anchor)}`);
log(`signature alg = ${res.evidence.record.signature.alg}`);

log(`\n--- privacy check: does the receipt leak raw values? ---`);
const asText = JSON.stringify(res.evidence);
for (const secret of ["revenue recognized before", "C-1001", "REV-REC-01", "AUD-FIN-2026-09", "high"]) {
  log(`  contains ${JSON.stringify(secret)}: ${asText.includes(secret)}`);
}
log(`evidence JSON size = ${asText.length} bytes`);

/* ── 3. verify ───────────────────────────────────────────────────────── */
section("3. VERIFY");

const t3 = performance.now();
const verdict = await verifyEvidence(res.evidence);
log(`verifyEvidence() took ${(performance.now() - t3).toFixed(1)}ms`);
log(`ok = ${verdict.ok}`);
log(`domains: ${Object.entries(verdict.checks).map(([k, v]) => `${k}=${v.status}`).join(" ")}`);
log(`reasons = ${JSON.stringify(verdict.reasons)}`);
log(`subject = ${JSON.stringify(verdict.subject)}`);
log(formatVerdict(verdict));

/* ── 4. JSON round-trip (DB / HTTP / client boundary) ────────────────── */
section("4. JSON ROUND-TRIP");

const roundTripped = JSON.parse(JSON.stringify(res.evidence));
const rtVerdict = await verifyEvidence(roundTripped);
log(`after JSON.stringify -> JSON.parse: ok = ${rtVerdict.ok}`);
log(`domains: ${Object.entries(rtVerdict.checks).map(([k, v]) => `${k}=${v.status}`).join(" ")}`);
log(`reasons = ${JSON.stringify(rtVerdict.reasons)}`);

/* ── 5. determinism across processes/instances ───────────────────────── */
section("5. DETERMINISM");

const fixedOpts = {
  applicationId: "veriaudit",
  clock: () => "2026-06-01T00:00:00.000Z",
  newId: () => "01J0000000000000000000000A",
  seq: () => 1,
};
const a = new CooL(fixedOpts);
const b = new CooL(fixedOpts);
const ra = await a.record({ type: "control.tested", executionId: "X", metadata: { control: "REV-REC-01" } });
const rb = await b.record({ type: "control.tested", executionId: "X", metadata: { control: "REV-REC-01" } });
log(`with injected clock/newId/seq, identical input:`);
log(`  binding_hash equal?  ${ra.evidence.binding_hash === rb.evidence.binding_hash}`);
log(`  metadata_hash equal? ${ra.evidence.record.event.metadata_hash === rb.evidence.record.event.metadata_hash}`);
log(`  metadata_salt equal? ${ra.evidence.record.event.metadata_salt === rb.evidence.record.event.metadata_salt}`);
log(`  key_id equal?        ${ra.evidence.record.signature.key_id === rb.evidence.record.signature.key_id}`);
log(`  key_directory equal? ${JSON.stringify(ra.evidence.key_directory) === JSON.stringify(rb.evidence.key_directory)}`);
log(`(salts are random per record => receipts are NOT byte-identical; keys ARE stable)`);
await a.close();
await b.close();

/* ── 6. manual commitment re-check (selective disclosure by hand) ────── */
section("6. COMMITMENT RE-CHECK / DISCLOSURE");

const payloadOutput = JSON.stringify({ conclusion: "revenue recognized before performance obligation satisfied" });
const storedCommit = res.evidence.record.event.commitments.output;
const storedSalt = res.evidence.record.event.commitments.output_salt;
const recomputed = saltedCommit(storedSalt, payloadOutput);
log(`stored output commitment  = ${storedCommit}`);
log(`recomputed from plaintext = ${recomputed}`);
log(`match (plaintext is the committed one) = ${recomputed === storedCommit}`);
const wrong = saltedCommit(storedSalt, payloadOutput.replace("before", "after"));
log(`recomputed from ALTERED plaintext matches = ${wrong === storedCommit}`);
log(`randomSalt() sample = ${randomSalt()}`);

/* ── 7. tamper demo on a stored receipt ──────────────────────────────── */
section("7. TAMPER DEMO");

async function tamper(label, mutate) {
  const copy = JSON.parse(JSON.stringify(res.evidence));
  mutate(copy);
  const v = await verifyEvidence(copy);
  log(`${label}: ok=${v.ok} | ${Object.entries(v.checks).map(([k, c]) => `${k}=${c.status}`).join(" ")}`);
  log(`   reasons: ${JSON.stringify(v.reasons)}`);
}

await tamper("flip one hex digit of metadata_hash", (e) => {
  const h = e.record.event.metadata_hash;
  const last = h.slice(-1);
  e.record.event.metadata_hash = h.slice(0, -1) + (last === "0" ? "1" : "0");
});
await tamper("change event.type", (e) => { e.record.event.type = "conclusion.created"; });
await tamper("change binding_hash", (e) => {
  const h = e.binding_hash;
  e.binding_hash = h.slice(0, -1) + (h.slice(-1) === "0" ? "1" : "0");
});
await tamper("swap in a foreign signature byte", (e) => {
  const s = e.record.signature.ed25519;
  e.record.signature.ed25519 = s.slice(0, -2) + (s.slice(-2, -1) === "A" ? "B" : "A") + s.slice(-1);
});
await tamper("strip key_directory", (e) => { e.key_directory = {}; });
await tamper("corrupt inclusion audit_path", (e) => {
  if (e.inclusion?.audit_path?.length) {
    const p = e.inclusion.audit_path[0];
    e.inclusion.audit_path[0] = p.slice(0, -1) + (p.slice(-1) === "0" ? "1" : "0");
  } else { log("   (no audit path on this receipt — single-leaf tree)"); }
});
await tamper("garbage input", (e) => { delete e.record; });

/* ── 8. a full VeriAudit execution chain ─────────────────────────────── */
section("8. FULL EXECUTION CHAIN (shared executionId)");

const chain = new CooL({ applicationId: "veriaudit" });
const chainExec = "exec-FIN-2026-09-002";
const steps = [
  ["audit.started",          { audit_id: "AUD-FIN-2026-09", scenario: "financial" }],
  ["artifact.ingested",      { artifact_id: "ART-001", kind: "revenue_ledger", rows: 412 }],
  ["retrieval.executed",     { query: "revenue recognition Q3", hits: 7 }],
  ["model.executed",         { model: "veriaudit-reasoner", version: "0.1.0" }],
  ["control.tested",         { control: "REV-REC-01", result: "exception" }],
  ["finding.created",        { finding_id: "F-001", severity: "high" }],
  ["human.review.completed", { reviewer: "j.okafor", decision: "accepted" }],
  ["conclusion.created",     { exceptions: 3, passed: 9, tested: 12 }],
];

const tChain = performance.now();
const receipts = [];
for (const [type, metadata] of steps) {
  const r = await chain.record({ type, executionId: chainExec, metadata });
  receipts.push(r);
}
const chainMs = performance.now() - tChain;
log(`recorded ${receipts.length} linked events in ${chainMs.toFixed(1)}ms (${(chainMs / receipts.length).toFixed(1)}ms/event)`);

for (const r of receipts) {
  const v = await verifyEvidence(r.evidence);
  log(`  ${v.ok ? "OK " : "X  "} ${r.evidence.record.event.type.padEnd(24)} leaf=${String(r.evidence.inclusion?.leaf_index).padStart(2)} tree=${String(r.evidence.inclusion?.tree_size).padStart(2)} incl=${v.checks.inclusion.status} ${r.recordId}`);
}
log(`all share executionId: ${receipts.every((r) => r.executionId === chainExec)}`);
log(`cool.evidence (retained in memory) length = ${chain.evidence.length}`);

/* ── 9. cross-instance verification (simulating serverless cold start) ─ */
section("9. CROSS-INSTANCE / COLD-START VERIFICATION");

const serialized = JSON.stringify(receipts[5].evidence);
await chain.close();
const fresh = new CooL({ applicationId: "veriaudit" });
const crossVerdict = await fresh.verify(JSON.parse(serialized));
log(`verdict from a DIFFERENT CooL instance: ok=${crossVerdict.ok}`);
log(`domains: ${Object.entries(crossVerdict.checks).map(([k, v]) => `${k}=${v.status}`).join(" ")}`);
const standalone = await verifyEvidence(JSON.parse(serialized));
log(`verdict from standalone verifyEvidence (no client at all): ok=${standalone.ok}`);
log(`=> receipts are self-contained; verification needs no live plane: ${standalone.ok}`);
await fresh.close();

/* ── 10. requireHardware + requireAttestation behaviour ──────────────── */
section("10. HARDWARE POLICY BEHAVIOUR");

const hwVerdict = await verifyEvidence(res.evidence, { requireHardware: true });
log(`verifyEvidence(..., requireHardware: true) on a simulated receipt: ok=${hwVerdict.ok}`);
log(`reasons = ${JSON.stringify(hwVerdict.reasons)}`);
try {
  new CooL({ applicationId: "x", attestation: { provider: "local" }, security: { requireAttestation: true } });
  log("ConfigurationError NOT thrown (unexpected)");
} catch (e) {
  log(`ConfigurationError thrown as documented: ${e.constructor.name}: ${e.message}`);
}

/* ── 11. error handling surface ──────────────────────────────────────── */
section("11. ERROR HANDLING");

const errCool = new CooL({ applicationId: "veriaudit" });
try {
  await errCool.record({ metadata: { x: 1 } });
} catch (e) {
  log(`record() with no type -> ${e.constructor.name}: ${e.message} (code=${e.code})`);
}
try {
  new CooL({ applicationId: "" });
} catch (e) {
  log(`empty applicationId -> ${e.constructor.name}: ${e.message}`);
}
await errCool.close();
try {
  await errCool.record({ type: "x" });
} catch (e) {
  log(`record() after close() -> ${e.constructor.name}: ${e.message}`);
}
const badVerdict = await verifyEvidence({ not: "a receipt" });
log(`verifyEvidence(garbage) did not throw; ok=${badVerdict.ok} reasons=${JSON.stringify(badVerdict.reasons)}`);
const nullVerdict = await verifyEvidence(null);
log(`verifyEvidence(null) ok=${nullVerdict.ok} reasons=${JSON.stringify(nullVerdict.reasons)}`);

/* ── 12. concurrency / throughput for the 3-month simulation ─────────── */
section("12. THROUGHPUT (3-MONTH SIMULATION BUDGET)");

const bulk = new CooL({ applicationId: "veriaudit" });
const tBulk = performance.now();
const N = 60;
await Promise.all(
  Array.from({ length: N }, (_, i) =>
    bulk.record({ type: "control.tested", executionId: `bulk-${i}`, metadata: { i } }),
  ),
);
const bulkMs = performance.now() - tBulk;
log(`${N} parallel records in ${bulkMs.toFixed(1)}ms (${(bulkMs / N).toFixed(1)}ms/record)`);
const tSeq = performance.now();
for (let i = 0; i < 10; i++) await bulk.record({ type: "control.tested", metadata: { i } });
log(`10 sequential records in ${(performance.now() - tSeq).toFixed(1)}ms`);
await bulk.close();
await cool.close();

/* ── 13. what the main entry point pulls in ──────────────────────────── */
section("13. RUNTIME SURFACE");
log(`process.version = ${process.version}`);
log(`globalThis.crypto present = ${typeof globalThis.crypto !== "undefined"}`);
log(`globalThis.crypto.getRandomValues = ${typeof globalThis.crypto?.getRandomValues}`);
const mod = await import("cool-nwc");
log(`cool-nwc exports (${Object.keys(mod).length}) = ${Object.keys(mod).sort().join(", ")}`);

section("DONE");
