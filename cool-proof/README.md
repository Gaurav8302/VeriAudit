# CooL SDK proof harnesses

Reproducible evidence for the findings in [`../docs/COOL_SDK_AUDIT.md`](../docs/COOL_SDK_AUDIT.md).

These are **not** application code. They exist to establish what `cool-nwc@3.0.0`
actually does before VeriAudit was designed around it, per
`VeriAudit_CURSOR_BUILD_GUIDELINE.md` §0.

```sh
cd cool-proof
npm install
node proof.mjs
node proof2.mjs
node proof3.mjs
node proof4.mjs
```

Captured output from the original run is committed alongside each script
(`proof-output.txt` … `proof4-output.txt`), so the documented findings can be
checked without re-running anything.

## What each harness establishes

| Harness | Establishes |
|---|---|
| `proof.mjs` | record → verify round trip; the returned `EvidenceResult` shape; that receipts leak no raw input; JSON round-trip survival; receipts are **not** byte-reproducible; cross-instance and standalone verification; error handling; throughput |
| `proof2.mjs` | the `software.digest` requirement; an 18-case tamper matrix with per-domain results; the receipt size budget; the exported surface of every subpath; log behaviour across client instances |
| `proof3.mjs` | that sealed keys are a pure function of `(appName, imageDigest)`; that one transparency tree can span many planes; that a tree **rehydrates from stored binding hashes** and continues growing; RFC 6962 consistency proofs, including that deleting a historical event breaks them |
| `proof4.mjs` | the claim boundary — that a receipt from any evidence plane verifies `ok: true`, and that `expectedMeasurement` pinning plus a `key_id` allow-list plus `withTrustedKeys` are what distinguish "authentic" from "ours" |

### Milestone 1 probes

Written during implementation, each to settle one question the code raised.
These import the app's own adapter, so run them from the repo root.

| Harness | Establishes |
|---|---|
| `probe-inclusion.mjs` | that `inclusion = null` and `delete inclusion` are **different** outcomes: `null` passes CooL's verdict with zero reasons, a missing key fails structural validation. Refines `COOL_SDK_AUDIT.md` §6 case 16 |
| `probe-drift.mjs` | that `recordEvents` refuses to seal anything when the live plane does not match the committed identity pin, naming the differing registers and the unrecognised key id |

### Milestone 1 deployment proof

`scripts/proof-http.ts` runs 29 assertions against any base URL. Captured
output from the run that closed the Vercel gate:

| File | Result |
|---|---|
| `milestone1-local.txt` | 29/29 against `next build && next start`, Node v22.17.0 |
| `milestone1-vercel.txt` | 29/29 against `https://veriaudit-alpha.vercel.app`, Node v24.19.0, region `iad1` |

The "MUST BE IDENTICAL" blocks in the two files are byte-equal. The root hash
differs between *any* two runs, including two local ones — `randomSalt()` draws
fresh bytes per record, so the same nine events build a different tree each
time. The harness separates that from the values that must match.

## Expected non-obvious results

Two things look like failures and are not:

1. **`proof.mjs` section 3 reports `ok: false`.** This is the harness catching a
   real SDK gotcha: it passes `software: { name, version }` without a `digest`
   key, which produces a receipt the verifier rejects at structural validation
   (`record.event.software.digest: expected a non-empty string`). Root cause and
   the accepted forms are in `COOL_SDK_AUDIT.md` §7.1. `proof2.mjs` section A
   demonstrates the fix.

2. **`attestation` and `enclave` always read `simulated`, never `pass`.** No TEE
   is available, and the SDK is deliberate about never reporting a
   hardware-dependent domain as passing without hardware. `requireHardware: true`
   correctly makes such receipts `ok: false`.

## Browser probe

`browser/` verifies that the SDK's core client and verifier run client-side,
which the vendor's own `troubleshooting.md` lists as untested:

```sh
npx esbuild browser/entry.mjs --bundle --format=esm --outfile=browser/bundle.js --target=es2022
node serve.mjs        # http://localhost:4321
```

Result in Chromium: record 162 ms, verify 22 ms, tamper correctly rejected,
230 KB bundle, with `process` undefined. `bundle.js` is generated and
git-ignored.
