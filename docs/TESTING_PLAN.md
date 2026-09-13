# Testing Plan

Tests exist to protect the demo, not to chase coverage. Every test below maps to
a way the judging run could break.

Runner: **Vitest** (fast, zero-config with TypeScript, ESM-native — which matters
because `cool-nwc` is ESM-only). Browser path: Playwright, P0 for the one
end-to-end demo walk.

```sh
npm test              # unit + integration — 135 tests as of Milestone 6A
npm run typecheck
npm run proof:http    # 29 HTTP assertions against the CooL routes, any base URL
npm run proof:audits  # 45 HTTP assertions against the audit routes, any base URL
npm run test:e2e      # Playwright demo walk — TODO, lands with the UI
```

Current state:

| Suite | File | Tests | Status |
|---|---|---|---|
| CooL adapter | `tests/cool-adapter.test.ts` | 28 | `CONFIRMED` passing (M1) |
| Audit engine + scenarios + events | `tests/audit-engine.test.ts` | 42 | `CONFIRMED` passing (M2) |
| Execution trail | `tests/audit-trail.test.ts` | 15 | `CONFIRMED` passing (M3) |
| Simulation | `tests/simulation.test.ts` | 17 | `CONFIRMED` passing (M4) |
| Search + reconstruction | `tests/search.test.ts` | 22 | `CONFIRMED` passing (M5) |
| Demo state machine | `tests/demo-state.test.ts` | 11 | `CONFIRMED` passing (M6A) |
| **Total** | | **135** | |

The file names below differ from the plan in two places, noted in each section.

---

## 1. CooL tests — `tests/cool.test.ts`

The highest-value tests in the suite, because they guard against a silently
broken integration.

| # | Test | Asserts |
|---|---|---|
| C1 | **record** | `cool.record(...)` returns `{ evidence, recordId, executionId, digest }`; `recordId` is a 26-char ULID; `evidence.schema === "cool.receipt.v2"`; the passed `executionId` is echoed back |
| C2 | **receipt** | `signature.alg === "ml-dsa-65+ed25519"`; `inclusion` and `sth` are both present; `attestation.mode === "simulated"` |
| C3 | **verification** | `verifyEvidence(evidence).ok === true`; `binding`, `signature`, and `inclusion` are all `pass` |
| C4 | **`software.digest` regression** | recording with `software: { name, version }` (no `digest`) produces a receipt that **fails** with `record.event.software.digest: expected a non-empty string`, and the adapter's own output always sets `digest` explicitly. **This is the single most important test in the file** — `COOL_SDK_AUDIT.md` §7.1 |
| C5 | **failure** | `verifyEvidence` does not throw on `null`, `{}`, `"string"`, or a truncated receipt; each returns `ok: false` with non-empty `reasons` |
| C6 | **JSON round-trip** | `JSON.parse(JSON.stringify(evidence))` still verifies `ok: true` |
| C7 | **self-containment** | a receipt from one client verifies via standalone `verifyEvidence` with no client at all |
| C8 | **privacy** | the serialised receipt contains none of the raw metadata values or payload plaintexts passed in |
| C9 | **commitment recompute** | `saltedCommit(storedSalt, plaintext)` equals the stored commitment; an altered plaintext does not |
| C10 | **no hardware overclaim** | `runtime.mode === "simulated"`; `attestation` and `enclave` statuses are never `pass`; `verifyEvidence(e, { requireHardware: true }).ok === false` |
| C11 | **adapter isolation** | no file outside `lib/cool/` imports `cool-nwc` (source scan). Guideline Rule 3 |
| C12 | **identity drift** | the live `cool.environment.measurement` equals `EXPECTED_MEASUREMENT`, and the live `keyDirectory` ids equal `TRUSTED_KEY_IDS` — catches `COOL_IMAGE_DIGEST` drift before it reaches production |

---

## 2. Audit engine, scenarios, and events — `tests/audit-engine.test.ts`

**BUILT in Milestone 2 — 42 tests, all passing.** The plan split these across
`tests/audit.test.ts` and `tests/events.test.ts`; they are one file because
sections A–D share the same pure fixtures and the split bought nothing. Sections
A–D need no evidence plane and run in ~370 ms; E–G stand up real planes.

### A — one engine, four scenarios

| # | Asserts |
|---|---|
| A1 | every scenario's computed result matches its own declared `expected`, and `passed + exceptions == tested` |
| A2 | the hero is exactly 12 tested / 9 passed / 3 exceptions, with `humanReviewCompleted` |
| A3 | **determinism**: `JSON.stringify` of two runs is byte-identical, for all four scenarios |
| A4 | twelve *different* rules — 12 unique ids, 12 unique evaluator bodies, ≥8 distinct categories |
| A5 | the engine **throws** when a scenario's numbers drift from its `expected` block |
| A6 | the engine throws on an exception with no finding |
| A7 | the engine throws on a control citing evidence not in scope |
| A8 | every reasoner reports `deterministic: true`, and the engine refuses one that does not |
| A9 | the catalogue exposes four scenarios with exactly one hero |

A2, A3, and A5 are release blockers. Per guideline Rule 4, an LLM must never
decide whether the hero audit passes.

### B — findings reference their control and their evidence

| # | Asserts |
|---|---|
| B1 | every finding names a control that exists and whose status is `exception`, and the link is bidirectional |
| B2 | every finding cites at least one artifact, and every cited artifact is in scope |
| B3 | exceptions ↔ findings are one-to-one; a passing control never carries a finding |
| B4 | every finding has a substantive title, description, rationale, recommended action, severity, and non-empty `observed` |
| B5 | `F-FIN-001` is the revenue recognition finding: control `REV-REC-01`, high, $1,420,000, rationale naming `E-1001` / `C-1001` / `REV-POL-3`, and `revenue recognition exception` in `searchTags` |

### C — human review

| # | Asserts |
|---|---|
| C1 | the hero routes all three exceptions to a person, each with a substantive note |
| C2 | a reviewer can **MODIFY** severity, and both the original and the new value are kept |
| C3 | **nothing is auto-approved**: cyber leaves one finding PENDING, so `humanReviewCompleted` is false and the conclusion says so |
| C4 | a reviewer can **REJECT** the AI outright (procurement `PO-MATCH-02`) |
| C5 | all four review states — `open` / `accepted` / `modified` / `rejected` — occur across the scenarios |
| C6 | a live review is validated first: unknown finding → 404, empty note → 400, `modified` without a severity → 400, a severity on a non-`modified` decision → 400 |

### D — events and relationships

| # | Asserts |
|---|---|
| D1 | the hero chain is 30 events with the documented per-type fan-out |
| D2 | all nine stages appear in **all four** scenarios, one event per artifact / control / finding / review |
| D3 | it is a tree: one root (`audit.started`), every parent resolves, no cycles, `sequence` is positional, and a parent always precedes its child |
| D4 | `Evidence → Control → Finding → Review` is wired through `parentEventId`, and the control event cites the same evidence as its finding |
| D5 | the canonical nine are present, in the documented type order, and each one's parent is the previous one — **for all four scenarios** |
| D6 | walking parents from `conclusion.created` returns exactly the canonical nine, naming `F-FIN-001`, `REV-REC-01`, and `ART-FIN-001` |
| D7 | the representative `control.tested` is the control behind the hero finding, and it has eleven siblings |
| D8 | event ids are `EVT-FIN-2609-001`…`030` every run; logical times are ordered and dated 2026-09-15, not "now" |

### E — CooL integration

Real planes, real receipts, verified under the **unchanged** Milestone 1
`PRODUCTION_POLICY`. Nothing here weakens M1's rules.

| # | Asserts |
|---|---|
| E1 | the hero seals exactly its nine canonical events; each reference has a ULID `record_id`, an `mh:sha256` binding hash, an `ml-dsa` signature alg, and the expected `receiptRef` |
| E2 | the other 21 events honestly carry `cool: null` |
| E3 | all nine verify: `ok`, `verdictOk`, `signerTrusted`, `measurementMatches`, `logged`, `inclusion === "pass"`, and `hardware: false` stated honestly |
| E4 | the nine leaves form one append-only tree; `leafIndex` equals `sequence`, and `logState[i]` equals the event's binding hash |
| E5 | one `executionId` ties all nine; `software.name` is the configured identity and `software.digest` is still explicitly `null` (the M1 workaround) |
| E6 | the receipts leak none of the audit's content — `AUD-FIN-2026-09`, `REV-REC-01`, `F-FIN-001`, `C-1001`, `Northwind`, `J. Okafor`, `1420000`, and the conclusion text are all absent from the serialised receipts |
| E7 | altering a sealed finding's output commitment breaks verification, and the untouched receipt still verifies — so the failure is specific, not a blanket |
| E8 | an audit whose sealing is skipped still completes with 12 controls and 30 events |
| E9 | a **live** human review seals its own verifiable receipt, appended to the same tree as leaf 9, parented to the same `finding.created` event as the baseline review |

### F — the complete financial execution, as one test

The single deterministic test representing the demo (§16 of the Milestone 2
brief). One test asserts the whole path: run → 12/9/3 → three findings traceable
to their controls → three reviews that are not all approvals → 30 events with 9
sealed → the conclusion reconstructable back to the ledger, every step of that
reconstruction CooL-backed → 9/9 verified → a complete trail for the UI (30
nodes, 29 edges, a 9-event spine, root `EVT-FIN-2609-001`).

### G — source discipline

| # | Asserts |
|---|---|
| G1 | `lib/audit/` (excluding `run.ts` / `review.ts`) contains no `Math.random`, `Date.now`, `crypto.randomUUID`, bare `new Date()`, or `performance.now` — comments stripped before scanning |
| G2 | nothing in `lib/` reaches an external model provider |
| G3 | no `cool-nwc` import anywhere in `lib/audit/`, and no **value** import of `@/lib/cool` outside `run.ts` / `review.ts`. `import type` from `lib/cool/types` is the designed seam and is allowed |
| G4 | no event carries `bindingHash` or `recordId` as a field, and receipts are keyed by `${executionId}:${eventId}` — never by an unstable CooL identifier (`COOL_SDK_AUDIT.md` §7.2) |

`TODO` (M4): the persistence round-trip test (planned E6) lands with the
IndexedDB session store. `coolBacked: false` on simulated activities (planned E7)
lands with the simulation.

G1/G3 as built also exempt `integrity.ts` — `verifiedAt` is wall-clock, and that
file is the Milestone 3 door into `lib/cool/`.

### Trail — `tests/audit-trail.test.ts` (Milestone 3)

| # | Asserts |
|---|---|
| H1 | all four scenarios share one event shape and produce the documented nine-stage sealed spine |
| H2 | lookup by id, filter by type, and chronological order are deterministic |
| I1 | `ExecutionTrail` refuses replace / delete / reorder (`AppendOnlyError`); originals stay addressable |
| I2 | a correction is a new event on a new trail; the previous trail is unchanged |
| J1 | `whyConclusion()` walks `parentEventId` (not array order) and returns the sealed nine |
| J2 | the snapshot names first/last event, event counts, and the captured tree head |
| K1 | capture root → discard live tree → rehydrate from hashes → root matches → append → consistency holds |
| L1 | rewriting a sealed event's title fails `bindReceipt` via `contentDigest`; the receipt itself still verifies |
| L2 | deleting a historical leaf fails `proveTrailContinues` (RFC 6962) |
| L3 | reordering historical leaves fails `proveTrailContinues` |
| L4 | swapping two genuine receipts fails binding; each receipt still `verifyReceipt.ok` |
| L5 | flipping the conclusion's output commitment fails `verifyReceipt` |
| M1 | `verifyTrail` reports 9/9 bound and a matching rehydrated root |
| M2 | the hero is 12/9/3, 30 events, 9 sealed, reconstructable, verified |
| M3 | a later sealed event continues the same tree after rehydration |

---

## 4. Search tests — `tests/search.test.ts`

As built in Milestone 5:

| # | Asserts |
|---|---|
| S1 | each documented query, plus `1.42M`, ranks `AUD-FIN-2026-09` / `EXEC-FIN-2026-09-001` first |
| S2 | the boss sentence retrieves the original execution id |
| S3 | the four near-miss audits score below the hero for `revenue recognition exception` |
| S4 | ten runs of the same query are deeply equal |
| S5 | `domain`, `type`, `audit`, `after`/`before`/`since`, `evidence`, `status` compose |
| S6 | every hit names a real `auditId`; event ids are `EVT-…` |
| S7 | empty query → 55 newest-first activities; nonsense → `[]` + suggestion chips |
| S8 | generic `revenue` returns several audits; the hero still leads |
| S9 | `lib/search/` has no `Math.random`, clock reads, or external search services |
| T1 | reconstruction of the hero is 12/9/3 with the nine-stage `why` path |
| T2 | GET reconstruction is `unavailable`, not `verified` |
| T3 | catalog-only audits return `kind: "catalog"` / `not-recorded` |
| U1 | simulate → search → reconstruct → `verifyTrail` 9/9 |
| U2 | a tampered conclusion receipt makes reconstruction `failed` |

### Demo state — `tests/demo-state.test.ts` (Milestone 6A)

| # | Asserts |
|---|---|
| D1 | golden path reaches `verification` with hero ids |
| D2 | `run_audit` is illegal until a scenario is selected |
| D3 | result session holds identifiers, not findings |
| D4 | simulation and search store ids / query only |
| D5 | welcome cannot jump to verify or trail |
| D6 | reset returns `INITIAL_SESSION` |
| D7 | `back` follows the documented chain |
| D8 | failed audit stays in `running`; retry re-enters loading |
| D9 | verification status is a four-way enum, not a boolean |
| D10 | a successful run is `unavailable`, not `verified` |
| D11 | search failure does not select a result |

---

## 5. Simulation tests — `tests/simulation.test.ts`

As built in Milestone 4 (the planned M1–M8 ids collided with trail tests, so
the suite uses N–R):

| # | Asserts |
|---|---|
| N1 | 55 activities, 14 audits, `spanDays` in 88–92 |
| N2 | nothing after `DEMO_TODAY`; oldest row is 2026-09-15 |
| N3 | ≥40 activities newer than the hero; hero title not in the newest 20 |
| O1 | all 9 types ≥2; all 4 scenarios present |
| O2 | unique titles and timestamps; weekdays 08:00–18:00 UTC |
| O3 | rows in both the recent and the oldest windows |
| P1 | hero ids `AUD-FIN-2026-09` / `EXEC-FIN-2026-09-001`; summary 12/9/3 |
| P2 | hero execution lists `EVT-FIN-2609-001`…`030`, `coolBacked: true` |
| P3 | `runAudit` fingerprint is identical before and after `generateHistory` |
| P4 | hero rows carry `revenue recognition exception`, `REV-REC-01`, `1420000` |
| Q1 | two runs with `SEED` are deeply equal |
| Q2 | a third start does not grow the list |
| Q3 | a different seed changes dates, not titles |
| Q4 | mocking `Date.now` does not change the corpus |
| R1 | only the four real scenarios have `hasEngineTrail`; only hero rows are `coolBacked` |
| R2 | `lib/simulation/` contains no `Math.random` / `Date.now` / `randomUUID` |
| R3 | `generate.ts` does not import the engine or `lib/cool` |

---

## 6. Verification tests — `tests/verification.test.ts`

| # | Test | Asserts |
|---|---|---|
| V1 | **valid record** | a real receipt yields `VERIFIED` with `binding`, `signature`, `inclusion` all `pass` |
| V2 | **altered record** | mutating `metadata_hash`, `event.type`, `binding_hash`, or `issued_at` each yields `FAILED` with the expected failing domains. Parameterised over the tamper matrix |
| V3 | **corrupted signature** | corrupting Ed25519 alone and ML-DSA alone each fails `signature` while `binding` still passes — proving both algorithms are checked |
| V4 | **stripped inclusion proof** | dropping both `inclusion` and `sth` gives `verdict.ok === true` but VeriAudit's `IntegrityState.ok === false`. **Guards the §3.1 gap** — if this test ever flips, the verification panel has become misleading |
| V5 | **foreign-plane forgery** | a receipt from a different `COOL_IMAGE_DIGEST` gives `verdict.ok === true` but fails our `signerTrusted` check and `expectedMeasurement` |
| V6 | **same-`key_id` substitution** | a relabelled receipt with attacker key material fails once `withTrustedKeys` forces the real key in |
| V7 | **append-only proof** | `verifyConsistency` is `true` for honest growth, `false` for a forged old root, `false` after deleting a historical event, and a thrown error is treated as failure |
| V8 | **no false VERIFIED** | the UI state mapper never returns `verified` unless `verdictOk && signerTrusted && logged`. Property-checked over all 16 combinations |
| V9 | **missing receipt** | an absent receipt maps to `unavailable`, never `failed` |
| V10 | **reasons surfaced** | on failure, the SDK's `reasons[]` reach the rendered output verbatim |

---

## 7. Deployment / end-to-end tests — `tests/e2e/demo.spec.ts`

Playwright, run against both `localhost` and the production URL.

| # | Test | Asserts |
|---|---|---|
| D1 | **clean browser** | fresh context, no storage, no cache: the landing page renders and explains the product |
| D2 | **full demo path** | Stage 1 → 12 of `DEMO_FLOW.md`: choose financial → run audit → assert 12/9/3 → simulate → assert 50+ rows → search `revenue recognition exception` → assert the hero is first → open trail → assert 9 nodes → open `finding.created` → verify → assert **VERIFIED** |
| D3 | **receipts are real** | the verification panel shows a real `record_id`, a `mh:sha256:` binding hash, and `ml-dsa-65+ed25519`, and the `/api/cool/verify` response body has `ok: true` |
| D4 | **honest labels** | `attestation` and `enclave` render as `simulated`, never as pass or "hardware-attested"; the "does not mean the AI was correct" note is present |
| D5 | **tamper demo** | the tamper action produces a visible **VERIFICATION FAILED** with real reasons |
| D6 | **reload resilience** | reloading mid-demo restores the trail and receipts from IndexedDB |
| D7 | **production parity** | D2 passes against the production Vercel URL |
| D8 | **no client-side SDK leak** | no network response served to the browser contains `ml-dsa` bundle code from `cool-nwc` in a client chunk |
| D9 | **timing** | the full demo path completes in under 5 minutes of wall time |

---

## 8. Test execution order and gates

Run in this order, because a failure early makes later failures uninformative:

```text
1. typecheck
2. CooL tests          (C1–C12)   ← if C4 or C10 fails, STOP
3. Audit tests         (A1–A5)    ← if A1 fails, the demo is not deterministic
4. Event tests         (E1–E8)
5. Simulation tests    (M1–M8)
6. Search tests        (S1–S7)    ← if S1 fails, the demo's climax breaks
7. Verification tests  (V1–V10)   ← if V4 or V8 fails, we are overclaiming
8. E2E                 (D1–D9)
```

### Release blockers

Never ship with any of these red:

```text
C3   real CooL verification works
C4   software.digest regression
C10  no hardware overclaim
A1   deterministic audit result
S1   hero audit is always found
V4   stripped inclusion proof is caught
V8   no false VERIFIED
D2   full demo path
D7   production parity
```

---

## 9. Manual checkpoints

Per guideline §16, after each milestone, by hand:

| After | Check |
|---|---|
| Milestone 1 | a real event records and verifies — **on Vercel**, not just locally |
| Milestone 2 | the financial audit produces 12/9/3 |
| Milestone 3 | events carry parents and the chain is complete |
| Milestone 4 | the trail reads as a causal story without explanation |
| Milestone 5 | the hero audit is found by every demo query |
| Milestone 6 | the original audit genuinely feels buried when scrolling |
| Milestone 7 | the panel reflects the real verdict, including the `simulated` rows |
| Milestone 8 | the same flow works from a clean Vercel session |

---

## 10. Out of scope

`TODO` — no load testing, no visual regression, no accessibility audit, no
mutation testing, no coverage threshold. An 8-hour build spends its test budget
on the demo path and on not overclaiming.
