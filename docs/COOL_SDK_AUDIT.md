# CooL SDK Audit

**Status of this document:** results of an actual investigation. Every line is
tagged `CONFIRMED`, `INFERRED`, `TODO`, or `UNKNOWN`. Nothing here is assumed
because it "sounds like something CooL should support".

Reproduce everything below with the harnesses in `cool-proof/`:

```sh
cd cool-proof
npm install
node proof.mjs    # record, verify, JSON round-trip, determinism, throughput
node proof2.mjs   # software identity, 18-case tamper matrix, size budget, subpaths
node proof3.mjs   # shared/rehydrated transparency log, consistency proofs
node proof4.mjs   # the claim boundary: forgery, measurement pinning, key pinning
```

Raw captured output is in `cool-proof/proof-output.txt` … `proof4-output.txt`.

---

## 1. Package

| | |
|---|---|
| Name | `cool-nwc` |
| Version installed & tested | **3.0.0** |
| npm `latest` dist-tag | **3.0.0** |
| License | Apache-2.0 |
| Author | Northwind Cipher Pvt. Ltd. |
| Upstream repo | `https://github.com/Northwind-Cipher/cool-sdk` |
| Local clone in this workspace | `cool-sdk/` @ `0eaf985` (no release tag) |
| Module format | **ESM only** — no CommonJS build, `require()` will not work |
| `engines.node` | `>=20` (tested here on Node v22.17.0) |
| Runtime deps | `@noble/curves`, `@noble/hashes`, `@noble/post-quantum`, `cbor2`, `ulid` |
| Native code / postinstall | **none** |

`CONFIRMED` — `npm view cool-nwc version` returns `3.0.0`; `npm install cool-nwc`
in a clean directory added 6 packages in ~4s with 0 vulnerabilities and no
compilation step.

### Installation

```sh
npm install cool-nwc
```

`CONFIRMED`. The consuming project must be ESM (`"type": "module"`, or a bundler
like Next.js). TypeScript should use `moduleResolution: "bundler"` or
`"nodenext"`.

### Local clone vs npm

`CONFIRMED` — the clone in `cool-sdk/` is the same code as the published package
(`src/` is shipped in `files`). **Decision:** VeriAudit consumes `cool-nwc` from
npm. The clone stays as a local read-only reference and is git-ignored, because
it is a separate upstream repository with its own `.git`.

---

## 2. Entry points

| Subpath | Exports | Needs `node:*` |
|---|---|---|
| `cool-nwc` | 35 exports: `CooL`, `verifyEvidence`, `formatVerdict`, `withTrustedKeys`, `MemoryLog`, crypto primitives, error classes | **No** |
| `cool-nwc/verify` | `verifyEvidence`, `formatVerdict`, `domainOrder`, `withTrustedKeys` | No |
| `cool-nwc/phala` | 77 advanced exports (`CoolTee`, `SimulatedDstackClient`, `sealedKeyset`, `recordLeafDataV2`, `disclose`, `validateReceiptV2Shape`, …) | No |
| `cool-nwc/node` | `FileLog`, `isSocketPath`, `transportFor`, `unixFetch` | **Yes** (`node:fs`, `node:http`, `node:path`) |
| `cool-nwc/cli` | the `cool` binary | Yes |

`CONFIRMED` by static module-graph resolution: the `cool-nwc` main entry reaches
**27 files / ~151 KB of source and imports zero `node:` builtins**. Node builtins
appear only in `cli/*`, `node.js`, `phala/log-file.js`, and `phala/unix.js`.

---

## 3. API surface

Only APIs confirmed from the installed source and from a passing local run are
listed. `CONFIRMED` unless noted.

### `new CooL(options?)`

**Purpose** — construct the client. **Does no I/O.** (Measured: 0.0 ms.)

**Input** (`CooLOptions`, all optional):

| Option | Type | Notes |
|---|---|---|
| `applicationId` | `string` | default `"cool-app"`; empty string throws `ConfigurationError` |
| `attestation.provider` | `"local" \| "dstack"` | default `"local"` (the simulator) |
| `attestation.endpoint` | `string` | dstack socket or `http://` URL; falls back to `$COOL_DSTACK_ENDPOINT`, then `/var/run/dstack.sock` |
| `attestation.vendor` | `"none" \| "intel-tdx" \| "amd-sev-snp" \| "nvidia-cc"` | default `intel-tdx` |
| `security.requireAttestation` | `boolean` | with `provider: "local"` → throws at construction |
| `security.expectedMeasurement` | `Measurement` | pins the approved image |
| `security.requireVendor` | `TeeVendor[]` | |
| `logId` | `string` | recorded in every STH; default `"cool-nwc"` |
| `onEvidence` | `(e: Evidence) => void` | called per sealed record |
| `onDrop` | `(reason: string) => void` | async queue overflow |
| `dstackClient`, `clock`, `newId`, `seq` | injectables | for tests / deterministic vectors |

**Errors** — `ConfigurationError` (empty `applicationId`; `requireAttestation` +
`provider: "local"`).

**Runtime requirements** — none at construction.

### `cool.ready()`

**Purpose** — force the connection (read measurement → derive sealed key →
RA-TLS handshake). Optional; `record()` does it lazily.

**Output** — `Promise<void>`. **Measured cost: ~102 ms** (two ML-DSA-65 keygens
plus a quote). This is the cold-start cost.

**Errors** — `DstackUnavailableError` (provider `dstack`, nothing listening),
`AttestationRequiredError`, `ClosedError`.

### `cool.record(input)`

**Purpose** — seal one execution-evidence event.

**Input** (`RecordInput`):

| Field | Type | Notes |
|---|---|---|
| `type` | `string` **required** | dotted, e.g. `finding.created` |
| `executionId` | `string?` | defaults to a fresh ULID — **always pass it** to group a trail |
| `metadata` | `unknown?` | JSON-serialisable; committed as a salted hash, never stored raw |
| `payloads` | `{ input?, output?, state? }` | strings/bytes; committed and discarded |
| `software` | `{ name, version, digest }` | **see the gotcha in §7** |
| `gpu` | `GpuAttestationRef?` | not used by VeriAudit |

**Output** (`EvidenceResult`): `{ evidence, recordId, executionId, digest }`
where `recordId` is a ULID, `digest` is the binding multihash, and `evidence` is
a `cool.receipt.v2` envelope.

**Errors** — `EvidenceError` (missing/empty `type`; sealing failure),
`ClosedError` (after `close()`).

**Measured cost** — ~17 ms/record sequential; ~11.6 ms/record over 60 parallel
records; 8-event chain in 136 ms.

### `verifyEvidence(evidence, options?)` / `cool.verify(...)`

**Purpose** — independent verification. **Never throws**; malformed or tampered
input comes back as a verdict with failed domains and `reasons`. `CONFIRMED` —
`verifyEvidence(null)` and `verifyEvidence({not:"a receipt"})` both returned a
structured `ok: false`.

**Input** — anything (`unknown`), plus options:

| Option | Effect | Confirmed |
|---|---|---|
| `expectedMeasurement` | pins the image; mismatch fails `enclave` | **CONFIRMED** (proof4 §3) |
| `requireHardware` | a non-hardware receipt cannot be `ok` | **CONFIRMED** (proof §10) |
| `witnessThreshold` | minimum independent co-signatures | `UNKNOWN` — no external witnesses exist in this build |
| `quoteVerifier` | chains a hardware quote to Intel DCAP / AMD KDS / NVIDIA NRAS | `UNKNOWN` — requires real hardware |
| `blockHeaders` | confirms a Bitcoin anchor | `UNKNOWN` — no anchor produced in this build |

**Output** (`Verdict`): `{ ok, schema, subject, checks, reasons }` over seven
domains: `binding`, `signature`, `inclusion`, `witnesses`, `attestation`,
`enclave`, `anchor`. Each check is `{ status, detail }` with `status ∈ pass |
fail | absent | mock | simulated | pending`.

**Measured cost** — 1 ms in Node, 22 ms in a browser.

### Other confirmed exports VeriAudit will use

| API | Purpose | Confirmed behaviour |
|---|---|---|
| `formatVerdict(verdict)` | ASCII verdict block | renders a 60-char boxed report |
| `withTrustedKeys(receipt, trusted)` | returns a **new receipt** with `trusted` merged **over** the embedded `key_directory` | **arity 2** — it is not a verify-options helper |
| `saltedCommit(salt, data)` | recompute `mh:sha256(salt ‖ data)` | matches the receipt's commitment for the true plaintext, differs for an altered one |
| `randomSalt()` | 16-byte `hex:` salt | |
| `mhSha256`, `sha256Bytes`, `multihashDigest` | digests | |
| `leafHash`, `merkleRoot`, `inclusionProof`, `verifyInclusion`, `consistencyProof`, `verifyConsistency` | RFC 6962 primitives | `verifyConsistency(m, n, firstRoot, secondRoot, proof)` — **note the argument order**; unlike `verifyEvidence` it **can throw** on bad input |
| `MemoryLog(logId, logKey)` | in-memory RFC 6962 log | **two required constructor args** |
| `generateKeypair(keyId, { seed })` | deterministic hybrid keypair | |
| Error classes | `CooLError`, `ConfigurationError`, `DstackUnavailableError`, `AttestationRequiredError`, `AttestationError`, `EvidenceError`, `ClosedError` | carry a `.code`, e.g. `COOL_EVIDENCE_INVALID` |

From `cool-nwc/phala`, VeriAudit will use `sealedKeyset(client)`,
`SimulatedDstackClient`, `CoolTee`, and `recordLeafDataV2(bindingHash)`.

### Client accessors (all throw until connected)

`cool.environment`, `cool.attestation`, `cool.keyDirectory`, `cool.evidence`
(last ≤500 receipts in memory), `cool.flush()`, `cool.close()`.

---

## 4. Minimal working proof

`CONFIRMED`. A VeriAudit-shaped event, sealed and verified for real:

```js
const cool = new CooL({ applicationId: "veriaudit" });
const { evidence, recordId, digest } = await cool.record({
  type: "finding.created",
  executionId: "exec-FIN-2026-09-001",
  metadata: { audit_id: "AUD-FIN-2026-09", finding_id: "F-001",
              control: "REV-REC-01", severity: "high", exceptions: 3 },
  payloads: { input: JSON.stringify({ ledger_rows: 412 }),
              output: JSON.stringify({ conclusion: "…" }) },
  software: { name: "veriaudit-audit-engine", version: "0.1.0", digest: null },
});
const verdict = await verifyEvidence(evidence);
```

Actual returned values:

```text
recordId        01M2CXYGCF3GZPKSD8G8V93R7V        (ULID)
executionId     exec-FIN-2026-09-001              (echoed back)
digest          mh:sha256:55f0869d7ad6ed1c…       (binding commitment)
evidence.schema cool.receipt.v2
signature.alg   ml-dsa-65+ed25519
runtime         { tee_vendor: "intel-tdx", mode: "simulated",
                  enclave_measurement: {mrtd, rtmr0..3}, tee_quote: "mh:sha256:…" }
inclusion       { leaf_index: 0, tree_size: 1, audit_path: [] }
sth             { log_id: "cool-nwc", tree_size: 1, root_hash: "mh:sha256:…" }
attestation     { mode: "simulated", … }
anchor          null
key_directory   { "cool-enclave-e44bc35f5f": …, "cool-log-e44bc35f5f": … }
```

Verdict for an 8-event chain (every event `ok: true`):

```text
binding=pass  signature=pass  inclusion=pass
witnesses=absent  attestation=simulated  enclave=simulated  anchor=absent
```

### Privacy of the receipt — CONFIRMED

Searched the serialised receipt for every raw value passed in. None appear:

```text
"revenue recognized before…"  false
"C-1001"                      false
"REV-REC-01"                  false
"AUD-FIN-2026-09"             false
"high"                        false
```

Only commitments and salts are present. Recomputing
`saltedCommit(stored_salt, plaintext)` reproduces the stored commitment exactly,
and an altered plaintext does not — so selective disclosure works by hand.

### JSON round-trip — CONFIRMED

`JSON.parse(JSON.stringify(evidence))` verifies identically (`ok: true`, same
domains). Receipts can cross an HTTP boundary and be stored as JSON.

### Self-containment — CONFIRMED

A receipt serialised in one client, then verified by a **different** `CooL`
instance and by standalone `verifyEvidence` with no client at all, returns
`ok: true`. Verification needs no live evidence plane, no network, no secret.

---

## 5. Verified capabilities

### CONFIRMED

- Install from npm, no build step, no native deps, no network at install time.
- Construct with no I/O; connect in ~102 ms.
- Record an arbitrary dotted event type with metadata + payload commitments.
- Group many events under a caller-supplied `executionId`.
- Hybrid post-quantum signing: ML-DSA-65 **and** Ed25519, both required.
- `binding` domain: `mh:sha256(canonicalCBOR(core))` recomputes.
- `inclusion` domain: real RFC 6962 audit paths reconstruct a signed tree head.
- Salted commitments hide raw data; the receipt leaks nothing passed in.
- Offline, self-contained verification with no service.
- Structured 7-domain verdict; `verifyEvidence` never throws.
- Tamper detection at per-domain granularity (18 cases, §6).
- Selective disclosure by recomputing `saltedCommit`.
- `expectedMeasurement` pinning fails a receipt from a different image.
- `withTrustedKeys` defeats same-`key_id` key substitution.
- Sealed keys are a **pure, reproducible function** of `(appName, imageDigest)`
  — re-deriving gives byte-identical public keys; changing `COOL_IMAGE_DIGEST`
  changes the key and the `key_id`.
- One transparency tree can span many plane instances via a shared `MemoryLog`.
- A tree can be **rehydrated from storage** by replaying
  `recordLeafDataV2(binding_hash)` in order; the rebuilt root equals the
  previously signed root, and new records continue at the next leaf index.
- RFC 6962 consistency proofs verify append-only growth; deleting a historical
  event makes `verifyConsistency` return `false`.
- Works in a **real browser** (Chromium, via a 230 KB esbuild bundle):
  record 162 ms, verify 22 ms, tamper correctly rejected, with `process`
  undefined.
- Error classes behave as documented, with `.code` values.

### NOT CONFIRMED

- **Hardware attestation.** Everything ran in the simulator:
  `runtime.mode: "simulated"`, `attestation: simulated`, `enclave: simulated`,
  `environment.hardware: false`. No Intel TDX / AMD SEV-SNP / dstack CVM was
  available. `attestation`/`enclave` can therefore **never** report `pass`, and
  `requireHardware: true` correctly makes such receipts `ok: false`.
- **`witnesses` domain.** Always `absent`. The STH carries one `cool-self`
  co-signature marked `external: false`, which the verifier displays and
  explicitly never counts. No external witness infrastructure exists in this
  build — confirmed in `log-memory.ts`'s own comments.
- **`anchor` domain.** Always `absent`; no OpenTimestamps/Bitcoin anchor is
  produced by `record()`. `anchorHead`/`submitToCalendars` exist in
  `cool-nwc/phala` but were not exercised (they need network + a calendar).
- **`quoteVerifier` / `blockHeaders` options.** Not exercised.
- **`cool-nwc/node` `FileLog`.** Read but not run; needs a writable directory.
- **CLI (`cool verify`, `cool pack build`, `cool disclose`).** Not exercised.
- **Byte-level reproducibility.** See §7.

---

## 6. Tamper matrix — CONFIRMED

Run against a receipt that verifies (`leaf 9` of a 10-leaf tree, so the audit
path is non-trivial). `verifyEvidence` was called with no options.

| # | Mutation | `ok` | Domains that caught it |
|---|---|---|---|
| 1 | flip one hex digit of `event.metadata_hash` | false | binding, signature |
| 2 | change `event.type` | false | binding, signature |
| 3 | change `event.metadata_salt` | false | binding, signature |
| 4 | flip one hex digit of `binding_hash` | false | binding, signature, inclusion |
| 5 | corrupt the Ed25519 signature | false | signature only |
| 6 | corrupt the ML-DSA signature | false | signature only |
| 7 | swap one `key_directory` entry | false | signature, enclave |
| 8 | corrupt `inclusion.audit_path` | false | inclusion only |
| 9 | change `inclusion.leaf_index` | false | inclusion only |
| 10 | change `sth.root_hash` | false | inclusion only |
| 11 | change an output commitment | false | structural (`output_salt` mismatch) |
| 12 | change `record.time.issued_at` | false | binding, signature |
| 13 | change `runtime.enclave_measurement.mrtd` | false | binding, signature, enclave |
| 14 | claim `runtime.mode: "hardware"` | false | binding, signature |
| 15 | drop `inclusion`, keep `sth` | false | structural — "both present or both absent" |
| 16 | **drop both `inclusion` and `sth`** | **true** | none — `inclusion` is `absent`, which `ok` permits |
| 17 | change `event.application_id` | false | binding, signature |
| 18 | tamper with the attestation quote | false | attestation, enclave |

Two findings that must shape what VeriAudit displays:

- **Case 16 is a real gap.** Stripping the transparency-log proof entirely still
  yields `ok: true`, because `ok` requires `inclusion ∈ {pass, absent}`. An
  attacker can remove the evidence that a record sat in a log. VeriAudit must
  therefore check `inclusion.status === "pass"` itself, not just `verdict.ok`.
- Cases 5 and 6 show each signature algorithm is checked independently, so
  "ML-DSA-65 **and** Ed25519 both verified" is a claim we can make per record.

---

## 7. Gotchas found the hard way

### 7.1 `software` without a `digest` produces an unverifiable receipt — CONFIRMED

This is the most important finding. Passing the natural-looking
`software: { name, version }` produces a receipt that **fails verification**:

```text
FAIL  software: {name, version}  (no digest key)
      binding=fail signature=fail  (everything else: absent)
      reasons: ["record.event.software.digest: expected a non-empty string"]
```

Root cause, located in the source: `phala/engine.ts:278` stores
`software: event.software ?? null` **verbatim, without normalising `digest`**.
The structural validator at `phala/structure.ts:183` then does
`if (sw["digest"] !== null) c.str(..., sw["digest"], MULTIHASH)`. A missing key
is `undefined`, which is `!== null`, so validation demands a multihash and the
whole receipt is rejected before any cryptography runs.

Accepted forms:

| Form | Verdict |
|---|---|
| `software` omitted entirely | `ok: true` (stored as `null`) |
| `software: { name, version }` | **`ok: false`** |
| `software: { name, version, digest: null }` | `ok: true` |
| `software: { name, version, digest: mhSha256(...) }` | `ok: true` |

**Rule for VeriAudit:** the CooL adapter always sets `digest` explicitly. It is
the single most likely way to ship a demo whose verification silently fails, and
a test asserts it. Worth reporting upstream.

### 7.2 Receipts are **not** byte-reproducible — CONFIRMED

Even with `clock`, `newId`, and `seq` all injected, two records of identical
input differ:

```text
binding_hash equal?   false
metadata_hash equal?  false
metadata_salt equal?  false
key_id equal?         true
key_directory equal?  true
```

`randomSalt()` draws 16 fresh bytes per record, by design (it is what enables
selective disclosure). **Consequence:** VeriAudit cannot snapshot-test receipt
bytes or treat a `binding_hash` as a stable identifier for a logical event
across regenerations. Keys *are* stable, so the publishable key directory is a
constant.

### 7.3 The in-memory log restarts per client — CONFIRMED, and worked around

Two `CooL` instances each start their own tree, so both first records are
`leaf 0 / tree 1`. The SDK's own `phala/log.ts` calls this out: "a hundred
records become a hundred trees of size one … which is most of what a
transparency log is for."

The `log` seam fixes it, and VeriAudit will use it. Confirmed working:

```text
one shared MemoryLog, two planes:   leaf 0/1, leaf 1/2, leaf 2/3  (all ok)
rehydrate from 3 stored bindings:   rebuilt root == previously signed root: true
next record after rehydration:      leaf 3, tree 4, ok: true
old receipts still verify:          true
consistency proof (size 3 -> 4):    true
same, with a forged old root:       false
same, after deleting event 2:       false
```

Rehydration needs only the **ordered list of `binding_hash` strings** — no
secrets, ~80 bytes each. `EvidenceLog.append()` is **synchronous**, so a log
backed by async storage is impossible; the tree must be hydrated in memory
before recording and persisted afterwards. This is a hard architectural
constraint.

`MemoryLog`'s constructor is `(logId, logKey)`; calling `new MemoryLog()`
fails later with an opaque `capture dropped: Cannot read properties of
undefined (reading 'mlDsaSecret')`. The log key comes from
`sealedKeyset(client).log`.

### 7.4 `withTrustedKeys` is not what its name suggests — CONFIRMED

Signature is `withTrustedKeys(receipt, trusted) → ReceiptV2`. It returns a
**new receipt** with the trusted directory merged over the embedded one. It is
not a verify-options builder. Passing it as options silently does nothing and
everything still reports `ok: true` — a false-confidence trap.

### 7.5 `verifyConsistency` argument order — CONFIRMED

`verifyConsistency(m, n, firstRoot, secondRoot, proof)`. Getting it wrong throws
`RangeError: offset is out of bounds` from deep inside `codec.js`. Unlike
`verifyEvidence`, this function is **not** throw-free — wrap it.

---

## 8. Receipt size budget — CONFIRMED

One receipt is **~29.7 KB of JSON**. Breakdown:

| Part | Bytes | Why |
|---|---|---|
| `sth` | 9,389 | tree head + hybrid signature + self-witness |
| `key_directory` | 8,171 | two ML-DSA-65 public keys (~1.9 KB each) |
| `record.signature` | 4,601 | ML-DSA-65 signature (~3.3 KB) + Ed25519 |
| `attestation` | 5,787 | simulated quote + its signature |
| `record.runtime` | 723 | measurement registers |
| `record.event` | 424 | commitments and salts only |
| `inclusion` | 200 | audit path |

Implications, which drive the architecture:

- 60 receipts ≈ **1.70 MB** of JSON. Never send a list view full of receipts.
- A compact UI summary (`record_id`, `type`, `execution_id`, `issued_at`,
  `binding_hash`, `key_id`, `mode`, `leaf_index`, `tree_size`) is ~330 bytes.
- `localStorage` (5–10 MB) is too tight for many receipts; IndexedDB is not.
- **Do not** CooL-record all 50+ simulated history activities: 1.7 MB and
  ~850 ms for evidence nobody opens.

---

## 9. Deployment constraints (Vercel)

### Runtime matrix

| Target | `cool-nwc` main entry | Status |
|---|---|---|
| Node.js ≥ 20, local | record + verify | **CONFIRMED working** |
| Vercel Node.js serverless functions | record + verify | **INFERRED — high confidence.** Zero `node:` imports in the reachable graph; only `globalThis.crypto.getRandomValues` and `process.env` (guarded by `typeof process !== "undefined"`), both present. `TODO`: confirm on a real deployment in Milestone 8. |
| Vercel Edge runtime | record + verify | **INFERRED possible, NOT CHOSEN.** No Node builtins needed and WebCrypto is available, but the vendor's `troubleshooting.md` says "browser/edge use is **not currently tested** — don't rely on it", and ML-DSA keygen is CPU-heavy against Edge CPU limits. |
| Browser / client-side | record + verify | **CONFIRMED working** in Chromium: 162 ms record, 22 ms verify, tamper rejected, 230 KB bundle, `process` undefined. Contradicts the vendor's "untested" note — untested is not the same as broken. |
| `cool-nwc/node` (`FileLog`) | filesystem log | Node only; on Vercel limited to ephemeral `/tmp`. **Not used.** |
| `attestation.provider: "dstack"` | hardware path | **Impossible on Vercel** — needs a unix socket to a dstack guest agent inside a CVM. |

### Dependency requirements

| Requirement | Needed? | Evidence |
|---|---|---|
| Filesystem access | **No** (main entry) | zero `node:fs` in the reachable graph |
| Native binaries | **No** | pure JS, no postinstall |
| Persistent process | **No** | construction does no I/O; receipts are self-contained |
| Long-running process | **No** | `record()` resolves in ~17 ms |
| Local services / sockets | **No** for `provider: "local"`; **yes** for `"dstack"` | `HttpDstackClient` only |
| Special Node APIs | **No** | `globalThis.crypto` + guarded `process.env` |
| Environment variables | **Optional** | `COOL_IMAGE_DIGEST`, `COOL_DSTACK_ENDPOINT` |
| External network access | **No** | "The SDK makes no network calls of its own and carries no telemetry" (`src/index.ts`), consistent with observed behaviour |
| Secrets | **None** | keys are derived from the measurement, not stored |

### Does CooL itself require persistent state?

**No — CONFIRMED.** Signing keys are re-derived deterministically, and every
receipt carries the public keys needed to verify it. The only thing worth
persisting is the transparency log's ordered leaf list, and that is VeriAudit's
choice (§7.3), not the SDK's requirement.

### Environment variables that change behaviour

| Variable | Effect | Confirmed |
|---|---|---|
| `COOL_IMAGE_DIGEST` | feeds the simulated measurement → **changes the sealed key and `key_id`**; defaults to `sha256:unpinned-development-image` | **CONFIRMED** |
| `COOL_DSTACK_ENDPOINT` | if set, provider resolves to `dstack` even without `attestation.provider` | CONFIRMED in `client.ts:131` — **must stay unset on Vercel**, or every request fails with `DstackUnavailableError` |

### Deployment architecture decision

**Vercel frontend + Vercel Node.js serverless functions. No separate backend, no
database.** Reasoning, from the findings above:

1. Nothing in the recording or verification path needs a filesystem, a socket, a
   daemon, or outbound network — so a separate backend would buy nothing.
2. CooL keys are reproducible from `(applicationId, COOL_IMAGE_DIGEST)`, so a
   stateless function fleet produces receipts under one stable identity with no
   key storage.
3. Receipts are self-contained, so verification is a pure function and safe in a
   cold-started function or in the browser.
4. The transparency tree needs only an ordered list of public binding hashes to
   rehydrate, which fits in the session rather than a database.
5. Node runtime (not Edge) because the vendor declines to support Edge and
   ML-DSA is CPU-bound. This costs nothing we need.

`TODO` — validate on a real Vercel deployment in Milestone 8 (early, per the
build guideline).

---

## 10. Unknowns / open questions

1. `UNKNOWN` — behaviour on real Vercel Node serverless: cold-start ML-DSA
   keygen cost and whether ~102 ms + 17 ms/record holds. **Resolve in Milestone 8.**
2. `UNKNOWN` — whether `attestation`/`enclave` can ever report `pass` for us.
   Requires a dstack CVM or the dstack simulator binary. Out of scope for 8
   hours; the P2 list in the source of truth agrees.
3. `UNKNOWN` — the `witnesses` and `anchor` domains end to end. Both need
   infrastructure that does not exist in this build.
4. `UNKNOWN` — `cool pack build` / `cool disclose` CLI ergonomics for an export
   feature. P1 at best.
5. `UNKNOWN` — whether a very large `metadata` object degrades the seal path.
   The vendor warns about it; VeriAudit commits summaries, so it should not bite.
6. `TODO` — report the §7.1 `software.digest` normalisation bug upstream.
7. `UNKNOWN` — whether the hybrid signature verification time (22 ms in browser)
   is acceptable for verifying ~10 receipts at once client-side (~220 ms).
   Mitigation: verify server-side, or verify lazily per node.
