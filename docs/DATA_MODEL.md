# Data Model

Minimum viable schema for the demo. Per guideline §7: keep it simple, no
enterprise database model in an 8-hour build.

There is **no database**. These are TypeScript types over data that is either
regenerated deterministically from a seed or held in session storage
(`ARCHITECTURE.md` §4).

> **Milestone 5 status.** Search hits and reconstruction views sit on top of
> `Activity` / `Audit` / `Execution`. See `SEARCH_SPEC.md`.
>
> **Milestone 4 status.** `Audit`, `Execution`, `Event`, `Artifact`, `Finding`,
> `HumanReview`, `Receipt`, and `Activity` are built. `Activity` lives in
> `lib/simulation/types.ts` — it is historical feed data, not a second event
> model. Where the built types differ from what was originally specified here,
> the difference is marked and explained rather than quietly edited away.

---

## 1. Entities

```mermaid
erDiagram
  AUDIT      ||--o{ EXECUTION : "has"
  AUDIT      ||--o{ ARTIFACT  : "scopes"
  EXECUTION  ||--o{ EVENT     : "emits"
  EVENT      ||--o| EVENT     : "parent of"
  EVENT      }o--o{ ARTIFACT  : "references"
  EVENT      ||--o| RECEIPT   : "backed by"
  EXECUTION  ||--o{ FINDING   : "produces"
  FINDING    ||--o| HUMANREVIEW : "reviewed by"
  AUDIT      ||--o{ ACTIVITY  : "appears as"
```

| Entity | Synthetic? | References CooL? | Count in the demo | M2 |
|---|---|---|---|---|
| `Audit` | yes, authored | no | 14 (1 hero + 13 simulated) | 4 built |
| `Execution` | yes, authored | indirectly, via events | ~18 | 4 built |
| `Event` | yes, computed | **yes**, `cool` reference | 30 for the hero; ~0 for simulated | `CONFIRMED` 30 |
| `Artifact` | yes, authored | committed in payloads | 4 for the hero | `CONFIRMED` 4 |
| `Finding` | yes, deterministic | via its `finding.created` event | 3 for the hero | `CONFIRMED` 3 |
| `HumanReview` | yes, deterministic | via `human.review.completed` | 3 for the hero | `CONFIRMED` 3 |
| `Receipt` | **no — real CooL output** | it *is* the CooL artifact | 9 for the hero | `CONFIRMED` 9 |
| `Activity` | yes, seeded | no | 50+ history rows | `TODO` M4 |

Only `Receipt` is genuinely produced by cryptography. Everything else is
synthetic scenario data, and the README and UI say so.

Across the four scenarios as built:

| Scenario | Controls | Pass | Exceptions | Findings | Reviews | Events | Sealed |
|---|---|---|---|---|---|---|---|
| financial (hero) | 12 | 9 | 3 | 3 | 3 | 30 | 9 |
| legal | 8 | 6 | 2 | 2 | 2 | 22 | 9 |
| cyber | 10 | 7 | 3 | 3 | 2 + **1 pending** | 25 | 9 |
| procurement | 9 | 7 | 2 | 2 | 2 (1 **rejected**) | 23 | 9 |

`CONFIRMED` by test A1 and by `scripts/proof-audits.ts`. Every scenario seals
exactly nine events because the canonical selection is one representative per
stage, not a fraction of the total.

### The `Scenario` entity — new in M2

Not in the original plan, and it is what makes one engine serve four domains. A
scenario carries its evidence, its controls (each a pure rule over that
evidence), its retrieval spec, its reasoner, its review policy, and an
`expected` block:

```ts
expected: { controlsTested: 12, controlsPassed: 9, exceptions: 3, findings: 3 }
```

`expected` is a **tripwire, not documentation**. The engine recomputes the result
and throws if it disagrees. Authored evidence and real rules can drift apart
silently, and a demo whose headline numbers changed without anyone noticing is
worse than one that fails loudly in CI.

---

## 2. Definitions

### Audit

```ts
type Audit = {
  auditId: string;              // "AUD-FIN-2026-09"
  scenario: "financial" | "legal" | "cyber" | "procurement";
  title: string;                // "September Revenue Recognition Audit"
  period: string;               // "2026-Q3"
  openedAt: string;             // RFC 3339, logical
  closedAt: string | null;
  status: "completed" | "in_review" | "open";
  isHero: boolean;              // exactly one true
  executionIds: string[];
  artifactIds: string[];
  summary: {
    controlsTested: number;     // 12
    controlsPassed: number;     //  9
    exceptions: number;         //  3
    humanReviewCompleted: boolean;
  } | null;
  searchTags: string[];         // feeds the index — see SEARCH_SPEC.md
};
```

### Execution

```ts
type Execution = {
  executionId: string;          // "EXEC-FIN-2026-09-001" — the CooL executionId
  auditId: string;
  startedAt: string;
  completedAt: string | null;
  engine: { name: string; version: string };
  eventIds: string[];           // causal order
  rootEventId: string;
  coolBacked: boolean;          // true only for the hero in P0
  logHead: {                    // the STH captured when this execution was sealed
    logId: string;
    treeSize: number;
    rootHash: string;
  } | null;
};
```

`logHead` is what makes the append-only demo possible: months later we can prove
today's tree still contains the tree that existed when this execution was signed.
`CONFIRMED` working via `consistencyProof` / `verifyConsistency`.

As built in Milestone 3 (`executionView` / `ExecutionSnapshot`):

```ts
type ExecutionSnapshot = {
  executionId: string;
  auditId: string;
  eventCount: number;           // 30 for the hero
  sealedCount: number;          // 9 for every scenario in P0
  firstEvent: { eventId, type, occurredAt, sequence } | null;
  lastEvent: { eventId, type, occurredAt, sequence } | null;
  rootEventId: string;
  treeHead: { logId, treeSize, rootHash } | null;
  verificationStatus: "verified" | "failed" | "unavailable" | "not-recorded";
  verifiedAt: string | null;
};
```

`GET /api/audits/:id/execution` returns this plus `why` — the causal path from
the conclusion to the root. Regenerated GETs have `treeHead: null` and
`verificationStatus: "not-recorded"` because receipts cannot be reproduced.
`POST /api/audits/:id/integrity` with the session's receipts and `logState`
is what produces `verified`.

### Event

Defined in full in `EVENT_MODEL.md` §2. Key fields: `eventId`, `auditId`,
`executionId`, `sequence`, `type`, `actor`, `occurredAt`, `parentEventId`,
`artifactRefs`, `title`, `summary`, `detail`, `inputPayload`, `outputPayload`,
`cool`.

### Artifact

```ts
type Artifact = {
  artifactId: string;           // "ART-FIN-001"
  auditId: string;
  kind: "revenue_ledger" | "contract" | "approval_log" | "policy" | "access_export" | "vendor_file";
  title: string;                // "Q3 Revenue Ledger Extract"
  mimeType: string;
  rows: number | null;
  content: string;              // the synthetic plaintext VeriAudit holds
  contentCommitment: string | null;  // mh:sha256:… once it has been committed
  ingestedAt: string;
  citedByEventIds: string[];
};
```

`content` is synthetic and stays in VeriAudit. What reaches CooL is a commitment,
so the evidence viewer can show the plaintext next to the commitment and let a
judge recompute it — `CONFIRMED` that `saltedCommit(salt, plaintext)` reproduces
the stored commitment and an altered plaintext does not.

### Finding

```ts
type Finding = {
  findingId: string;            // "F-FIN-001"
  auditId: string;
  executionId: string;
  controlId: string;            // "REV-REC-01"
  severity: "high" | "medium" | "low";
  title: string;                // "Revenue recognised before performance obligation satisfied"
  description: string;          // what happened, in one or two sentences
  rationale: string;            // why the control failed, naming the figures
  recommendedAction: string;    // what to do about it
  evidenceArtifactIds: string[];
  observed: Record<string, JsonValue>;  // the figures the rule saw
  amountUsd: number | null;
  status: "open" | "accepted" | "modified" | "rejected";
  reviewRequired: boolean;
  reviewId: string | null;
  originalSeverity: Severity | null;    // set when a reviewer changed it
};
```

Four fields were added during M2, each for a stated reason:

- `description` / `recommendedAction` — the plan had only `rationale`, which
  conflated "what happened", "why the rule failed", and "what to do". A judge
  asking *"what did the AI find?"* wants the first; an auditor wants all three.
- `observed` — the specific figures the rule saw. Without it a finding is an
  assertion; with it a reader months later can check the arithmetic. This is
  also what `control.tested` and `finding.created` commit to CooL.
- `reviewRequired` — distinguishes *"a person declined to change this"* from
  *"no person has looked at this yet"*. Both would otherwise be `status: "open"`.
- `originalSeverity` — when a reviewer modifies severity, both values are kept.
  Overwriting the AI's original judgement would erase the human intervention the
  product exists to record.

`eventId` was **dropped** from `Finding`: the finding is created by its event, so
the reference runs event → finding (`findingRef`), not both ways. The API adds
`eventId` back when it joins them, so no consumer loses anything. Two mutable
pointers that must agree is a bug waiting to happen.

**Status vocabulary.** The Milestone 2 brief names these PENDING / APPROVED /
MODIFIED / REJECTED. They are the same four states under the names this document
already used (`open` / `accepted` / `modified` / `rejected`), kept so the
documented schema and the code do not diverge. `open` is PENDING. Test C5
asserts all four occur across the scenarios.

### HumanReview

```ts
type HumanReview = {
  reviewId: string;             // "REV-FIN-001" baseline · "REV-FIN-001-L030" live
  findingId: string;
  reviewer: { name: string; role: string };
  decision: "accepted" | "modified" | "rejected";
  note: string;                 // required and non-empty: an unexplained
                                // decision is not auditable
  reviewedAt: string;
  modifiedSeverity: Finding["severity"] | null;
};
```

Two kinds of review exist as built, and the distinction matters:

| | Source | Deterministic? | Sealed |
|---|---|---|---|
| **baseline** | the scenario's `reviewPolicy.decisions` | yes — part of the reproducible result | with the canonical nine |
| **live** | `POST /api/audits/:id/reviews` | no — a person acting now | on its own, appended to the tree |

A live decision never edits a baseline one. Events are append-only
(`EVENT_MODEL.md` §3 rule 5), so it appends a second
`human.review.completed` whose parent is the *same* `finding.created` event. A
reader sees both decisions in order, which is the honest representation of a
reviewer changing their mind. Live review ids carry an `-L<sequence>` suffix so
the two can never be confused.

`eventId` was dropped for the same reason as on `Finding`.

### Receipt (the CooL artifact)

```ts
type StoredReceipt = {
  receiptRef: string;           // IndexedDB key = `${executionId}:${eventId}`
  eventId: string;
  evidence: unknown;            // the verbatim cool.receipt.v2 envelope, ~30 KB
  storedAt: string;
};
```

The envelope is stored **verbatim and never normalised**. `CONFIRMED`:
`JSON.parse(JSON.stringify(evidence))` still verifies, but any reformatting of
numbers or keys would break `binding_hash` — which is the tamper detection
working as designed.

The compact `CoolReference` that lives on the event is defined in
`COOL_INTEGRATION.md` §4.

### Activity (the history feed row)

```ts
type Activity = {
  activityId: string;           // "ACT-0042"
  occurredAt: string;           // RFC 3339, logical
  type: "audit" | "control_test" | "evidence_review" | "finding"
      | "follow_up" | "human_review" | "compliance_check"
      | "vendor_review" | "access_review";
  title: string;
  auditId: string | null;       // links back to an audit when there is one
  executionId: string | null;
  status: "completed" | "exception" | "in_review" | "scheduled";
  findingId: string | null;
  actor: "ai" | "human" | "system";
  searchTags: string[];
  coolBacked: boolean;          // true only for hero rows in P0
};
```

This is the entity the guideline §11 asks for: timestamp, title, type, audit
association, status, optional finding, optional execution id.

As built in Milestone 4, the type also carries `scenario`, `description`, and
`searchTags`. `activityId` is `ACT-0001`…`ACT-0055` after newest-first sort, so
the oldest hero cluster is `ACT-0053`–`ACT-0055` on a given seed. `coolBacked`
is `true` only for hero-audit rows; simulated history never claims a receipt.

`CONFIRMED`: 55 activities, 14 audits, hero `AUD-FIN-2026-09` /
`EXEC-FIN-2026-09-001` unchanged. See `SIMULATION_SPEC.md`.

---

## 3. Identifiers and determinism

| Id | Format | Stable across regeneration? |
|---|---|---|
| `auditId` | `AUD-<SCN>-<YYYY>-<MM>` | **yes** — seeded |
| `executionId` | `EXEC-<SCN>-<YYYY>-<MM>-<NNN>` | **yes** |
| `eventId` | `EVT-<SCN>-<YYMM>-<NNN>` | **yes** |
| `artifactId` / `findingId` / `reviewId` / `activityId` | `ART-`/`F-`/`REV-`/`ACT-` + counter | **yes** |
| live `reviewId` | `REV-FIN-001-L030` — baseline id + `-L<sequence>` | no, by design |
| `cool.recordId` | ULID from the SDK | **no** |
| `cool.bindingHash` | `mh:sha256:…` | **no** — `CONFIRMED`, fresh salt per record |
| `cool.keyId` | `cool-enclave-<10 hex>` | **yes** — pure function of `(appName, COOL_IMAGE_DIGEST)` |

The rule this produces: **never join on a CooL identifier.** VeriAudit ids are
the primary keys; CooL ids are attributes of one sealing.

### How finding ids get assigned — `CONFIRMED`

Findings are ranked by **severity descending, then control id**, and numbered
from `001`. So the hero audit's `F-FIN-001` is the high-severity revenue
recognition finding, and it stays `F-FIN-001` no matter where `REV-REC-01` sits
in the control list. The demo searches for a specific finding id, so that id
falling out of the data rather than being hard-coded is what keeps the search
target stable as controls are edited.

Consequence for the hero audit: `F-FIN-001` → `REV-REC-01` (high),
`F-FIN-002` → `APR-CHAIN-06` (medium), `F-FIN-003` → `SEG-DUT-10` (medium,
reduced to low on review). Asserted by test B5.

---

## 4. Indexes and search fields

No database, so "indexes" are in-memory structures built at load
(`SEARCH_SPEC.md`):

| Index | Over | Used for |
|---|---|---|
| inverted token index | `title`, `summary`, `searchTags` of `Audit`, `Activity`, `Finding`, `Event` | full-text search |
| `byAuditId` | `Execution`, `Event`, `Artifact`, `Finding`, `Activity` | opening an audit |
| `byExecutionId` | `Event` | building the trail |
| `byParentEventId` | `Event` | causal graph edges |
| `byDate` | `Activity`, sorted descending | the history feed and date filters |
| `byType` / `byStatus` | `Activity`, `Event` | facet filters |
| `byReceiptRef` | `StoredReceipt` (IndexedDB key) | loading a receipt on demand |

Guaranteed search targets for the hero audit: `revenue recognition`,
`revenue recognition exception`, `approval missing`, `September revenue audit`,
`REV-REC-01`, `F-FIN-001`. Asserted by a test.

---

## 5. Storage footprint

| What | Size | Where |
|---|---|---|
| Generated corpus (14 audits, ~18 executions, 50+ activities, 30 hero events) | ~150 KB in memory | regenerated |
| 9 hero receipts | ~270 KB | IndexedDB |
| `logState` | ~2.5 KB | IndexedDB |
| `CoolReference` per event | ~330 bytes each | with the event |

Comfortable. The number that constrains the design is 30 KB/receipt
(`COOL_SDK_AUDIT.md` §8), which is why receipts are fetched on demand and never
embedded in list responses.
