# Security and Claims

Claims must match the actual implementation (source of truth §12). This document
is the list of sentences VeriAudit is allowed to say, and the list it is not.

---

## 1. What we claim

Each claim below has an observed result behind it in `COOL_SDK_AUDIT.md`.

### About recorded evidence

1. **"Important execution events are recorded as cryptographic evidence using
   CooL."** Nine canonical events per hero execution, via real
   `cool.record(...)` calls against `cool-nwc@3.0.0`.
2. **"Each record is tamper-evident."** Any change to the sealed content fails
   the `binding` and `signature` domains. `CONFIRMED` across an 18-case tamper
   matrix.
3. **"Records carry a hybrid post-quantum signature."** ML-DSA-65 (FIPS 204) and
   Ed25519, both required, checked independently.
4. **"Each record has a transparency-log inclusion proof."** Real RFC 6962 audit
   paths reconstruct a signed tree head.
5. **"Records within a session form one append-only log, and removing a
   historical record is detectable."** `verifyConsistency` returns `true` for
   honest growth and `false` after deleting an earlier event.
6. **"Evidence can be verified offline, with no account and without revealing the
   underlying data."** A receipt verified by a different client instance and by
   standalone `verifyEvidence` with no client at all.
7. **"The receipts contain commitments, not our data."** A search of a serialised
   receipt for five raw input values returned `false` for all five.
8. **"A judge can recompute a commitment from the plaintext we show them."**
   `saltedCommit(salt, plaintext)` reproduces the stored commitment; an altered
   plaintext does not.
9. **"Evidence is bound to the software identity and image measurement that
   produced it, and we pin both."** `expectedMeasurement` + a `key_id`
   allow-list; a receipt from a different image fails `enclave`.

### About the product

10. **"VeriAudit reconstructs a searchable execution trail around AI audit
    work."** Product-layer capability, not a cryptographic claim.
11. **"The hero audit's result is deterministic."** Computed by a rule-based
    engine, not an LLM; identical on every run.
12. **"Human review is recorded as a distinct, separately verifiable event."**

### Wording we use, following the vendor's own guidance

Permitted (`HACKATHON.md`): *cryptographically verifiable*, *tamper-evident*,
*offline-verifiable*, *privacy-preserving by commitment*.

---

## 2. What we do not claim

### Hardware and attestation

- **Not** *hardware-attested*, *TEE-protected*, or *enclave-protected*. Every
  receipt reads `mode: "simulated"`, `attestation: simulated`,
  `enclave: simulated`, `environment.hardware: false`. No Intel TDX, AMD SEV-SNP,
  or Phala dstack CVM was available, and `requireHardware: true` correctly makes
  our receipts `ok: false`.
- The UI shows `~ simulated` for those two domains rather than hiding them. The
  vendor is explicit that blurring this distinction defeats the project's
  purpose.

### Witnessing and public timestamping

- **Not** *independently witnessed*. `witnesses` is permanently `absent`. The
  STH's only co-signature is `cool-self` with `external: false`, which the
  verifier displays and never counts.
- **Not** *blockchain-anchored* or *publicly timestamped*. `anchor` is always
  `absent`; no OpenTimestamps proof is produced.

### AI and audit substance

- **Not** *proves the AI was correct*. Verification establishes authenticity, not
  accuracy. Stated inline next to every verdict.
- **Not** *proves the audit conclusion was substantively correct*.
- **Not** *regulatory compliance*, and not an SOX/ISA/PCAOB-conformant audit.
  Synthetic data, illustrative controls.
- **Not** *fraud prevention*. It makes some tampering detectable after the fact.

### Completeness and immutability

- **Not** *complete capture of every system action*. VeriAudit records what its
  own engine emits. Anything outside the app was never captured, and no receipt
  can prove a record that was never created.
- **Not** *absolute immutability*. Receipts are tamper-**evident**, not
  tamper-**proof**. Deleting a receipt entirely destroys it; what remains
  detectable is that the log no longer matches its earlier signed head.
- **Not** *production-ready*. A hackathon prototype.

### Time

- **Not** *proves this happened three months ago*. `record.time.issued_at` is the
  **sealing** time, which is today. `occurredAt` is simulated demo data. The UI
  labels them **Sealed** and **Occurred** separately.

### Cryptography

- **Not** *quantum-proof* or *unhackable*. The signature is hybrid
  post-quantum (ML-DSA-65 + Ed25519), which is a specific, narrower statement.

---

## 3. Honest gaps found during discovery

Documenting these is what makes the rest credible.

### 3.1 `verdict.ok` alone is not sufficient — and we compensate

`CONFIRMED` tamper case 16: stripping **both** `inclusion` and `sth` from a
receipt yields `ok: true` with **zero reasons**, because `ok` permits
`inclusion: absent`. An attacker can remove the proof that a record was logged
and the SDK's verdict will not object.

VeriAudit requires `inclusion.status === "pass"` for its own VERIFIED. Without
this, the panel would be misleading.

### 3.2 A receipt's embedded keys are self-asserted — and we pin ours

`CONFIRMED`: a forger running their own `CooL` instance produces a receipt that
verifies `ok: true` with zero reasons, because every receipt carries its own
`key_directory`.

So `verifyEvidence` alone answers *"is this receipt authentic and internally
consistent?"* — **not** *"did VeriAudit produce it?"* We answer the second with a
`key_id` allow-list plus `withTrustedKeys`, and `expectedMeasurement` for the
image. `CONFIRMED` that this combination rejects a foreign-plane receipt, a
relabelled receipt, and a same-`key_id` key substitution.

The SDK's own `verification.md` makes the same point: *"A receipt can be
cryptographically valid and still policy-rejected."*

### 3.3 The transparency log's head is client-held

Our `logState` travels with the session, so the append-only property is
demonstrated **within a session**, sequenced by a client-supplied head. A client
could present a shorter history. What it cannot do is present a *modified* one
that still matches previously signed tree heads.

An independently witnessed log would fix this. None exists in this build, which
is exactly why `witnesses` reads `absent`.

### 3.4 A missing receipt is not a failure

If a receipt is absent from the session store we show *"receipt not in this
session"*, never FAILED. Conflating "no evidence" with "bad evidence" would be
its own kind of dishonesty.

---

## 4. Secrets

**There are none.** This is a property of the SDK, not a shortcut.

| | |
|---|---|
| Signing keys | derived deterministically from the measurement on every connect. Never stored, never transmitted, nothing to rotate |
| API keys | none — no LLM provider, no database, no external service at runtime |
| Env vars | `COOL_APP_ID`, `COOL_IMAGE_DIGEST`, `COOL_LOG_ID` — all public values, safe in `.env.example` and the README |
| Committed constants | `PUBLISHED_KEY_DIRECTORY` and `EXPECTED_MEASUREMENT` in `lib/cool/identity.generated.ts` are **public keys and public measurements**, intended to be published so others can verify. Committing them is what makes the pin meaningful — a pin derived from the environment could be moved by whoever controls the environment |
| `.gitignore` | `.env*.local`, `node_modules`, `.next`, `cool-sdk/` |

Per guideline §17: `.env.example` is committed, real env files are not.

---

## 5. Data

All demo data is **synthetic and authored for this prototype**. No real company,
person, contract, ledger, or financial figure. Names are invented; "J. Okafor",
"Northgate Logistics", contracts `C-1001`/`C-1002`, and the $1.42 M figure are
fabrications.

| | |
|---|---|
| Personal data | none |
| Client data | none |
| Licensing | synthetic, authored here. The only third-party code is `cool-nwc` (Apache-2.0) and standard npm packages |
| Where it lives | in the repository as TypeScript constants, plus a seeded generator |

Labelled as synthetic in the UI and the README, so no judge mistakes it for a
real engagement.

---

## 6. Sensitive payload handling

The pattern generalises past the demo, and it is worth showing because it is what
CooL is actually for.

```text
plaintext artifact  →  stays in VeriAudit
      ↓
saltedCommit(random 16-byte salt, bytes)  →  mh:sha256(salt ‖ bytes)
      ↓
commitment + salt in the receipt; the bytes are discarded inside the plane
      ↓
later: show the plaintext to an auditor, who recomputes the commitment
```

`CONFIRMED` end to end. The property this gives a real deployment: evidence can
be proven to exist and be unaltered **without disclosing it**, and disclosure
becomes a later, selective choice.

In the demo the "sensitive" artifacts are synthetic, so we show plaintext and
commitment side by side with a **Recompute commitment** button.

---

## 7. Client / server trust boundary

| Data | Origin | Trusted? | Consequence |
|---|---|---|---|
| Receipts | server-sealed | **yes**, cryptographically | content is verifiable regardless of transport |
| `logState` (binding hashes) | client-held, sent back on each record | **no** | a client could present a shorter history; it cannot present a modified one that matches earlier signed heads |
| Search queries, filters, navigation | client | n/a | no security impact |
| Generated corpus | both, from the seed | n/a | synthetic demo data |
| `PUBLISHED_KEY_DIRECTORY`, `EXPECTED_MEASUREMENT` | committed constants | **yes** | the trust anchor. Verification is only as good as these being correct |
| Verification verdicts | server-computed | yes | recomputed on every display, never cached |

The honest summary: the **server** is the signing authority, the **receipts** are
the trustworthy artifacts, and the **client** is an untrusted presentation layer
that happens to hold the sequence. Verification does not depend on trusting the
client, because each receipt stands alone.

---

## 8. Threat model in one table

| Attack | Detected? | By what |
|---|---|---|
| Edit a finding after the fact | **yes** | `binding` + `signature` |
| Edit any sealed metadata or timestamp | **yes** | `binding` + `signature` |
| Swap a signature | **yes** | `signature` (each algorithm independently) |
| Substitute key material under a trusted `key_id` | **yes** | `withTrustedKeys` → `signature` + `enclave` |
| Forge a receipt from a different evidence plane | **yes** | `key_id` allow-list + `expectedMeasurement` |
| Claim `mode: "hardware"` | **yes** | `binding` + `signature` |
| Swap the attestation quote | **yes** | `attestation` + `enclave` |
| Corrupt or forge an inclusion proof | **yes** | `inclusion` |
| Delete a historical event from the log | **yes** | `verifyConsistency` against the stored tree head |
| **Strip the inclusion proof entirely** | **yes, by VeriAudit** — *not* by `verdict.ok` | our `inclusion === "pass"` check (§3.1) |
| Delete a receipt outright | **no** | nothing proves a record that no longer exists. Mitigated only by the log head |
| Present a truncated history | **partially** | the client holds the head (§3.3); external witnesses would fix it |
| Never record an action at all | **no** | no evidence system can prove the absence of an unrecorded action |
| An incorrect AI conclusion, faithfully recorded | **no, and not in scope** | verification proves authenticity, not correctness |

The last three rows are the honest limits, and they belong in the README's
Limitations section as well as here.
