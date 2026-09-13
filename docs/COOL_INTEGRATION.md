# CooL Integration

How VeriAudit uses CooL. Every API here is `CONFIRMED` in `COOL_SDK_AUDIT.md` —
read that first for the evidence.

> **Status: IMPLEMENTED as of Milestone 1, wired to the audit engine in
> Milestone 2.** §§4–6 were written as specifications and are now code. Where
> the implementation diverged from the spec, this document reflects the code and
> says why. The integration is proved end to end, locally and on Vercel — see
> `DEPLOYMENT.md` §11.

### As-built module map

| File | Role |
|---|---|
| `lib/cool/types.ts` | the boundary's types; imports no SDK code, so the product layer can describe events without pulling in `cool-nwc` |
| `lib/cool/config.ts` | `APP_ID`, `IMAGE_DIGEST`, `LOG_ID`, software identity |
| `lib/cool/identity.generated.ts` | **committed** pin: measurement, key directory, allow-lists |
| `lib/cool/identity.ts` | pinned constants + live derivation + drift assertion |
| `lib/cool/canonical.ts` | `canonicalEventPayload`, `contentDigest` |
| `lib/cool/log-state.ts` | `rehydrate`, `proveAppendOnly`, `asMultihash` |
| `lib/cool/recorder.ts` | `recordEvents` — the only caller of `tee.record` |
| `lib/cool/verifier.ts` | `verifyReceipt` + `TrustPolicy` |
| `lib/cool/index.ts` | the barrel, carrying `import "server-only"` |
| `scripts/cool-identity.ts` | regenerates the pin |
| `lib/proof/*`, `scripts/proof-http.ts` | proof harness; not product code |
| `lib/audit/run.ts` | `[M2]` audit → events → `recordEvents` → receipts |
| `lib/audit/review.ts` | `[M2]` a live human decision → `recordEvent` |
| `lib/audit/integrity.ts` | `[M3]` bind receipts to tree leaves + rehydrate the root |

**How the audit engine reaches CooL.** The scenarios, the engine, the event
manager, the query helpers, the append-only trail, and the id minting never
import `lib/cool/` at all — only `run.ts`, `review.ts`, and `integrity.ts` do.
So `cool-nwc` calls are not scattered through scenario code (guideline Rule 3,
one level up), and sections A–D of the Milestone 2 test suite run in ~370 ms
without standing up an evidence plane.

**Trail integrity, as of Milestone 3.** `verifyTrail` does three things, in
order, and all three must hold for `status: "verified"`:

1. each sealed receipt still satisfies the Milestone 1 production policy
2. each receipt is bound to the event it claims — `binding_hash` equals
   `logState[leafIndex]`, and the receipt's `type` / `execution_id` match
3. `fingerprintLogState(logState)` rebuilds the RFC 6962 tree from the public
   hashes alone and the root equals the captured tree head

A genuine receipt sitting on the wrong event fails (2) while still passing
(1). That is deliberate: CooL attests authenticity, the tree attests position.
`TODO` (P1): `POST /api/cool/consistency` as a dedicated route. The proof
itself is already callable via `proveTrailContinues`.

Two deviations from the spec, both deliberate:

1. **`CoolTee` instead of the high-level `CooL` client.** `CooLOptions` has no
   `log` seam, so the high-level client cannot be given a shared tree and every
   record would land at `leaf 0 / tree 1`. `CoolTee.connect({ app, dstack, log })`
   accepts the injected `MemoryLog`, which §5 depends on.
2. **`verifyReceipt` takes an optional `TrustPolicy`.** Production callers pass
   nothing. Tests pass a policy to isolate one trust check at a time — a matrix
   where several checks always fail together cannot show that any one of them is
   load-bearing.

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

`CONFIRMED` in Milestone 2 — and for **all four scenarios**, not just the hero.
Every scenario seals exactly nine events, because the selection is one
representative per stage rather than a fraction of the total. Legal (22 events),
cyber (25), and procurement (23) each seal nine; the hero's 30 also seal nine.
Verified by test D5 and by `scripts/proof-audits.ts`.

The nine are chosen so they form an **unbroken parent chain** from
`audit.started` to `conclusion.created` — see `EVENT_MODEL.md` §3. That property
is what this selection strategy is actually buying: reconstructing "why did this
conclusion happen?" walks a path on which every step is sealed.

One addition beyond the plan: a **live human review** (`POST
/api/audits/:id/reviews`) is sealed on its own, appended to the same tree as
leaf 9. A reviewer acting now is exactly the kind of act that has to be
tamper-evident, and it is the one thing in the product that is genuinely not
reproducible. `CONFIRMED` verifying, test E9.

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

Canonicalisation is split from recording: `canonicalEventPayload` is a pure
function with no SDK dependency, so the committed payload is testable on its own
and the recorder only has to seal it.

```ts
// lib/cool/canonical.ts  (as built)
export function canonicalEventPayload(event: VeriAuditEvent): CanonicalEventPayload {
  return {
    schema: "veriaudit.event.v1",
    actor: event.actor,                              // "ai" | "human" | "system"
    artifact_ids: [...event.artifactRefs].sort(),
    audit_id: event.auditId,
    detail: sortDeep({ ...event.detail }),           // control id, severity, counts…
    event_id: event.eventId,
    event_type: event.type,                          // "finding.created"
    execution_id: event.executionId,
    occurred_at: event.occurredAt,                   // logical time, not sealing time
    parent_event_id: event.parentEventId ?? null,
    scenario: event.scenario,
    sequence: event.sequence,
    summary: event.summary,
    title: event.title,
  };
}

// lib/cool/recorder.ts  (as built)
await tee.record({
  type: event.type,                  // cleartext, our dotted vocabulary
  executionId: event.executionId,    // ALWAYS explicit; groups the trail
  metadata: canonicalEventPayload(event),   // salted-hashed and discarded
  payloads: { input: event.inputPayload, output: event.outputPayload, state: undefined },
  software: { name: "veriaudit-audit-engine", version: SOFTWARE_VERSION, digest: null },
});
```

Determinism rules the canonicaliser enforces, beyond fixing key order:

- `detail` is **deep-sorted**, so two logically equal events commit identically
  regardless of how the product layer happened to build the object.
- `undefined` is never emitted. A missing key must not silently become a
  different committed value than an explicit `null`.
- `NaN`/`Infinity` and non-integer `sequence` values **throw** rather than being
  coerced, because a value that cannot round-trip cannot be re-verified.
- No wall-clock read, no request id, no UI state. The event's own `occurredAt`
  is included because the event asserts it; nothing the *caller* did not decide
  goes in.

`contentDigest(event)` exposes `mhSha256(canonicalCbor(payload))` — a salt-free,
reproducible id for the logical event. Distinct from `binding_hash`, which is
deliberately not reproducible (§7.2). A test asserts that recording the same
event twice yields the same `contentDigest` and different `bindingHash`.

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
// lib/cool/log-state.ts  (as built)
// LogState: ordered binding_hash strings, client-held, ~80 bytes each, no secrets
export type LogState = readonly `mh:sha256:${string}`[];

export function rehydrate(logKey: KeyPair, state: LogState): MemoryLog {
  const log = new MemoryLog(LOG_ID, logKey);       // (logId, logKey) — both required
  for (const bindingHash of state) log.append(recordLeafDataV2(bindingHash));
  return log;
}

// lib/cool/recorder.ts  (as built)
const dstack = newDstackClient();
const keys = await sealedKeys();                   // cached; derivation is deterministic
const log = rehydrate(keys.log, assertValidLogState(priorLogState));
const tee = await CoolTee.connect({ app: { name: APP_ID, imageDigest: IMAGE_DIGEST }, dstack, log });
```

`assertValidLogState` rejects anything that is not an ordered list of well-formed
`mh:sha256` hashes. That matters more than it looks: log state arrives over HTTP
and out of IndexedDB, and silently accepting a malformed value would start a
fresh tree — turning a tampered history into what looks like a brand-new,
perfectly valid one. Failing loudly is the only safe response.

`proveAppendOnly(logKey, previousHead, currentState)` wraps the RFC 6962
consistency proof and returns a reason string instead of throwing. It also
short-circuits when the log has *shrunk*, which no consistency proof would
catch meaningfully.

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
// lib/cool/verifier.ts  (as built)
export async function verifyReceipt(
  receipt: unknown,
  policy: TrustPolicy = PRODUCTION_POLICY,
): Promise<IntegrityState> {
  const pinned = withTrustedKeys(receipt as Evidence, policy.publishedKeyDirectory);
  const verdict = await verifyEvidence(pinned, {
    expectedMeasurement: policy.expectedMeasurement,
  });

  const signerTrusted = policy.trustedRecordKeyIds.has(seen.keyId);
  const measurementMatches = measurementDiff(seen.measurement, policy.expectedMeasurement).length === 0;
  const logged = verdict.checks.inclusion.status === "pass";

  const ok = verdict.ok && signerTrusted && measurementMatches && logged;
  // …plus per-check `failures` with actionable text, and `claim`.
}
```

**Four** things beyond `verdict.ok`, each forced by a real finding:

1. **`withTrustedKeys(receipt, PUBLISHED_KEY_DIRECTORY)`** — `CONFIRMED`: a
   receipt carries its own `key_directory`, so a forger running their own plane
   produces a receipt that verifies `ok: true` with zero reasons. Merging our
   published keys over the embedded ones defeats same-`key_id` substitution.
2. **`key_id` allow-list** — `CONFIRMED`: a forger using a *different* `key_id`
   does not collide during the merge, so the merge alone is insufficient. The
   signer's `key_id` must be checked against the published set.
3. **`inclusion.status === "pass"`** — `CONFIRMED` tamper case 16: a receipt with
   `inclusion` and `sth` set to `null` yields `ok: true` with zero reasons,
   because `ok` permits `inclusion: absent`. Relying on `verdict.ok` alone would
   let an attacker silently remove the proof that a record was ever logged.
4. **An explicit measurement comparison**, in addition to passing
   `expectedMeasurement` to the SDK. The SDK reports a mismatch inside the
   `enclave` domain, mixed with other causes; comparing the registers ourselves
   yields a specific, actionable reason naming which registers differ.

`expectedMeasurement` is pinned too: `CONFIRMED` that a receipt from a different
image fails `enclave` with `measurement does not match the pinned image`.

### Why the pin is a committed file

Keys and the measurement are pure functions of `(applicationId, imageDigest)`,
so they could be derived at runtime — but a pin derived from the same
environment variable it is meant to police proves nothing, since an attacker who
can set `COOL_IMAGE_DIGEST` just moves the pin with it.

So `lib/cool/identity.generated.ts` is **generated once and committed**
(`npm run cool:identity`), and verification pins against the committed file.
`lib/cool/identity.ts` additionally derives the live identity and compares, so
configuration drift fails loudly rather than showing up as what looks like
tampering. `GET /api/cool/identity` exposes both, with `pin.matches`.

The file holds only public keys and a public measurement — no secret is
involved, which is what makes committing it safe.

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

**Every variable is optional.** The defaults are the values the committed pin was
generated against, so a zero-configuration deployment works — `CONFIRMED` on
Vercel with no environment variables set. An unset variable in production is a
likely mistake, so the safe path is the default one.

| Variable | Default | Purpose |
|---|---|---|
| `COOL_IMAGE_DIGEST` | `sha256:veriaudit-r2-v1` | seeds the simulated measurement, so keys and `key_id` are stable and pinnable. **Must match the value `identity.generated.ts` was built against**, or every verification fails on the measurement check |
| `COOL_DSTACK_ENDPOINT` | unset — **keep it unset** | `CONFIRMED`: if set, the provider resolves to `dstack` even without `attestation.provider`, and every request fails with `DstackUnavailableError`. `GET /api/cool/identity` warns if it is set |
| `COOL_APP_ID` | `veriaudit` | `applicationId` |
| `COOL_LOG_ID` | `veriaudit-log` | recorded in every STH |

No secrets. `CONFIRMED`: signing keys are derived from the measurement, never
stored, so there is nothing to leak and nothing to rotate.

### Routes as built

| Route | Runtime | Purpose |
|---|---|---|
| `GET /api/cool/identity` | `nodejs` | the published identity + `pin.matches` |
| `POST /api/cool/record` | `nodejs` | `{ events, logState }` → receipts + updated `logState` |
| `POST /api/cool/verify` | `nodejs` | `{ receipt }` or `{ receipts }` → `IntegrityState` |
| `GET /api/cool/selftest` | `nodejs` | the full 13-case tamper matrix, server-side. Proof-only; removed before ship |

A receipt that fails verification is a **200** with `status: "failed"`, not an
HTTP error — "this evidence is bad" is a successful answer to the question, and
conflating it with a transport failure would make the UI's job harder.

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
