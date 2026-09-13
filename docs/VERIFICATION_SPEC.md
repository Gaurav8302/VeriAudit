# Verification Spec

What VeriAudit verifies, precisely — separated into what CooL establishes, what
VeriAudit's own event system establishes, and what nothing here establishes.

Every claim below is backed by an observed result in `COOL_SDK_AUDIT.md`.

---

## 1. The verification pipeline

```text
Original record (VeriAudit event)
        ↓
CooL-backed evidence (cool.receipt.v2, ~30 KB, commitments only)
        ↓
verifyEvidence + withTrustedKeys + expectedMeasurement + key_id allow-list
        ↓
7 domains + 3 application checks
        ↓
VERIFIED / FAILED
```

```ts
// lib/cool/verifier.ts
const pinned  = withTrustedKeys(receipt, PUBLISHED_KEY_DIRECTORY);
const verdict = await verifyEvidence(pinned, { expectedMeasurement: EXPECTED_MEASUREMENT });

const signerTrusted = TRUSTED_KEY_IDS.has(receipt.record.signature.key_id);
const logged        = verdict.checks.inclusion.status === "pass";
const ok            = verdict.ok && signerTrusted && logged;
```

---

## 2. Integrity / provenance claims — what CooL actually establishes

### CONFIRMED and claimable

| Claim | Domain | Evidence |
|---|---|---|
| The record's content has not changed since it was sealed | `binding` | `mh:sha256(canonicalCBOR(core))` recomputes. 8 of 18 tamper cases caught here |
| Both a post-quantum and a classical signature verify over it | `signature` | ML-DSA-65 **and** Ed25519, checked independently (cases 5 and 6 fail separately) |
| The record sits at a stated position in an append-only log whose head is signed | `inclusion` | real RFC 6962 audit paths reconstruct the STH root; corrupting the path, the leaf index, or the root each fails it |
| Committed evidence matches the artifact we hold | application | `saltedCommit(salt, plaintext)` reproduces the stored commitment; an altered plaintext does not |
| The sealing plane's measurement matches the image we approved | `enclave` (pinned) | a receipt from a different `COOL_IMAGE_DIGEST` fails with `measurement does not match the pinned image` |
| It was signed by a key VeriAudit published | application | `key_id` allow-list + `withTrustedKeys` |
| Nothing was removed from or reordered in the history since the audit was sealed | application | `verifyConsistency` returns `true` for honest growth, `false` for a forged root **and** `false` after deleting a historical event |
| Verification needs no service, no network, no account, and reveals no data | — | a receipt verified by a different client instance and by standalone `verifyEvidence` with no client at all |

### NOT CONFIRMED — never claimed

| Not claimed | Why | Status in every receipt |
|---|---|---|
| Hardware protected the execution | no TDX/SEV-SNP/dstack CVM available | `attestation: simulated`, `enclave: simulated`, `mode: "simulated"`, `hardware: false` |
| Independent parties witnessed the log | no external witness infrastructure exists in this build; the STH's only co-signature is `cool-self` with `external: false`, which the verifier displays and never counts | `witnesses: absent` |
| The record existed at a public point in time | no OpenTimestamps/Bitcoin anchor is produced | `anchor: absent` |
| A vendor root of trust was chained | no `quoteVerifier` exercised | — |

`requireHardware: true` correctly makes our receipts `ok: false` — `CONFIRMED`.
We therefore do **not** pass it, and instead display `simulated` plainly.

---

## 3. Application-level claims — what VeriAudit's event system establishes

Distinct from cryptography, and it matters that the distinction is visible:

| Claim | Basis | Strength |
|---|---|---|
| These events form this causal chain | `parentEventId` links | **product-level.** The edges are VeriAudit's, not CooL's. CooL makes each *node* tamper-evident; it does not prove the graph |
| This finding came from this control test on this evidence | event references, each individually sealed | strong — every node in the chain is independently verifiable |
| A human reviewed it and decided X | the `human.review.completed` event and its receipt | the *record* of the review is tamper-evident |
| This history is complete | **not claimed.** VeriAudit records what its own engine emits. Anything outside the app was never captured | weak — stated as a limitation |
| The events happened at their logical times | **not claimed.** `occurredAt` is simulated demo data; only `record.time.issued_at` is attested, and it is the sealing time | see §5 |

---

## 4. AI correctness — explicitly not established

**Cryptographic verification does not prove the AI was correct.**

A VERIFIED receipt means: *this is exactly what the system recorded, and it has
not been altered since.* It says nothing about whether the conclusion was right.

Specifically, verification does **not** establish that:

- the AI interpreted the evidence correctly,
- the audit conclusion was substantively correct,
- the controls tested were the right controls,
- the finding's severity or dollar amount is accurate,
- the human reviewer exercised good judgement,
- the work satisfies any regulation or auditing standard.

The vendor agrees in `HACKATHON.md`: *"CooL records what happened; it doesn't
grade it."* The source of truth §5 and §12 say the same. The UI states it inline,
next to the verdict — not buried in a footnote:

> Verified means this record is authentic and unaltered. It does not mean the
> AI's conclusion was correct.

---

## 5. The two-clocks caveat

An honesty point that is easy to get wrong. Every receipt is sealed *now*, when
the judge runs the demo. `record.time.issued_at` is therefore today, while the
event's `occurredAt` says September.

So the attested statement is *"this content was sealed at `issued_at` and has not
changed since"*, **not** *"this happened three months ago"*. The UI labels the two
timestamps distinctly (**Occurred** vs **Sealed**) and the README says the
three-month history is simulated. Presenting the sealing time as historical proof
would be exactly the kind of overclaim the brief forbids.

---

## 6. Two application checks that `verdict.ok` alone would miss

Both come from real findings, and omitting either would make the verification
panel misleading.

### 6.1 `inclusion` must be `pass`, not merely non-failing

`CONFIRMED` (tamper case 16): removing **both** `inclusion` and `sth` from a
receipt yields `ok: true` with **zero reasons**, because `ok` requires
`inclusion ∈ {pass, absent}`. An attacker can strip the proof that a record was
ever logged and the SDK's own verdict will not object.

VeriAudit therefore requires `inclusion.status === "pass"` for its own
`VERIFIED`, and surfaces a stripped proof as a failure:

```text
✗ Inclusion   FAILED — this receipt carries no transparency-log proof
              (a receipt that was logged should have one)
```

### 6.2 The signer must be a published VeriAudit key

`CONFIRMED` (proof4): a receipt carries its own `key_directory`, so anyone
running their own `CooL` instance produces a receipt that verifies `ok: true`
with zero reasons — under a different `key_id`.

```text
forged receipt, naive verifyEvidence:  ok=true, reasons=[]
```

Two defences, both `CONFIRMED`, and both needed:

| Attack | Defence |
|---|---|
| Forger uses their **own** `key_id` | the `key_id` allow-list rejects it (`withTrustedKeys` alone does not — the ids do not collide, so nothing is overridden) |
| Forger relabels the receipt with a **trusted** `key_id` and supplies their own key material | `withTrustedKeys` forces the real public key in under that id → `signature` fails, `enclave` fails |
| Forger runs a different image | `expectedMeasurement` → `enclave` fails |

This is the most important correction the discovery phase produced. Without it,
the verification panel would be decorative.

---

## 7. Verdict presentation

Compact by default (guideline §14), with the full domain table on expand.

### VERIFIED

```text
Execution Integrity                                      VERIFIED

✓ Binding             content hash recomputes
✓ Signature           ML-DSA-65 + Ed25519 both verified
✓ Inclusion           leaf 6 of tree 9 · audit path reconstructs the signed head
✓ Signer              cool-enclave-70a788d680 · published VeriAudit key
✓ Measurement         matches the pinned image
✓ Evidence integrity  4 of 4 artifact commitments match
~ Attestation         simulated — no hardware root of trust
~ Enclave             simulated
– Witnesses           none — no external witness infrastructure in this build
– Anchor              none — never submitted to a public chain

Verified means this record is authentic and unaltered.
It does not mean the AI's conclusion was correct.
```

### FAILED

```text
Execution Integrity                                        FAILED

✗ Binding     FAILED — recomputed binding_hash does not match the receipt
✗ Signature   FAILED — ML-DSA-65 and Ed25519 did not verify (record altered or wrong key)
✓ Inclusion   leaf 6 of tree 9
```

Reasons are the SDK's own strings, rendered verbatim. Glyph legend: `✓` pass,
`✗` fail, `~` simulated, `–` absent, `…` pending. `~` and `–` are never styled as
success.

---

## 8. Tamper demonstration

Two mutations, chosen because they fail differently.

### 8.1 Alter the finding

```text
Original: 3 exceptions   →  VERIFIED
Altered:  0 exceptions   →  VERIFICATION FAILED
  binding    FAILED — recomputed binding_hash does not match the receipt
  signature  FAILED — ML-DSA-65 and Ed25519 did not verify
```

`CONFIRMED` across cases 1, 2, 3, 12, 13, 14, 17. The mutation runs on an
in-memory copy; the stored receipt is never touched.

### 8.2 Delete an event from history — the stronger demo

```text
Tree head sealed with the audit:  size 9, root mh:sha256:ff09b0ed…
Today's tree, event 2 removed:    size 8, root mh:sha256:…

verifyConsistency(9, 8, oldRoot, newRoot, proof)  →  false
```

`CONFIRMED`: honest growth verifies `true`; a forged old root returns `false`;
deleting a historical event returns `false`.

This one answers the sharper objection. Editing a record is the obvious attack;
*quietly removing* the inconvenient one is the realistic one, and the append-only
proof is what catches it.

Implementation note: `verifyConsistency` **can throw** (unlike `verifyEvidence`)
and its argument order is `(m, n, firstRoot, secondRoot, proof)`. Wrapped in
try/catch, with a thrown error treated as a failure, not a pass.

---

## 9. Where verification runs

| Path | Runtime | Status |
|---|---|---|
| `POST /api/cool/verify` | Vercel Node | **authoritative.** ~1 ms/receipt |
| In-browser, client-side | Chromium | `CONFIRMED working` (22 ms/receipt), but the vendor labels browser use untested. P1 "verify it yourself" affordance only; never the basis of a claim |
| `npx cool-nwc verify receipt.json` | any Node ≥ 20 | `UNKNOWN` — not exercised. If confirmed, a **Download receipt** button lets a judge verify outside our code entirely, which is the strongest possible demonstration. P1 |

Verification is never cached. It is recomputed from the receipt each time it is
displayed, so the panel can never show a stale VERIFIED.
