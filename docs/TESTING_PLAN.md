# Testing Plan

Tests exist to protect the demo, not to chase coverage. Every test below maps to
a way the judging run could break.

Runner: **Vitest** (fast, zero-config with TypeScript, ESM-native — which matters
because `cool-nwc` is ESM-only). Browser path: Playwright, P0 for the one
end-to-end demo walk.

```sh
npm test              # unit + integration
npm run test:e2e      # Playwright demo walk
npm run typecheck
```

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

## 2. Audit tests — `tests/audit.test.ts`

| # | Test | Asserts |
|---|---|---|
| A1 | **deterministic result** | running the financial audit 10 times yields exactly `{ controlsTested: 12, controlsPassed: 9, exceptions: 3 }` every time |
| A2 | **deterministic findings** | the same 3 findings with the same ids, severities, controls, and dollar amounts |
| A3 | **no randomness** | `lib/audit/` and `lib/simulation/` contain no `Math.random`, `Date.now`, `crypto.randomUUID`, or `new Date()` without an argument (source scan) |
| A4 | **no runtime LLM** | no fetch to an external model provider anywhere in `lib/` |
| A5 | **human review** | every finding has a `HumanReview` with a decision in `accepted \| modified \| rejected` |

A1 is a release blocker. Per guideline Rule 4, an LLM must never decide whether
the hero audit passes.

---

## 3. Event tests — `tests/events.test.ts`

| # | Test | Asserts |
|---|---|---|
| E1 | **single root** | exactly one event has `parentEventId === null`, and it is `audit.started` |
| E2 | **parent/child integrity** | every non-root `parentEventId` resolves to a real event in the same execution; no cycles; every event is reachable from the root |
| E3 | **canonical chain** | walking parents from `conclusion.created` passes through `human.review.completed`, `finding.created`, `control.tested`, `model.executed`, `retrieval.executed`, `artifact.parsed`, `artifact.ingested`, `audit.started` in that order |
| E4 | **sequence ordering** | `sequence` is strictly increasing in causal order; a parent's `sequence` is always lower than its child's |
| E5 | **shared `executionId`** | all events in an execution share one `executionId`, and it is the one passed to CooL |
| E6 | **persistence round-trip** | events survive serialise → store → restore with `CoolReference` intact |
| E7 | **CooL coverage** | all nine canonical event types in the hero execution have a non-null `cool`; simulated activities have `coolBacked: false` |
| E8 | **no receipt id as a key** | no code joins on `bindingHash` or `recordId` (source scan) — they are not stable across regenerations (`COOL_SDK_AUDIT.md` §7.2) |

---

## 4. Search tests — `tests/search.test.ts`

| # | Test | Asserts |
|---|---|---|
| S1 | **hero retrieval** | each of the 8 guaranteed queries in `SEARCH_SPEC.md` §6 returns `AUD-FIN-2026-09` as the **top** result. Parameterised; a release blocker |
| S2 | **the boss's exact words** | `"why did we flag this revenue transaction"` ranks the hero first |
| S3 | **beats the near-misses** | the hero outranks all four deliberate competing audits for `revenue recognition exception` |
| S4 | **determinism** | the same query over the same corpus returns an identical ordered result list across 10 runs |
| S5 | **filters** | date, audit, event-type, status, and evidence filters each narrow correctly and compose as a conjunction |
| S6 | **result → trail** | every result carries an `auditId` that resolves, and any `executionId`/`eventId` resolves to a real event |
| S7 | **empty states** | an empty query returns recent history; a nonsense query returns zero results plus suggestion chips |

---

## 5. Simulation tests — `tests/simulation.test.ts`

| # | Test | Asserts |
|---|---|---|
| M1 | **50+ activities** | `activities.length >= 50` |
| M2 | **three months** | `spanDays >= 88`; the oldest activity is ~91 days before `DEMO_TODAY`; nothing is dated after `DEMO_TODAY` |
| M3 | **hero is buried** | at least 40 activities are newer than the hero audit, and it is not in the first 20 rows |
| M4 | **variety** | all 9 activity types appear at least twice; all 4 scenarios appear |
| M5 | **not duplicated** | no two activities share a title, and no two share a timestamp |
| M6 | **determinism** | two runs with the same seed are deeply equal |
| M7 | **fixed clock** | the output does not change when the system clock is mocked forward a month |
| M8 | **hero uniqueness** | exactly one audit has `isHero: true` |

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
| D2 | **full demo path** | Stage 1 → 12 of `DEMO_FLOW.md`: choose financial → run audit → assert 12/9/3 → simulate → assert 50+ rows → search `revenue recognition exception` → assert the hero is first → open trail → assert 8 nodes → open `finding.created` → verify → assert **VERIFIED** |
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
