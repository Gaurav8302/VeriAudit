// Browser probe: can the CooL client + verifier run client-side at all?
// The SDK's troubleshooting.md says browser/edge is "not currently tested".
// We test it, rather than guessing, because it decides the VeriAudit
// client/server boundary.
import { CooL, verifyEvidence } from "cool-nwc";

const out = [];
const log = (s) => { out.push(s); const p = document.getElementById("out"); if (p) p.textContent = out.join("\n"); console.log(s); };

window.__done = false;
window.__results = null;

(async () => {
  try {
    log(`crypto.getRandomValues: ${typeof globalThis.crypto?.getRandomValues}`);
    log(`crypto.subtle: ${typeof globalThis.crypto?.subtle}`);
    log(`process defined: ${typeof process !== "undefined"}`);

    const t0 = performance.now();
    const cool = new CooL({ applicationId: "veriaudit" });
    const res = await cool.record({
      type: "finding.created",
      executionId: "browser-exec-1",
      metadata: { finding_id: "F-001", exceptions: 3 },
      software: { name: "veriaudit-engine", version: "0.1.0", digest: null },
    });
    const recordMs = performance.now() - t0;
    log(`RECORD OK in ${recordMs.toFixed(0)}ms, recordId=${res.recordId}`);
    log(`mode=${res.evidence.record.runtime.mode} key_id=${res.evidence.record.signature.key_id}`);

    const t1 = performance.now();
    const v = await verifyEvidence(res.evidence);
    const verifyMs = performance.now() - t1;
    log(`VERIFY ok=${v.ok} in ${verifyMs.toFixed(1)}ms`);
    log(`domains: ${Object.entries(v.checks).map(([k, c]) => `${k}=${c.status}`).join(" ")}`);

    // tamper, in the browser
    const bad = JSON.parse(JSON.stringify(res.evidence));
    const h = bad.record.event.metadata_hash;
    bad.record.event.metadata_hash = h.slice(0, -1) + (h.slice(-1) === "0" ? "1" : "0");
    log(`tamper: ${h.slice(-12)} -> ${bad.record.event.metadata_hash.slice(-12)}`);
    const v2 = await verifyEvidence(bad);
    log(`TAMPERED ok=${v2.ok} reasons=${JSON.stringify(v2.reasons)}`);

    window.__results = {
      recordOk: true, recordMs, verifyOk: v.ok, verifyMs,
      tamperedOk: v2.ok, mode: res.evidence.record.runtime.mode,
    };
  } catch (e) {
    log(`FAILED: ${e.name}: ${e.message}`);
    log(e.stack ?? "");
    window.__results = { error: `${e.name}: ${e.message}` };
  } finally {
    window.__done = true;
  }
})();
