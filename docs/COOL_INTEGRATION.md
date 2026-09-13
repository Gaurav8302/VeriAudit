# CooL Integration

The product-facing specification for how VeriAudit uses CooL. Every API here is
`CONFIRMED` in `COOL_SDK_AUDIT.md` — read that first for the evidence.

---

## 1. Package and installation

```sh
npm install cool-nwc      # 3.0.0, ESM-only, Node >= 20, no native deps
```

```ts
import { CooL, verifyEvidence, formatVerdict, withTrustedKeys } from "cool-nwc";
import { sealedKeyset, SimulatedDstackClient, recordLeafDataV2 } from "cool-nwc/phala";
import { MemoryLog } from "cool-nwc";
```

Consumed from npm, not from the local `cool-sdk/` clone. All SDK imports live in
`lib/cool/` and nowhere else.

---

## 2. Data flow

```text
AI / audit operation
      ↓
VeriAudit event            (lib/events — our semantics, our graph)
      ↓
Canonical event payload    (lib/cool/recorder.ts — the projection below)
      ↓
CooL operation             cool.record({ type, executionId, metadata, payloads, software })
      ↓
Receipt / evidence         cool.receipt.v2, ~30 KB, commitments only
      ↓
Stored reference           EventRecord.cool (compact) + receipt in IndexedDB
      ↓
Verification               verifyEvidence + key allow-list + measurement pin
      ↓
UI                         per-domain integrity panel on the trail
```

---

## 3. Which events are CooL-backed, and why

`record()` costs ~17 ms and ~30 KB. Recording all 50+ simulated activities would
mean 1.7 MB of evidence nobody opens, so selection is deliberate. The test is:
**would someone challenging this decision months later need this step to be
tamper-evident?**

### P0 — the hero execution's nine events, all CooL-backed

| Event | Recorded because |
|---|---|
| `audit.started` | anchors the trail in time and names the scope and scenario being audited |
| `artifact.ingested` | commits **which** evidence entered the audit. Without this, "the AI saw different numbers" is unanswerable |
| `artifact.parsed` | commits the structured interpretation. The gap between a raw PDF and parsed figures is where real audit disputes live |
| `retrieval.executed` | commits which subset of evidence reached the model. The most common challenge is "it ignored document X" |
| `model.executed` | commits model identity, version, and input/output commitments. This is the "what did the AI actually do" record |
| `control.tested` | commits the control, the rule applied, and pass/exception. The finding's direct cause |
| `finding.created` | the conclusion being challenged. **The single most important receipt** |
| `human.review.completed` | commits who accepted/modified/rejected it and when. Separates AI output from the organisation's decision |
| `conclusion.created` | commits the final aggregate (12 tested / 9 passed / 3 exceptions) that leaves the system |

Not recorded, on purpose: UI navigation, search queries, page views, hover
states, and the 50+ simulated activities. Sending every UI event to CooL would
be noise, and the source of truth explicitly warns against it.

### P1

- Lazy on-demand recording when a judge opens a non-hero execution.
- `human.review.requested` and `tool.executed`, if the workflow grows them.

### Honest UI consequence

Simulated history activities carry `cool: null`. The UI must label them
**"no cryptographic evidence"**, not leave them ambiguous or imply verification.
This is a feature: it shows the judge exactly which records are CooL-backed.

---

## 4. What gets committed

`lib/cool/recorder.ts` projects a VeriAudit event into a `RecordInput`. The
projection is the contract, and it is the only place that decides what leaves the
product layer.

```ts
// lib/cool/recorder.ts  (specification)
export function toRecordInput(e: VeriAuditEvent): RecordInput {
  return {
    type: e.type,                    // "finding.created" — our vocabulary, dotted
    executionId: e.executionId,      // ALWAYS explicit; groups the trail
    metadata: {
      audit_id: e.auditId,
      event_id: e.eventId,
      parent_event_id: e.parentEventId ?? null,
      sequence: e.sequence,
      actor: e.actor,                // "ai" | "human" | "system"
      scenario: e.scenario,
      occurred_at: e.occurredAt,     // our logical time, distinct from sealing time
      artifact_ids: e.artifactRefs,
      summary: e.summary,            // short, structured, no free-form blobs
      ...e.typeSpecific,             // control id, severity, decision, counts…
    },
    payloads: {
      input:  e.inputPayload,        // salted-hashed and discarded
      output: e.outputPayload,
      state:  undefined,
    },
    software: {
      name: "veriaudit-audit-engine",
      version: APP_VERSION,
      digest: null,                  // MUST be explicit — see COOL_SDK_AUDIT §7.1
    },
  };
}
```

Three rules this encodes:

1. **`software.digest` is always set.** `CONFIRMED`: omitting the key produces a
   receipt that fails verification with
   `record.event.software.digest: expected a non-empty string`. A test asserts
   this.
2. **`executionId` is always explicit.** Otherwise the SDK mints a fresh ULID per
   record and the trail cannot be grouped.
3. **Metadata is a summary, not a blob.** The vendor warns that large metadata
   costs CPU on the seal path; commitments over big artifacts go in `payloads`.

### What CooL returns, and what VeriAudit persists

`record()` returns `{ evidence, recordId, executionId, digest }`. We persist a
compact reference on the event and the receipt separately:

```ts
type CoolReference = {
  recordId: string;        // ULID from the SDK
  bindingHash: string;     // mh:sha256:… — also the log leaf
  keyId: string;           // e.g. "cool-enclave-70a788d680"
  signatureAlg: string;    // "ml-dsa-65+ed25519"
  issuedAt: string;        // record.time.issued_at (sealing time)
  runtimeMode: "mock" | "simulated" | "hardware";
  leafIndex: number | null;
  treeSize: number | null;
  receiptRef: string;      // IndexedDB key for the ~30 KB receipt
};
```

~330 bytes per event, so list views and search results stay small. The full
receipt is fetched only when a node is opened. This follows directly from the
size budget in `COOL_SDK_AUDIT.md` §8.

---

## 5. The transparency log

`CONFIRMED` that without intervention every client starts its own tree, so every
record would be `leaf 0 / tree 1` — the SDK's own source calls this out as
defeating the point of a log.

VeriAudit therefore drives the `log` seam:

```ts
// lib/cool/log-state.ts  (specification)
// logState: ordered binding_hash strings, client-held, ~80 bytes each, no secrets
export async function planeWithLog(logState: string[]) {
  const dstack = new SimulatedDstackClient({
    appName: APP_ID,
    imageDigest: process.env.COOL_IMAGE_DIGEST ?? DEV_IMAGE_DIGEST,
  });
  const keys = await sealedKeyset(dstack);
  const log = new MemoryLog(LOG_ID, keys.log);     // (logId, logKey) — both required
  for (const binding of logState) log.append(recordLeafDataV2(binding));
  const tee = await CoolTee.connect({ app: { name: APP_ID, imageDigest }, dstack, log });
  return { tee, log };
}
```

`CONFIRMED` behaviour of exactly this pattern:

```text
rehydrate from 3 stored bindings → rebuilt root == previously signed root: true
next record                      → leaf 3, tree 4, ok: true
old receipts                     → still verify: true
consistency proof size 3 → 4     → true
forged old root                  → false
after deleting a historical event→ false
```

So across stateless invocations VeriAudit maintains **one growing append-only
tree**, every event gets a real audit path, and "nothing was removed from this
history" is provable rather than asserted.

Constraint: `EvidenceLog.append()` is synchronous, so the tree is always
hydrated in memory before recording and the updated `logState` is returned to the
client afterwards. There is no way to back the log with async storage.

Honest limit: the head is client-held and there are no external witnesses
(`witnesses` is permanently `absent`). This proves internal append-only
structure, not public availability. Stated in `SECURITY_AND_CLAIMS.md`.

---

## 6. Verification

```ts
// lib/cool/verifier.ts  (specification)
export async function verify(receipt: unknown): Promise<IntegrityState> {
  const pinned = withTrustedKeys(receipt as Evidence, PUBLISHED_KEY_DIRECTORY);
  const verdict = await verifyEvidence(pinned, {
    expectedMeasurement: EXPECTED_MEASUREMENT,
  });

  const signerTrusted = TRUSTED_KEY_IDS.has(subjectKeyId(receipt));
  const logged = verdict.checks.inclusion.status === "pass";

  return {
    ok: verdict.ok && signerTrusted && logged,
    verdictOk: verdict.ok,
    signerTrusted,
    logged,
    domains: verdict.checks,
    reasons: verdict.reasons,
    hardware: verdict.checks.attestation.status === "pass",   // false in this build
  };
}
```

Three things beyond `verdict.ok`, each forced by a real finding:

1. **`withTrustedKeys(receipt, PUBLISHED_KEY_DIRECTORY)`** — `CONFIRMED`: a
   receipt carries its own `key_directory`, so a forger running their own plane
   produces a receipt that verifies `ok: true` with zero reasons. Merging our
   published keys over the embedded ones defeats same-`key_id` substitution.
2. **`key_id` allow-list** — `CONFIRMED`: a forger using a *different* `key_id`
   does not collide during the merge, so the merge alone is insufficient. The
   signer's `key_id` must be checked against the published set.
3. **`inclusion.status === "pass"`** — `CONFIRMED` tamper case 16: stripping
   **both** `inclusion` and `sth` yields `ok: true`, because `ok` permits
   `inclusion: absent`. Relying on `verdict.ok` alone would let an attacker
   silently remove the proof that a record was ever logged.

`expectedMeasurement` is pinned too: `CONFIRMED` that a receipt from a different
image fails `enclave` with `measurement does not match the pinned image`.

Because keys and the measurement are pure functions of
`(applicationId, COOL_IMAGE_DIGEST)`, `PUBLISHED_KEY_DIRECTORY` and
`EXPECTED_MEASUREMENT` are generated once and committed as constants in
`lib/cool/identity.ts`, with `GET /api/cool/identity` exposing them for
independent verification.

### Where verification runs

Server-side (`POST /api/cool/verify`, Node runtime) is the authoritative path.
`CONFIRMED` that it also works in the browser (22 ms/receipt in Chromium), but
the vendor labels browser use untested, so client-side verification is at most a
P1 "verify it yourself, offline" affordance and is never the basis of a claim.

---

## 7. How a historical trail is reconstructed

The demo's climax is reconstruction, so this is the important sequence:

1. **Search** resolves a natural-language query to an `auditId` from the
   deterministic index. No CooL involvement.
2. **Audit → executions** and **execution → events** come from the product
   layer. `parentEventId` yields the causal chain.
3. **Events → receipts.** Each event's `CoolReference.receiptRef` loads the
   receipt from IndexedDB.
4. **Verification** runs per node and populates the integrity panel.
5. **Append-only check** (P1): `POST /api/cool/consistency` proves the current
   tree still contains the tree that existed when the audit was signed, using the
   STH stored with the hero execution.

The graph edges are VeriAudit's `parentEventId` links, not CooL's. CooL makes
each node tamper-evident; the causal structure is ours. Stating this clearly is
what keeps the integration honest.

---

## 8. Configuration

| Variable | Value | Purpose |
|---|---|---|
| `COOL_IMAGE_DIGEST` | e.g. `sha256:veriaudit-r2-v1` | seeds the simulated measurement, so keys and `key_id` are stable and pinnable. **Must match the value used to generate `identity.ts`.** |
| `COOL_DSTACK_ENDPOINT` | **must be unset** | `CONFIRMED`: if set, the provider resolves to `dstack` even without `attestation.provider`, and every request fails with `DstackUnavailableError` |
| `COOL_APP_ID` | `veriaudit` | `applicationId` |
| `COOL_LOG_ID` | `veriaudit-log` | recorded in every STH |

No secrets. `CONFIRMED`: signing keys are derived from the measurement, never
stored, so there is nothing to leak and nothing to rotate.

`security.requireAttestation` is **not** set — `CONFIRMED` that combining it with
`provider: "local"` throws `ConfigurationError` at construction, and no hardware
is available.

---

## 9. Error handling

Per guideline §15, failures surface rather than hide.

| Failure | Behaviour |
|---|---|
| `record()` throws (`EvidenceError`) | the VeriAudit event is still created and persisted with `cool: null`, labelled **"evidence unavailable"**. The audit never fails because sealing failed |
| `verifyEvidence` returns `ok: false` | show **FAILED**, the failing domains, and the real `reasons[]`. Never display VERIFIED without a passing verdict |
| Receipt missing from IndexedDB | **"receipt not in this session"** — distinct from a failed verification, and offer re-running the audit |
| `DstackUnavailableError` | configuration error; surfaces in dev with the SDK's `action` hint |
| `verifyConsistency` throws | wrapped in try/catch — `CONFIRMED` it is not throw-free, unlike `verifyEvidence` |

---

## 10. Making the integration visible to a judge

Per guideline §14, compact by default:

```text
Cryptographic Evidence
✓ Recorded    finding.created · 01M2CXYGCF3GZPKSD8G8V93R7V
✓ Verified    binding · signature · inclusion
~ Simulated   attestation · enclave   (no hardware root of trust)
              Receipt: mh:sha256:55f0869d…   [technical details ▾]
```

Expanding shows the full 7-domain table, the `key_id`, the measurement, the leaf
index and tree size, and the raw receipt JSON. The `~ Simulated` row is shown
deliberately, not hidden: the vendor's `HACKATHON.md` is explicit that
`attestation` and `enclave` read `simulated`, never `pass`, and that blurring the
distinction defeats the project's purpose.
