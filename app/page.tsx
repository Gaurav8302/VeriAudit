"use client";

/**
 * Developer-facing proof page for Milestone 1. Deliberately unstyled.
 *
 * It exists to drive the three routes and show the verdict breakdown a judge
 * would otherwise have to read out of curl output. The product UI is Milestone
 * 3 — no dashboards, cards, or animations here on purpose.
 */
import { useCallback, useState } from "react";

type Json = Record<string, any>;

const BUTTON =
  "border border-neutral-700 px-3 py-1.5 text-left hover:border-neutral-400 disabled:opacity-40";

export default function ProofPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<Json | null>(null);
  const [label, setLabel] = useState<string>("");
  const [recorded, setRecorded] = useState<Json | null>(null);

  const call = useCallback(
    async (name: string, path: string, init?: RequestInit) => {
      setBusy(name);
      setLabel(name);
      try {
        const response = await fetch(path, init);
        const json = (await response.json()) as Json;
        setOutput(json);
        return json;
      } catch (error) {
        setOutput({ error: (error as Error).message });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const post = (path: string, body: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const doRecord = async () => {
    const json = await call("record (9 events)", "/api/cool/record", post("", { useSample: true }));
    if (json?.recorded) setRecorded(json);
  };

  const firstReceipt = recorded?.recorded?.[6]?.receipt ?? recorded?.recorded?.[0]?.receipt;

  const doVerify = () =>
    call("verify (genuine)", "/api/cool/verify", post("", { receipt: firstReceipt }));

  const doTamper = () => {
    const bad = JSON.parse(JSON.stringify(firstReceipt));
    const h: string = bad.binding_hash;
    bad.binding_hash = h.slice(0, -1) + (h.slice(-1) === "0" ? "1" : "0");
    return call("verify (tampered binding hash)", "/api/cool/verify", post("", { receipt: bad }));
  };

  const doStripInclusion = () => {
    const bad = JSON.parse(JSON.stringify(firstReceipt));
    delete bad.inclusion;
    delete bad.sth;
    return call("verify (inclusion stripped)", "/api/cool/verify", post("", { receipt: bad }));
  };

  const verdict = output && "ok" in output ? (output.ok ? "VERIFIED" : "FAILED") : null;

  return (
    <main className="mx-auto max-w-4xl p-6 text-sm">
      <h1 className="text-base font-bold">VeriAudit — Milestone 1: CooL production proof</h1>
      <p className="mt-2 max-w-2xl text-neutral-400">
        Records the nine canonical events of one execution into a shared append-only tree with
        cool-nwc@3.0.0, then verifies the receipts. VERIFIED means the evidence is authentic and
        unaltered. It does not mean the AI&apos;s conclusion was correct, and this build is not
        hardware-attested.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button className={BUTTON} onClick={() => call("identity", "/api/cool/identity")} disabled={busy !== null}>
          1. identity
        </button>
        <button className={BUTTON} onClick={doRecord} disabled={busy !== null}>
          2. record 9 events
        </button>
        <button className={BUTTON} onClick={doVerify} disabled={busy !== null || !firstReceipt}>
          3. verify genuine
        </button>
        <button className={BUTTON} onClick={doTamper} disabled={busy !== null || !firstReceipt}>
          4. verify tampered
        </button>
        <button className={BUTTON} onClick={doStripInclusion} disabled={busy !== null || !firstReceipt}>
          5. verify without inclusion
        </button>
        <button className={BUTTON} onClick={() => call("selftest", "/api/cool/selftest")} disabled={busy !== null}>
          6. full self-test
        </button>
      </div>

      {busy && <p className="mt-4 text-yellow-500">running {busy}…</p>}

      {output && (
        <section className="mt-5">
          <h2 className="font-bold">{label}</h2>

          {verdict && (
            <p className={`mt-1 font-bold ${output.ok ? "text-green-500" : "text-red-500"}`}>
              {verdict}
            </p>
          )}
          {verdict && (
            <ul className="mt-2 text-neutral-300">
              {(
                [
                  ["CooL verdict", output.verdictOk],
                  ["trusted signer", output.signerTrusted],
                  ["measurement matches pin", output.measurementMatches],
                  ["inclusion === pass", output.logged],
                ] as const
              ).map(([name, value]) => (
                <li key={name}>
                  {value ? "PASS" : "FAIL"} — {name}
                </li>
              ))}
              {/* Not a check that can fail: there is no TEE here, so the
                  attestation and enclave domains read `simulated` by design.
                  Labelling it FAIL would imply a problem; labelling it PASS
                  would be a lie. */}
              <li className="text-neutral-500">
                {output.hardware ? "PASS" : "n/a"} — hardware root of trust (
                {output.hardware ? "attested" : "simulated, not claimed"})
              </li>
            </ul>
          )}
          {Array.isArray(output.failures) && output.failures.length > 0 && (
            <ul className="mt-2 text-red-400">
              {output.failures.map((f: Json, i: number) => (
                <li key={i}>
                  {f.check}: {f.reason}
                </li>
              ))}
            </ul>
          )}
          {"pass" in output && (
            <p className={`mt-1 font-bold ${output.pass ? "text-green-500" : "text-red-500"}`}>
              self-test {output.pass ? "PASS" : "FAIL"}
            </p>
          )}

          <pre className="mt-3 max-h-[28rem] overflow-auto border border-neutral-800 p-3 text-xs text-neutral-400">
            {JSON.stringify(output, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
