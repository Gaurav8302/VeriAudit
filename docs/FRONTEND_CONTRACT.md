# Frontend Contract

Authoritative contract between the VeriAudit backend and any frontend
(including Fable 5). Source of truth: the routes that exist today. Tags:
`CONFIRMED` / `INFERRED` / `TODO` / `UNKNOWN`.

> **Milestone 6A.** This document describes what the frontend **may ask** and
> what it **must not invent**. The locked demo uses these APIs. The product
> application at `/product` reads the same catalog and reconstruction data and
> must not invent verification or AI. See [PRODUCT_APPLICATION.md](PRODUCT_APPLICATION.md).

---

## 1. Ownership

| Backend owns | Frontend owns |
|---|---|
| Audit execution and results | Current demo state (`lib/demo`) |
| Event trail and causal edges | Navigation and transitions |
| CooL receipts and verification | Presentation, animation, graph layout |
| Simulation corpus | Search input and filter controls |
| Search index and ranking | Visual hierarchy, copy layout |
| Reconstruction | Interaction |

The frontend must never fabricate findings, events, CooL verification,
integrity status, or conclusions.

Identifiers the frontend holds: `scenarioId`, `auditId`, `executionId`,
`simulationId`, `activityId`, `eventId`, `findingId`. Datasets stay on the
server (or in the session store for receipts).

---

## 2. Demo session (frontend only)

```ts
type DemoSession = {
  state: DemoState;
  phase: "ready" | "loading" | "error";
  pending: "catalog" | "run" | "simulate" | "search" | "reconstruct" | "verify" | null;
  selectedScenario: "financial" | "legal" | "cyber" | "procurement" | null;
  auditId: string | null;
  executionId: string | null;
  simulationId: string | null;
  searchQuery: string;
  selectedResultAuditId: string | null;
  selectedResultExecutionId: string | null;
  verificationStatus: "verified" | "failed" | "unavailable" | "not-recorded" | null;
  lastError: string | null;
};
```

Implemented in `lib/demo/state-machine.ts`. See `DEMO_STATE_MACHINE.md`.

Receipts and `logState` from `POST /api/audits/run` live in **session
storage** (IndexedDB is `TODO`). They are not fields on `DemoSession`.

---

## 3. Endpoints the demo uses

All product routes are Next.js App Router handlers, `runtime: "nodejs"`.
There is no database.

### 3.1 Scenario catalogue

```
GET /api/audits
```

Response `CONFIRMED`:

```ts
{
  heroScenarioId: "financial",
  scenarios: Array<{
    scenarioId: "financial" | "legal" | "cyber" | "procurement",
    displayName: string,
    description: string,
    isHero: boolean,
    auditId: string,
    executionId: string,
    title: string,
    period: string,
    controlsInScope: number,
    artifactsInScope: number,
    expected: { controlsTested, controlsPassed, exceptions, findings }
  }>
}
```

All four scenarios are available. Financial is the hero. Do not hardcode
the catalogue if this endpoint is reachable.

**Loading:** `pending: "catalog"`. **Error:** stay on `scenario_select` with
`phase: "error"`; retry GET. **Empty:** cannot happen if the server is up
(four authored scenarios).

### 3.2 Run an audit

```
POST /api/audits/run
Body: { scenario: "financial" | auditId, logState?: string[], seal?: boolean }
```

This is the **only** route that returns receipts.

Response includes `audit`, `trail`, `sealing`, `logState`, `receipts`.

Financial result (computed, not asserted): **12 / 9 / 3**.

`sealing.error !== null` means the audit completed but CooL was unavailable.
Show *"evidence unavailable"* — do **not** fail the audit, and do **not**
show VERIFIED.

The UI must not claim the model is still thinking after this response
returns. Any staged animation is presentation only.

**400** unknown/missing scenario. **500** unexpected engine failure.

### 3.3 Read an audit (regenerated)

```
GET /api/audits/:auditId
```

Same logical result as the run, but every event has `cool: null`. Receipts
cannot be regenerated. Re-attach from session storage.

Also: `GET .../events`, `.../events/:eventId`, `.../execution`,
`.../findings`, `.../reviews`, `.../integrity`.

### 3.4 Simulation

```
POST /api/simulation/start     → summary + activities + audit index
GET  /api/simulation           → full corpus
POST /api/simulation/reset     → same 55 rows; { reset: true, ...summary }
```

Idempotent. Same seed → same 55 activities. Never “generate random data.”
Copy: **“Three months later…”**

Summary fields: `simulationId`, `seed`, `startDate`, `endDate`,
`activityCount` (55), `auditCount` (14), `heroAuditId`, `heroExecutionId`,
`stats`.

Activities already bury the hero. Do not hide `AUD-FIN-2026-09` in the UI.

### 3.5 Search

```
GET /api/search?q=&after=&before=&since=&domain=&type=&audit=&status=&evidence=
```

| Param | Values |
|---|---|
| `q` | free text; empty → 55 activities newest first |
| `after` / `before` | ISO timestamps |
| `since` | `7` \| `30` \| `90` (vs `DEMO_TODAY`, not the wall clock) |
| `domain` | `financial` \| `legal` \| `cyber` \| `procurement` |
| `type` | activity or event type |
| `audit` | audit id |
| `status` | `completed` \| `exception` \| `in_review` \| `scheduled` \| `open` |
| `evidence` | `cool` \| `none` \| `any` |

Response: `{ query, tokens, total, results, groups, suggestions }`.

A hit (`CONFIRMED`):

```ts
{
  activityId, eventId, findingId, kind, title, description,
  timestamp, type, domain, auditId, executionId,
  relevance, matchedTerms, tags, status, coolBacked, snippet
}
```

`groups[0]` is the ranked audit. Hero queries:

- `revenue recognition exception`
- `why did we flag this revenue transaction`

both return `AUD-FIN-2026-09` / `EXEC-FIN-2026-09-001` first.

Explain relevance with `matchedTerms` and `relevance`. Do not invent an
LLM explanation. No embeddings.

Empty `q`: the history feed. Nonsense: `results: []` + suggestion chips.

### 3.6 Reconstruction

```
GET  /api/audits/:auditId/reconstruction
POST /api/audits/:auditId/reconstruction
     { receipts, logState, treeHead }
```

Engine audits (`AUD-FIN-2026-09` and the other three scenarios):

`kind: "engine"` with `audit`, `evidence`, `findings`, `reviews`,
`conclusion`, `retrieval`, `reasoning`, `controls`, `trail`, `why`,
`graph`, `integrity`.

`why.path` is the authoritative causal chain. **Do not reorder it.**

`graph.nodes[]`: `{ eventId, parentEventId, eventType, title, references }`.
The frontend only presents this.

Catalog-only simulated audits: `kind: "catalog"`,
`integrity.status: "not-recorded"`.

GET integrity is **`unavailable`** (no receipts). Never display VERIFIED
on GET. POST with the run's receipts runs real `verifyTrail`.

---

## 4. Verification semantics

Four statuses. Not a boolean.

| Status | Meaning | UI |
|---|---|---|
| `verified` | SDK verdict + allow-list + measurement + inclusion pass, receipts bound to leaves | “CooL verification passed” / “Execution integrity verified” / “Trusted execution identity verified” |
| `failed` | a check failed | “Integrity verification failed” + SDK reasons |
| `unavailable` | receipts not in this session | “Verification unavailable for this session” |
| `not-recorded` | no receipt was ever created | “no cryptographic evidence” |

Allowed vs forbidden claims: `lib/demo/copy.ts`.

VeriAudit does **not** prove the AI was objectively correct. The note in
`APPROVED_CLAIMS.notACorrectnessProof` must remain visible near a pass.

Forbidden: “100% trustworthy”, “AI cannot be wrong”, “Guaranteed authentic”,
“Blockchain verified”, “Tamper-proof forever”, “hardware-attested”.

Attestation/enclave domains are **simulated**. Show them as simulated.

---

## 5. Loading, error, empty

| Operation | `pending` | Success event | Failure event |
|---|---|---|---|
| Catalogue | `catalog` | stay `scenario_select` | `phase: error`, retry GET |
| Run audit | `run` | `audit_succeeded` | `audit_failed` — stay `running` |
| Simulation | `simulate` | `simulation_succeeded` | `simulation_failed` — stay `simulating` |
| Search | `search` | `search_succeeded` | `search_failed` — stay `search_results` |
| Reconstruction | `reconstruct` | `reconstruction_succeeded` | `reconstruction_failed` |
| Verify | `verify` | `verification_completed` | `verification_failed` or `status: failed` |

Do not invent progress percentages. The backend does not expose telemetry.
Staged “Evidence loaded / Controls tested …” may resolve when the **run
response** arrives, using counts from that payload.

Errors never become a later golden-path state. Retry is the recovery.

---

## 6. Reset

`transition(session, { type: "reset" })` → `welcome`, all ids cleared.

Also `POST /api/simulation/reset` so the corpus cannot be mistaken for
accumulated history. Do not rely on a full browser reload.

---

## 7. Identifiers and time

| Id | Example | Stable? |
|---|---|---|
| `auditId` | `AUD-FIN-2026-09` | yes |
| `executionId` | `EXEC-FIN-2026-09-001` | yes |
| `eventId` | `EVT-FIN-2609-001` | yes |
| `activityId` | `ACT-0001` | yes for a seed (newest first) |
| `cool.recordId` / `bindingHash` | ULID / `mh:sha256:` | **no** — do not join on these |

Logical time (`occurredAt`, `DEMO_TODAY = 2026-12-15T09:00:00.000Z`) is
what the UI shows. Sealing time `issued_at` is “now” and must not be
presented as when the audit happened.

---

## 8. CooL adapter routes (not the demo spine)

`GET /api/cool/identity`, `POST /api/cool/record`, `POST /api/cool/verify`,
`GET /api/cool/selftest`. The product demo should use `/api/audits/run`
and reconstruction/integrity. Adapter routes are for proofs and tamper
demos.

---

## 9. What does not exist

No search UI, no visual graph, no IndexedDB helper, no auth, no database,
no LLM search. `TODO` for a later milestone.

The product application (`/product`) is not a second API. It is a UI over the
existing catalog, scenarios, and `reconstructAudit` path. Landing and the demo
final screen both enter that same shell. The landing “Explore product” link
stays as a development shortcut beside the locked guided demo.

Product routes for the audit lifecycle:

```
/product/audits/[auditId]
/product/audits/[auditId]/executions
/product/audits/[auditId]/executions/[executionId]
/product/audits/[auditId]/executions/[executionId]/trace
/product/audits/[auditId]/trace
```

A trace is scoped to one execution. Reopen does not append events to the
original reconstruction. The frontend must not invent CooL verification for
the new execution.

Local create-audit, evidence, finding, and activity records live in the
product workspace store. They are unsealed. `/product/data` can download
authored files and a sample JSON dataset that says it is not a sealed export.

`POST /api/product/ai/analyze` returns one normalized reply plus structured
actions. `POST /api/product/evidence/ingest` fingerprints an upload. Neither
route exposes API keys. The Ask VeriAudit workspace is
`/product/audits/[auditId]/ai`.
