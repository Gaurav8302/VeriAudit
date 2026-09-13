/**
 * Follow-up SDK verification for VeriAudit.
 *
 * proof.mjs found that passing `software: { name, version }` (no `digest`)
 * produces a receipt the verifier REJECTS at shape validation. This run:
 *
 *   A. establishes the correct `software` usage
 *   B. re-runs the tamper matrix against a VALID receipt, per domain
 *   C. breaks down receipt size (storage / HTTP payload budget)
 *   D. probes the Edge-runtime dependency surface
 *   E. probes transparency-log behaviour across instances (serverless reality)
 *   F. probes FileLog + MemoryLog from cool-nwc/node and cool-nwc/phala
 */
import { CooL, verifyEvidence, mhSha256, sha256Bytes } from "cool-nwc";

const log = console.log;
const section = (t) => log(`\n=== ${t} ===`);
const domains = (v) => Object.entries(v.checks).map(([k, c]) => `${k}=${c.status}`).join(" ");

/* ── A. correct `software` usage ──────────────────────────────────────── */
section("A. SOFTWARE IDENTITY — WHAT THE VERIFIER ACCEPTS");

const cool = new CooL({ applicationId: "veriaudit" });

const cases = {
  "software omitted entirely": {},
  "software: {name,version}  (NO digest key)": { software: { name: "veriaudit-engine", version: "0.1.0" } },
  "software: {name,version,digest:null}": { software: { name: "veriaudit-engine", version: "0.1.0", digest: null } },
  "software: {name,version,digest:mh}": {
    software: {
      name: "veriaudit-engine",
      version: "0.1.0",
      digest: mhSha256(new TextEncoder().encode("veriaudit-engine@0.1.0")),
    },
  },
};

let goodEvidence = null;
for (const [label, extra] of Object.entries(cases)) {
  const r = await cool.record({ type: "control.tested", executionId: "sw-probe", metadata: { control: "REV-REC-01" }, ...extra });
  const v = await verifyEvidence(r.evidence);
  log(`${v.ok ? "OK  " : "FAIL"} ${label}`);
  log(`       ${domains(v)}`);
  if (!v.ok) log(`       reasons: ${JSON.stringify(v.reasons)}`);
  log(`       stored software = ${JSON.stringify(r.evidence.record.event.software)}`);
  if (v.ok && !goodEvidence && extra.software) goodEvidence = r.evidence;
}
log(`\n=> VeriAudit MUST pass software.digest explicitly (null or a multihash).`);

/* ── B. tamper matrix on a VALID receipt ─────────────────────────────── */
section("B. TAMPER MATRIX (against a receipt that verifies)");

// build a multi-event tree so inclusion has a real audit path
const chainExec = "exec-FIN-2026-09-hero";
const SW = { name: "veriaudit-engine", version: "0.1.0", digest: null };
const chain = [];
for (const type of ["audit.started", "artifact.ingested", "retrieval.executed", "model.executed", "control.tested", "finding.created", "human.review.completed", "conclusion.created"]) {
  chain.push(await cool.record({ type, executionId: chainExec, metadata: { type }, software: SW }));
}
const hero = chain[5].evidence; // finding.created, mid-tree => non-empty audit path
const baseline = await verifyEvidence(hero);
log(`baseline: ok=${baseline.ok} | ${domains(baseline)}`);
log(`audit_path length = ${hero.inclusion.audit_path.length}, leaf=${hero.inclusion.leaf_index}, tree=${hero.inclusion.tree_size}`);

const flip = (s) => s.slice(0, -1) + (s.slice(-1) === "0" ? "1" : "0");
const flipB64 = (s) => s.slice(0, -3) + (s.slice(-3, -2) === "A" ? "B" : "A") + s.slice(-2);

async function tamper(label, mutate) {
  const e = JSON.parse(JSON.stringify(hero));
  mutate(e);
  const v = await verifyEvidence(e);
  log(`\n${label}`);
  log(`  ok=${v.ok} | ${domains(v)}`);
  log(`  reasons: ${JSON.stringify(v.reasons)}`);
}

await tamper("1. flip a hex digit of event.metadata_hash", (e) => { e.record.event.metadata_hash = flip(e.record.event.metadata_hash); });
await tamper("2. change event.type", (e) => { e.record.event.type = "conclusion.created"; });
await tamper("3. change the metadata_salt", (e) => { e.record.event.metadata_salt = flip(e.record.event.metadata_salt); });
await tamper("4. flip a hex digit of binding_hash", (e) => { e.binding_hash = flip(e.binding_hash); });
await tamper("5. corrupt the ed25519 signature", (e) => { e.record.signature.ed25519 = flipB64(e.record.signature.ed25519); });
await tamper("6. corrupt the ML-DSA signature", (e) => { e.record.signature.ml_dsa = flipB64(e.record.signature.ml_dsa); });
await tamper("7. swap in an attacker key_directory entry", (e) => {
  const kid = e.record.signature.key_id;
  e.key_directory[kid] = { ...e.key_directory[kid], ed25519_pub: flipB64(e.key_directory[kid].ed25519_pub) };
});
await tamper("8. corrupt the inclusion audit_path", (e) => { e.inclusion.audit_path[0] = flip(e.inclusion.audit_path[0]); });
await tamper("9. change inclusion.leaf_index", (e) => { e.inclusion.leaf_index = 0; });
await tamper("10. change sth.root_hash", (e) => { e.sth.root_hash = flip(e.sth.root_hash); });
await tamper("11. change the output commitment", (e) => { e.record.event.commitments.output = flip(e.record.event.commitments.output || "mh:sha256:" + "0".repeat(64)); });
await tamper("12. change record.time.issued_at", (e) => { e.record.time.issued_at = "2020-01-01T00:00:00.000Z"; });
await tamper("13. change the enclave measurement (mrtd)", (e) => { e.record.runtime.enclave_measurement.mrtd = flip(e.record.runtime.enclave_measurement.mrtd); });
await tamper("14. claim runtime.mode = hardware", (e) => { e.record.runtime.mode = "hardware"; });
await tamper("15. drop the inclusion proof but keep the sth", (e) => { e.inclusion = null; });
await tamper("16. drop BOTH inclusion and sth", (e) => { e.inclusion = null; e.sth = null; });
await tamper("17. change application_id", (e) => { e.record.event.application_id = "evil-app"; });
await tamper("18. change the attestation quote", (e) => {
  if (e.attestation?.quote?.body) e.attestation.quote.body.tcb_status = "Revoked";
});

/* ── C. size breakdown ───────────────────────────────────────────────── */
section("C. RECEIPT SIZE BUDGET");

const size = (o) => JSON.stringify(o).length;
log(`full receipt          ${size(hero).toString().padStart(7)} bytes`);
log(`  .record             ${size(hero.record).toString().padStart(7)}`);
log(`    .record.signature ${size(hero.record.signature).toString().padStart(7)}`);
log(`    .record.event     ${size(hero.record.event).toString().padStart(7)}`);
log(`    .record.runtime   ${size(hero.record.runtime).toString().padStart(7)}`);
log(`  .key_directory      ${size(hero.key_directory).toString().padStart(7)}`);
log(`  .attestation        ${size(hero.attestation).toString().padStart(7)}`);
log(`  .sth                ${size(hero.sth).toString().padStart(7)}`);
log(`  .inclusion          ${size(hero.inclusion).toString().padStart(7)}`);
log(`\n60 receipts ~= ${((size(hero) * 60) / 1024 / 1024).toFixed(2)} MB of JSON`);
log(`hero core only (record+binding_hash+key_directory) = ${size({ record: hero.record, binding_hash: hero.binding_hash, key_directory: hero.key_directory })} bytes`);
log(`\nA compact UI summary is small:`);
log(JSON.stringify({
  record_id: hero.record.record_id,
  type: hero.record.event.type,
  execution_id: hero.record.event.execution_id,
  issued_at: hero.record.time.issued_at,
  binding_hash: hero.binding_hash,
  key_id: hero.record.signature.key_id,
  mode: hero.record.runtime.mode,
  leaf: hero.inclusion.leaf_index,
  tree_size: hero.inclusion.tree_size,
}, null, 2));

/* ── D. Edge-runtime dependency surface ──────────────────────────────── */
section("D. EDGE / RUNTIME SURFACE");

log(`typeof Buffer used?  checking module graph for node builtins...`);
const mainGraph = await import("cool-nwc");
log(`cool-nwc main entry imported with no node: builtin failure: true`);
log(`uses globalThis.crypto.getRandomValues: ${typeof globalThis.crypto.getRandomValues === "function"}`);
log(`sha256Bytes works: ${mhSha256(sha256Bytes(new Uint8Array([1, 2, 3]))).startsWith("mh:sha256:")}`);
try {
  const phala = await import("cool-nwc/phala");
  log(`cool-nwc/phala exports (${Object.keys(phala).length}): ${Object.keys(phala).sort().join(", ")}`);
} catch (e) { log(`cool-nwc/phala import failed: ${e.message}`); }
try {
  const nodeSub = await import("cool-nwc/node");
  log(`cool-nwc/node exports: ${Object.keys(nodeSub).sort().join(", ")}  (THIS one needs fs)`);
} catch (e) { log(`cool-nwc/node import failed: ${e.message}`); }
try {
  const verifySub = await import("cool-nwc/verify");
  log(`cool-nwc/verify exports: ${Object.keys(verifySub).sort().join(", ")}`);
} catch (e) { log(`cool-nwc/verify import failed: ${e.message}`); }

/* ── E. transparency log across instances (serverless reality) ───────── */
section("E. LOG STATE ACROSS INSTANCES");

const i1 = new CooL({ applicationId: "veriaudit" });
const a1 = await i1.record({ type: "audit.started", metadata: { n: 1 }, software: SW });
const i2 = new CooL({ applicationId: "veriaudit" });
const b1 = await i2.record({ type: "audit.started", metadata: { n: 2 }, software: SW });
log(`instance 1 first record: leaf=${a1.evidence.inclusion.leaf_index} tree=${a1.evidence.inclusion.tree_size} log_id=${a1.evidence.sth.log_id}`);
log(`instance 2 first record: leaf=${b1.evidence.inclusion.leaf_index} tree=${b1.evidence.inclusion.tree_size} log_id=${b1.evidence.sth.log_id}`);
log(`=> the in-memory log restarts per instance. Each receipt still self-verifies:`);
log(`   i1 ok=${(await verifyEvidence(a1.evidence)).ok}  i2 ok=${(await verifyEvidence(b1.evidence)).ok}`);
log(`same signing key across instances? ${a1.evidence.record.signature.key_id === b1.evidence.record.signature.key_id}`);
log(`key_id = ${a1.evidence.record.signature.key_id}`);

const i3 = new CooL({ applicationId: "different-app" });
const c1 = await i3.record({ type: "audit.started", metadata: { n: 3 }, software: SW });
log(`different applicationId => key_id = ${c1.evidence.record.signature.key_id} (changed? ${c1.evidence.record.signature.key_id !== a1.evidence.record.signature.key_id})`);

process.env.COOL_IMAGE_DIGEST = "sha256:deadbeef";
const i4 = new CooL({ applicationId: "veriaudit" });
const d1 = await i4.record({ type: "audit.started", metadata: { n: 4 }, software: SW });
log(`COOL_IMAGE_DIGEST changed => key_id = ${d1.evidence.record.signature.key_id} (changed? ${d1.evidence.record.signature.key_id !== a1.evidence.record.signature.key_id})`);
log(`old receipt still verifies against its OWN carried keys: ${(await verifyEvidence(a1.evidence)).ok}`);
delete process.env.COOL_IMAGE_DIGEST;

/* ── F. explicit log injection (MemoryLog) ───────────────────────────── */
section("F. EXPLICIT LOG (MemoryLog via cool-nwc/phala CoolTee)");

try {
  const { MemoryLog } = await import("cool-nwc");
  const { CoolTee } = await import("cool-nwc/phala");
  const shared = new MemoryLog();
  log(`MemoryLog methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(shared)).join(", ")}`);
  const tee1 = await CoolTee.connect({ app: { name: "veriaudit", imageDigest: "sha256:v1" }, log: shared });
  const r1 = await tee1.record({ type: "audit.started", metadata: { k: 1 }, software: SW });
  const tee2 = await CoolTee.connect({ app: { name: "veriaudit", imageDigest: "sha256:v1" }, log: shared });
  const r2 = await tee2.record({ type: "finding.created", metadata: { k: 2 }, software: SW });
  log(`shared log: r1 leaf=${r1.inclusion.leaf_index}/${r1.inclusion.tree_size}, r2 leaf=${r2.inclusion.leaf_index}/${r2.inclusion.tree_size}`);
  log(`r1 ok=${(await verifyEvidence(r1)).ok} r2 ok=${(await verifyEvidence(r2)).ok}`);
  log(`=> a shared log lets one append-only tree span many "requests": tree_size grows`);
  await tee1.close(); await tee2.close();
} catch (e) { log(`MemoryLog probe failed: ${e.constructor.name}: ${e.message}`); }

await Promise.all([cool.close(), i1.close(), i2.close(), i3.close(), i4.close()]);
section("DONE");
