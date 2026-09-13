// Why does stripping inclusion+sth now fail CooL's own verdict?
// docs/COOL_SDK_AUDIT.md §6 recorded ok=true with zero reasons for this case.
import { verifyEvidence, MemoryLog, formatVerdict } from "cool-nwc";
import { CoolTee, SimulatedDstackClient, sealedKeyset } from "cool-nwc/phala";

const dstack = new SimulatedDstackClient({
  appName: "veriaudit",
  imageDigest: "sha256:veriaudit-r2-v1",
});
const keys = await sealedKeyset(dstack);
const log = new MemoryLog("veriaudit-log", keys.log);
const tee = await CoolTee.connect({
  app: { name: "veriaudit", imageDigest: "sha256:veriaudit-r2-v1" },
  dstack,
  log,
});

const receipt = await tee.record({
  type: "finding.created",
  executionId: "EXEC-1",
  metadata: { a: 1 },
  software: { name: "veriaudit-audit-engine", version: "0.1.0", digest: null },
});
await tee.close();

const clone = (v) => JSON.parse(JSON.stringify(v));

const variants = {
  "genuine": clone(receipt),
  "delete inclusion only": (() => { const r = clone(receipt); delete r.inclusion; return r; })(),
  "delete sth only": (() => { const r = clone(receipt); delete r.sth; return r; })(),
  "delete inclusion + sth": (() => {
    const r = clone(receipt); delete r.inclusion; delete r.sth; return r;
  })(),
  "inclusion + sth = null": (() => {
    const r = clone(receipt); r.inclusion = null; r.sth = null; return r;
  })(),
};

for (const [name, variant] of Object.entries(variants)) {
  const plain = await verifyEvidence(variant);
  const pinned = await verifyEvidence(variant, {
    expectedMeasurement: (await dstack.info()).measurement,
  });
  console.log(`\n=== ${name}`);
  console.log(`  no options      ok=${plain.ok} inclusion=${plain.checks.inclusion.status} reasons=${JSON.stringify(plain.reasons)}`);
  console.log(`  +expectedMeas.  ok=${pinned.ok} inclusion=${pinned.checks.inclusion.status} reasons=${JSON.stringify(pinned.reasons)}`);
  console.log(`  anchor=${plain.checks.anchor.status} witnesses=${plain.checks.witnesses.status} binding=${plain.checks.binding.status} signature=${plain.checks.signature.status}`);
}

console.log("\n=== receipt top-level keys");
console.log(Object.keys(receipt));
