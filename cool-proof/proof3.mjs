/**
 * Architecture probe: can VeriAudit hold ONE append-only transparency tree
 * that spans every audit event, across process restarts / serverless
 * invocations — using only exported cool-nwc APIs?
 *
 * This decides whether the `inclusion` domain means anything in VeriAudit
 * ("event 42 sits under a root that also covers events 1..41") or whether every
 * event is a lonely tree of size 1.
 */
import {
  MemoryLog,
  verifyEvidence,
  verifyConsistency,
  consistencyProof,
  verifyInclusion,
  leafHash,
  merkleRoot,
  multihashDigest,
  generateKeypair,
  withTrustedKeys,
} from "cool-nwc";
import {
  CoolTee,
  SimulatedDstackClient,
  sealedKeyset,
  recordLeafDataV2,
} from "cool-nwc/phala";

const log = console.log;
const section = (t) => log(`\n=== ${t} ===`);
const domains = (v) => Object.entries(v.checks).map(([k, c]) => `${k}=${c.status}`).join(" ");
const SW = { name: "veriaudit-engine", version: "0.1.0", digest: null };

/* ── 1. derive the sealed keys outside the plane ─────────────────────── */
section("1. SEALED KEYSET (derived from the measurement)");

const APP = { name: "veriaudit", imageDigest: "sha256:veriaudit-v1" };
const client = new SimulatedDstackClient({ appName: APP.name, imageDigest: APP.imageDigest });
const keys = await sealedKeyset(client);
log(`record key_id = ${keys.record.keyId}`);
log(`log    key_id = ${keys.log.keyId}`);

const client2 = new SimulatedDstackClient({ appName: APP.name, imageDigest: APP.imageDigest });
const keys2 = await sealedKeyset(client2);
log(`re-derived record key identical? ${JSON.stringify(keys.record.directoryEntry) === JSON.stringify(keys2.record.directoryEntry)}`);

const clientOther = new SimulatedDstackClient({ appName: APP.name, imageDigest: "sha256:veriaudit-v2" });
const keysOther = await sealedKeyset(clientOther);
log(`different imageDigest => key_id ${keysOther.record.keyId}, same pubkey? ${JSON.stringify(keysOther.record.directoryEntry) === JSON.stringify(keys.record.directoryEntry)}`);
log(`=> keys are a pure function of (imageDigest, appName): reproducible, no secret to store`);

/* ── 2. "request 1": a shared log across two planes ──────────────────── */
section("2. ONE LOG, MANY PLANES (same process)");

const shared = new MemoryLog("veriaudit-log", keys.log);
const teeA = await CoolTee.connect({ app: APP, dstack: client, log: shared });
const teeB = await CoolTee.connect({ app: APP, dstack: client, log: shared });

const r1 = await teeA.record({ type: "audit.started", executionId: "E1", metadata: { a: 1 }, software: SW });
const r2 = await teeB.record({ type: "finding.created", executionId: "E1", metadata: { a: 2 }, software: SW });
const r3 = await teeA.record({ type: "conclusion.created", executionId: "E1", metadata: { a: 3 }, software: SW });

for (const [label, r] of [["r1", r1], ["r2", r2], ["r3", r3]]) {
  const v = await verifyEvidence(r);
  log(`${label}: leaf=${r.inclusion.leaf_index} tree=${r.inclusion.tree_size} ok=${v.ok} ${domains(v)}`);
}
log(`shared.size = ${shared.size}  => a single tree spans both planes`);
await teeA.close();
await teeB.close();

/* ── 3. persist + rehydrate the log ("cold start") ───────────────────── */
section("3. REHYDRATE THE TREE FROM STORAGE (cold start)");

// What VeriAudit would persist: the ordered list of binding hashes. Nothing secret.
const persistedBindings = [r1.binding_hash, r2.binding_hash, r3.binding_hash];
log(`persisted ${persistedBindings.length} binding hashes (this is all the storage the log needs)`);
log(`  e.g. ${persistedBindings[0]}`);

// Cold start: rebuild the tree by replaying leaf data in order.
const rebuilt = new MemoryLog("veriaudit-log", keys.log);
for (const b of persistedBindings) rebuilt.append(recordLeafDataV2(b));
log(`rebuilt.size = ${rebuilt.size}`);
log(`rebuilt root == r3's sth root? ${rebuilt.rootHash() === r3.sth.root_hash}`);

const teeCold = await CoolTee.connect({ app: APP, dstack: client, log: rebuilt });
const r4 = await teeCold.record({ type: "human.review.completed", executionId: "E1", metadata: { a: 4 }, software: SW });
const v4 = await verifyEvidence(r4);
log(`post-cold-start record: leaf=${r4.inclusion.leaf_index} tree=${r4.inclusion.tree_size} ok=${v4.ok}`);
log(`=> the tree CONTINUED (leaf 3, tree 4) instead of restarting at leaf 0`);
log(`old receipt r1 still verifies: ${(await verifyEvidence(r1)).ok}`);

/* ── 4. append-only proof (consistency between two tree heads) ───────── */
section("4. APPEND-ONLY / CONSISTENCY PROOF");

const oldSth = r3.sth;          // tree_size 3, kept from "three months ago"
const newSth = r4.sth;          // tree_size 4, today

// The full current leaf-hash list, rebuilt from persisted binding hashes alone.
const allBindings = [...persistedBindings, r4.binding_hash];
const allLeafHashes = allBindings.map((b) => leafHash(recordLeafDataV2(b)));
log(`recomputed current root from storage: ${merkleRoot(allLeafHashes).length === 32}`);

const proof = consistencyProof(allLeafHashes, oldSth.tree_size);
log(`old tree head: size=${oldSth.tree_size} root=${oldSth.root_hash}`);
log(`new tree head: size=${newSth.tree_size} root=${newSth.root_hash}`);
log(`consistency proof length = ${proof.length}`);

// signature is verifyConsistency(m, n, firstRoot, secondRoot, proof)
const consistent = verifyConsistency(
  oldSth.tree_size,
  newSth.tree_size,
  multihashDigest(oldSth.root_hash),
  multihashDigest(newSth.root_hash),
  proof,
);
log(`verifyConsistency(m,n,firstRoot,secondRoot,proof) = ${consistent}`);
log(`=> "nothing was removed or reordered since then" is provable, not asserted`);

const badConsistent = verifyConsistency(
  oldSth.tree_size,
  newSth.tree_size,
  multihashDigest(`${oldSth.root_hash.slice(0, -1)}0`),
  multihashDigest(newSth.root_hash),
  proof,
);
log(`with a forged old root: ${badConsistent}`);

// What happens if an event is REMOVED from history (the real tamper demo)?
const censored = [persistedBindings[0], persistedBindings[2], r4.binding_hash];
const censoredLeaves = censored.map((b) => leafHash(recordLeafDataV2(b)));
const censoredConsistent = verifyConsistency(
  oldSth.tree_size,
  censoredLeaves.length,
  multihashDigest(oldSth.root_hash),
  multihashDigest(`mh:sha256:${Buffer.from(merkleRoot(censoredLeaves)).toString("hex")}`),
  consistencyProof(censoredLeaves, oldSth.tree_size),
);
log(`after DELETING event 2 from history, consistency = ${censoredConsistent}`);
log(`=> deleting an old event breaks the append-only proof`);

/* ── 5. raw inclusion check (what the UI can recompute itself) ───────── */
section("5. RAW INCLUSION RECOMPUTE");

const leafIdx = r2.inclusion.leaf_index;
const ok = verifyInclusion(
  leafHash(recordLeafDataV2(r2.binding_hash)),
  leafIdx,
  r2.inclusion.tree_size,
  r2.inclusion.audit_path.map(multihashDigest),
  multihashDigest(r2.sth.root_hash),
);
log(`verifyInclusion for leaf ${leafIdx} of tree ${r2.inclusion.tree_size} = ${ok}`);
log(`audit_path = ${JSON.stringify(r2.inclusion.audit_path)}`);

/* ── 6. withTrustedKeys — pinning a publisher ────────────────────────── */
section("6. withTrustedKeys (pinning the signer)");

log(`typeof withTrustedKeys = ${typeof withTrustedKeys}`);
const trusted = withTrustedKeys({ [keys.record.keyId]: keys.record.directoryEntry });
log(`withTrustedKeys(...) returned: ${JSON.stringify(Object.keys(trusted))}`);
const pinnedOk = await verifyEvidence(r2, trusted);
log(`verify with the REAL key pinned: ok=${pinnedOk.ok} ${domains(pinnedOk)}`);
const attacker = generateKeypair(keys.record.keyId, { seed: new Uint8Array(32).fill(9) });
const pinnedBad = await verifyEvidence(r2, withTrustedKeys({ [keys.record.keyId]: attacker.directoryEntry }));
log(`verify with a WRONG key pinned: ok=${pinnedBad.ok} ${domains(pinnedBad)}`);
log(`reasons: ${JSON.stringify(pinnedBad.reasons)}`);
log(`=> a verifier can refuse to trust the receipt's own carried key directory`);

/* ── 7. sanity: forged receipt signed by an attacker key ─────────────── */
section("7. FORGED RECEIPT (attacker re-signs their own edit)");

const forged = JSON.parse(JSON.stringify(r2));
forged.record.event.metadata_hash = forged.record.event.metadata_hash.slice(0, -1) + "0";
// attacker replaces the whole key directory with their own key under the same id
forged.key_directory = { [forged.record.signature.key_id]: attacker.directoryEntry };
const forgedVerdict = await verifyEvidence(forged);
log(`self-consistent forgery, verified naively: ok=${forgedVerdict.ok} ${domains(forgedVerdict)}`);
log(`reasons: ${JSON.stringify(forgedVerdict.reasons)}`);
log(`=> note WHICH domains catch it; this is the honest claim boundary`);

await teeCold.close();
section("DONE");
