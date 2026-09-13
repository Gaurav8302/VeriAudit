# Event Model

The event model is what makes VeriAudit more than a log viewer. Per guideline
Rule 7: events must carry relationships, not be isolated lines.

---

## 1. Event types

VeriAudit's vocabulary, taken from the source of truth §6. The `type` string is
passed straight through to `cool.record({ type })`, so the same vocabulary
appears in the receipts.

| `event_type` | Actor | CooL-backed (P0) | Meaning |
|---|---|---|---|
| `audit.started` | system | yes | an audit engagement began |
| `artifact.ingested` | system | yes | a synthetic evidence artifact entered scope |
| `artifact.parsed` | ai | yes | an artifact was interpreted into structured figures |
| `retrieval.executed` | ai | yes | relevant evidence was selected for the model |
| `model.executed` | ai | yes | the reasoning step ran |
| `control.tested` | ai | yes | one control was evaluated to pass/exception |
| `finding.created` | ai | yes | an exception became a reportable finding |
| `human.review.requested` | system | P1 | the finding was routed for human verification |
| `human.review.completed` | human | yes | a reviewer accepted / modified / rejected it |
| `conclusion.created` | system | yes | the audit's final aggregate result |
| `tool.executed` | ai | P1 | an auxiliary tool call |

`CONFIRMED` — all of these were recorded and verified against the real SDK as an
8-event chain sharing one `executionId`, every receipt `ok: true` with a real
audit path (`COOL_SDK_AUDIT.md` §4).

---

## 2. Event shape

```ts
type VeriAuditEvent = {
  // identity
  eventId: string;              // "EVT-FIN-2609-004" — deterministic, ours
  auditId: string;              // "AUD-FIN-2026-09"
  executionId: string;          // "EXEC-FIN-2026-09-001" — passed to CooL
  sequence: number;             // 0-based position within the execution

  // classification
  type: EventType;
  actor: "ai" | "human" | "system";
  occurredAt: string;           // RFC 3339, LOGICAL time from the simulated clock

  // software identity (mirrors CooL's `software` block)
  software: { name: string; version: string; digest: string | null };

  // causality
  parentEventId: string | null;
  childEventIds: string[];      // derived, not stored twice

  // references
  artifactRefs: string[];       // ARTIFACT ids this event consumed or produced
  findingRef: string | null;
  reviewRef: string | null;

  // content
  title: string;                // human-readable, shown on the node
  summary: string;              // one or two sentences, shown on expand
  detail: Record<string, unknown>;  // type-specific structured fields

  // payload commitments (the plaintexts VeriAudit holds; CooL holds only hashes)
  inputPayload: string | undefined;
  outputPayload: string | undefined;

  // CooL
  cool: CoolReference | null;   // null = honestly "no cryptographic evidence"
  verification: VerificationState | null;  // last computed, never persisted as truth
};
```

### Field-by-field mapping to CooL

| VeriAudit field | Where it lands in the receipt |
|---|---|
| `type` | `record.event.type` — cleartext |
| `executionId` | `record.event.execution_id` — cleartext |
| `eventId`, `auditId`, `parentEventId`, `sequence`, `actor`, `occurredAt`, `summary`, `detail`, `artifactRefs` | inside `metadata`, committed as `record.event.metadata_hash` + `metadata_salt` — **not recoverable from the receipt** |
| `software` | `record.event.software` — cleartext by design |
| `inputPayload` | `record.event.commitments.input` + `input_salt` |
| `outputPayload` | `record.event.commitments.output` + `output_salt` |
| — | `record.record_id`, `record.time.issued_at`, `time.seq`, `runtime.*`, `signature`, `binding_hash`, `inclusion`, `sth`, `attestation`, `key_directory` are produced by the SDK |

`CONFIRMED` — the receipt leaks none of the metadata values. A search for
`"AUD-FIN-2026-09"`, `"REV-REC-01"`, `"C-1001"`, `"high"`, and the conclusion
text in the serialised receipt returned `false` for all five.

### Two clocks, deliberately

- `occurredAt` — VeriAudit's **logical** time. The hero audit is dated ~3 months
  before "today" so history can bury it. Committed inside `metadata`.
- `record.time.issued_at` — CooL's **sealing** time, set by the plane, always
  "now".

These differ, and the UI must not present the sealing time as when the audit
happened. What CooL attests is "this content was sealed at `issued_at` and has
not changed since" — not "this happened three months ago". Called out in
`SECURITY_AND_CLAIMS.md`.

---

## 3. Relationships

The canonical causal spine, one edge per `parentEventId`:

```mermaid
flowchart LR
  A["audit.started"] --> B["artifact.ingested"]
  B --> C["artifact.parsed"]
  C --> D["retrieval.executed"]
  D --> E["model.executed"]
  E --> F["control.tested"]
  F --> G["finding.created"]
  G --> H["human.review.completed"]
  H --> I["conclusion.created"]
```

Matching the source of truth §7 exactly:

```text
Source Evidence → Retrieval → Model Execution → Control Test
              → Finding → Human Review → Final Conclusion
```

Rules:

1. Exactly one root per execution: `audit.started`, with `parentEventId: null`.
2. Every other event has exactly one parent — a tree, so reconstruction is
   unambiguous and no layout algorithm is needed.
3. `artifact.ingested` may fan out (one per artifact) and `control.tested` may
   fan out (one per control). The hero trail **collapses fan-out into one
   representative node per stage** with a count badge, so the graph stays the
   eight-node spine a judge can read in seconds.
4. `sequence` is monotonically increasing in causal order and equals the order in
   which events were recorded to CooL — so `sequence` and `inclusion.leaf_index`
   move together within an execution.
5. Events are append-only. A correction is a new event, never an edit. This is
   what makes the CooL receipts meaningful: a mutable event would have a
   receipt that no longer matches it.

### Full hero fan-out (what is generated vs. displayed)

```text
audit.started                                    1 event
└── artifact.ingested          × 4 artifacts     4 events   (1 node, "4 artifacts")
    └── artifact.parsed        × 4               4 events   (1 node)
        └── retrieval.executed × 1               1 event
            └── model.executed × 1               1 event
                └── control.tested × 12          12 events  (1 node, "12 controls / 3 exceptions")
                    └── finding.created × 3      3 events   (3 nodes — these matter individually)
                        └── human.review.completed × 3  3 events
                            └── conclusion.created × 1   1 event
                                                 = 30 events
```

**P0 decision:** generate all 30 as product events, but CooL-record the **nine
canonical representatives** (`COOL_INTEGRATION.md` §3) — 9 × 30 KB ≈ 270 KB and
~150 ms. `TODO` (P1): record all 30 if the Vercel timing test leaves room.

---

## 4. Event identifiers

Deterministic and human-legible, so search and demo scripts can reference them:

```text
AUD-FIN-2026-09            audit
EXEC-FIN-2026-09-001       execution
EVT-FIN-2609-004           event      (audit short code + zero-padded sequence)
ART-FIN-001                artifact
F-FIN-001                  finding
REV-FIN-001                human review
```

`INFERRED` design choice: these are VeriAudit's ids and are stable across
regenerations because the generator is seeded. CooL's `record_id` (a ULID) and
`binding_hash` are **not** stable — `CONFIRMED` in `COOL_SDK_AUDIT.md` §7.2,
since `randomSalt()` draws fresh bytes per record. So a `binding_hash` must never
be used as a logical event identifier; it identifies one sealing of that event.

---

## 5. Verification state

Computed, never persisted as truth — recomputed from the receipt whenever shown:

```ts
type VerificationState = {
  status: "verified" | "failed" | "unavailable" | "not-recorded";
  verdictOk: boolean;          // verifyEvidence().ok
  signerTrusted: boolean;      // key_id in the published allow-list
  logged: boolean;             // inclusion.status === "pass"
  domains: Record<Domain, { status: DomainStatus; detail: string }>;
  reasons: string[];           // the SDK's own strings, shown verbatim on failure
  checkedAt: string;
};
```

Four distinct states, because collapsing them would be dishonest:

- `verified` — verdict `ok`, signer trusted, and inclusion passed.
- `failed` — a domain failed. Show the failing domains and the SDK's `reasons`.
- `unavailable` — the receipt is not in this session's store. **Not** a failure.
- `not-recorded` — no CooL receipt was ever created (all simulated history).

---

## 6. Persistence

| Data | Where | Why |
|---|---|---|
| Events, audits, artifacts, findings, reviews | regenerated from the seed | deterministic, identical on every instance and cold start |
| `CoolReference` per event | with the event, in session state | ~330 bytes |
| Full receipts (~30 KB) | IndexedDB, keyed by `receiptRef` | too large for `localStorage` |
| `logState` (ordered `binding_hash[]`) | IndexedDB + sent with each record call | rehydrates the RFC 6962 tree; ~80 bytes/event, no secrets |
| Hero execution's STH | IndexedDB | the "three months ago" tree head for the append-only proof |

See `DATA_MODEL.md` for entity detail and `ARCHITECTURE.md` §4 for why there is
no database.
