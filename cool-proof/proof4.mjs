/**
 * The claim-boundary probe. This is the one that decides what VeriAudit is
 * allowed to say on screen.
 *
 * A receipt carries its OWN key_directory. So a forger who runs their own
 * evidence plane can produce a receipt that is internally perfect. The question
 * is what a verifier must pin to distinguish "authentic and unchanged" from
 * "authentic-looking and produced by somebody else".
 */
import { CooL, verifyEvidence, withTrustedKeys } from "cool-nwc";

const log = console.log;
const section = (t) => log(`\n=== ${t} ===`);
const domains = (v) => Object.entries(v.checks).map(([k, c]) => `${k}=${c.status}`).join(" ");
const SW = { name: "veriaudit-engine", version: "0.1.0", digest: null };

/* ── the genuine VeriAudit record ────────────────────────────────────── */
section("1. THE GENUINE RECORD");

process.env.COOL_IMAGE_DIGEST = "sha256:veriaudit-prod-v1";
const real = new CooL({ applicationId: "veriaudit" });
const genuine = await real.record({
  type: "finding.created",
  executionId: "exec-FIN-2026-09-hero",
  metadata: { finding_id: "F-001", exceptions: 3, severity: "high" },
  software: SW,
});
const realKeys = real.keyDirectory;
const realMeasurement = real.environment.measurement;
log(`key_id      = ${genuine.evidence.record.signature.key_id}`);
log(`mrtd        = ${realMeasurement.mrtd.slice(0, 28)}...`);
log(`verdict     = ok:${(await verifyEvidence(genuine.evidence)).ok}`);
log(`published key directory ids = ${Object.keys(realKeys).join(", ")}`);

/* ── the forgery: a different plane, a different story ───────────────── */
section("2. THE FORGERY — a whole different evidence plane");

process.env.COOL_IMAGE_DIGEST = "sha256:attacker-image";
const forger = new CooL({ applicationId: "veriaudit" });
const forged = await forger.record({
  type: "finding.created",
  executionId: "exec-FIN-2026-09-hero",
  metadata: { finding_id: "F-001", exceptions: 0, severity: "none" }, // the lie
  software: SW,
});
log(`forged key_id = ${forged.evidence.record.signature.key_id}`);
log(`forged mrtd   = ${forger.environment.measurement.mrtd.slice(0, 28)}...`);

const naive = await verifyEvidence(forged.evidence);
log(`\nNAIVE verifyEvidence(forgedReceipt):`);
log(`  ok=${naive.ok} | ${domains(naive)}`);
log(`  reasons=${JSON.stringify(naive.reasons)}`);
log(`  >>> A self-consistent receipt from ANY plane verifies ok. <<<`);

/* ── defence 1: pin the expected measurement ─────────────────────────── */
section("3. DEFENCE 1 — pin the measurement");

const pinnedGenuine = await verifyEvidence(genuine.evidence, { expectedMeasurement: realMeasurement });
const pinnedForged = await verifyEvidence(forged.evidence, { expectedMeasurement: realMeasurement });
log(`genuine, measurement pinned: ok=${pinnedGenuine.ok} | ${domains(pinnedGenuine)}`);
log(`forged,  measurement pinned: ok=${pinnedForged.ok} | ${domains(pinnedForged)}`);
log(`reasons=${JSON.stringify(pinnedForged.reasons)}`);

/* ── defence 2: pin the trusted key directory ────────────────────────── */
section("4. DEFENCE 2 — pin the trusted key directory (withTrustedKeys)");

log(`withTrustedKeys.length (arity) = ${withTrustedKeys.length}  // (receipt, trusted)`);

// Overriding the forger's own entry with the real published key.
const forgedUnderRealKeys = withTrustedKeys(forged.evidence, realKeys);
const vForgedPinned = await verifyEvidence(forgedUnderRealKeys);
log(`forged receipt re-keyed to VeriAudit's published keys:`);
log(`  ok=${vForgedPinned.ok} | ${domains(vForgedPinned)}`);
log(`  reasons=${JSON.stringify(vForgedPinned.reasons)}`);

const genuineUnderRealKeys = withTrustedKeys(genuine.evidence, realKeys);
const vGenuinePinned = await verifyEvidence(genuineUnderRealKeys);
log(`genuine receipt re-keyed to VeriAudit's published keys:`);
log(`  ok=${vGenuinePinned.ok} | ${domains(vGenuinePinned)}`);

log(`\nNOTE: withTrustedKeys merges by key_id. The forger used a DIFFERENT key_id,`);
log(`so the merge does not collide. The real check is the key_id allow-list:`);
const allow = new Set(Object.keys(realKeys));
log(`  genuine key_id in allow-list: ${allow.has(genuine.evidence.record.signature.key_id)}`);
log(`  forged  key_id in allow-list: ${allow.has(forged.evidence.record.signature.key_id)}`);

/* ── defence 3: the same key_id, attacker key material ───────────────── */
section("5. SAME key_id COLLISION — attacker key material under a trusted id");

const collide = JSON.parse(JSON.stringify(forged.evidence));
const realKeyId = genuine.evidence.record.signature.key_id;
const forgedKeyId = forged.evidence.record.signature.key_id;
collide.record.signature.key_id = realKeyId;
collide.key_directory[realKeyId] = forged.evidence.key_directory[forgedKeyId];
const vCollideNaive = await verifyEvidence(collide);
log(`forgery relabelled with the trusted key_id, naive verify: ok=${vCollideNaive.ok} | ${domains(vCollideNaive)}`);
log(`  reasons=${JSON.stringify(vCollideNaive.reasons)}`);
const vCollidePinned = await verifyEvidence(withTrustedKeys(collide, realKeys));
log(`same, but with the REAL key forced in under that id: ok=${vCollidePinned.ok} | ${domains(vCollidePinned)}`);
log(`  reasons=${JSON.stringify(vCollidePinned.reasons)}`);
log(`=> withTrustedKeys DOES defeat a same-id key substitution.`);

/* ── summary ─────────────────────────────────────────────────────────── */
section("6. WHAT VERIAUDIT MAY CLAIM");
log(`A bare verifyEvidence(receipt) establishes:`);
log(`  - the receipt is internally consistent and unmodified since sealing`);
log(`  - it was signed by the key it names, under a measurement it names`);
log(`  - it sits at a stated position in a log whose head it carries`);
log(`It does NOT establish:`);
log(`  - that VeriAudit's plane produced it  (needs key_id allow-list + withTrustedKeys)`);
log(`  - that any hardware protected it      (mode=simulated, attestation=simulated)`);
log(`  - that the audit conclusion is correct`);

delete process.env.COOL_IMAGE_DIGEST;
await real.close();
await forger.close();
section("DONE");
