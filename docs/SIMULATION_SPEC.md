# Simulation Spec

The simulation exists for one reason: **to bury the hero audit** so that
reconstructing it is a real achievement. Per the source of truth §4, it does not
need production-grade sophistication.

> **Milestone 4 status.** The corpus is built in `lib/simulation/`. 55
> activities, 14 audits, seed `20260915`, `DEMO_TODAY = 2026-12-15T09:00:00Z`.
> The history UI is still `TODO`. Tags: `CONFIRMED` / `INFERRED` / `TODO` /
> `UNKNOWN`.

---

## 1. Requirements

| Requirement | Target | As built |
|---|---|---|
| Historical activities | **50+** (spec: 55) | **55** `CONFIRMED` |
| Time span | ~92 days (3 months) | demo window Sep 15 → Dec 15 (91 days); activity min–max is **90** days on `SEED` `CONFIRMED` |
| Audit types represented | all 4 scenarios | 5 financial / 3 legal / 3 cyber / 3 procurement |
| Activity types | 9 distinct kinds | all 9, each ≥ 2 rows |
| Hero audit | present, dated early, genuinely buried | `AUD-FIN-2026-09` on 2026-09-15; ≥40 newer rows |
| Search | must find the hero audit reliably | tags authored; **search engine is `TODO` (M5)** |
| Determinism | **absolute** | two `generateHistory(SEED)` are deeply equal |

---

## 2. Determinism

Non-negotiable, per source of truth §10 and guideline Rule 4.

- **Seeded PRNG only.** `Math.random()`, `Date.now()`, and `crypto.randomUUID()`
  are forbidden in `lib/simulation/`. Test R2 greps for them (comments stripped).
- **No LLM.** Every title, description, and tag is an authored constant in
  `lib/simulation/catalog.ts`. The PRNG chooses dates and the window a row
  lands in, not prose.
- **Fixed reference date.** `DEMO_TODAY = "2026-12-15T09:00:00.000Z"`.
- **Pure function.** `generateHistory(seed)` has no I/O and does not call
  `runAudit` or `lib/cool`. Server and tests produce byte-identical corpora.

```ts
// lib/simulation/rng.ts — as built
export const SEED = 20260915;
export const DEMO_TODAY = "2026-12-15T09:00:00.000Z";
export function rng(seed: number) { /* mulberry32 */ }
```

`CONFIRMED` — test Q1 / Q4. Mocking `Date.now` a month forward does not change
the output.

---

## 3. Timeline

```text
2026-09-15   HERO: September Revenue Recognition Audit (AUD-FIN-2026-09)
             ↓  55 activities across 14 audits
2026-12-15   DEMO_TODAY — the boss asks the question
```

Distribution, weighted toward recent dates (`CONFIRMED`, test O3):

| Window (days before DEMO_TODAY) | Activities |
|---|---|
| Days 0–14 (most recent) | 16 |
| Days 15–35 | 14 |
| Days 36–60 | 13 |
| Days 61–85 | 9 |
| Days 86–92 (oldest, contains the hero) | 3 |

Constraints the generator enforces:

- Activities fall on weekdays, between 08:00 and 19:00 UTC.
- The three pinned hero rows sit on 2026-09-15 and are the oldest cluster.
- At least **40** activities are newer than the hero (`CONFIRMED`, 52).
- The hero audit title is not in the newest 20 rows.
- No two activities share a timestamp or a title.
- Feed order is newest first; ties break on title, then `activityId`.

---

## 4. Activity types

All nine from the guideline §11. Counts are authored, not sampled:

| Type | Count | Example title |
|---|---|---|
| `audit` | 8 | "September Revenue Recognition Audit" |
| `control_test` | 11 | "Control REV-REC-01: performance obligation before recognition" |
| `evidence_review` | 7 | "Reviewed 38 purchase orders for October" |
| `finding` | 6 | "Finding: revenue recognition exception on C-1001 / M2" |
| `follow_up` | 6 | "Follow-up on F-CYB-002 remediation" |
| `human_review` | 6 | "J. Okafor accepted the revenue recognition exception" |
| `compliance_check` | 4 | "SOX 404 quarterly control walkthrough" |
| `vendor_review` | 4 | "Vendor risk review: Northgate Logistics" |
| `access_review` | 3 | "Quarterly privileged access recertification" |
| **Total** | **55** | |

---

## 5. Audits generated

14 total: 1 hero + 3 other **real** engine scenarios + 10 catalog-only.

| Scenario | Audits | Engine trail? |
|---|---|---|
| financial | 5 (incl. **hero**) | hero only |
| legal | 3 | `AUD-LEG-2026-08` |
| cyber | 3 | `AUD-CYB-2026-09` |
| procurement | 3 | `AUD-PRC-2026-09` |

The four existing scenarios are **referenced**, not re-run. `generateHistory`
copies their ids, titles, and (for the hero) the 30 deterministic event ids.
It does not call `runAudit`.

**Deliberate near-misses** so later search is a retrieval, not a unique hit:

| Audit | Why it competes |
|---|---|
| `AUD-FIN-2026-11` — Q4 Deferred Revenue Audit | shares "revenue" |
| `AUD-FIN-2026-10` — October Revenue Cut-off Testing | shares "revenue", closer in date |
| `AUD-FIN-2026-12` — Revenue Contract Modification Review | shares "revenue" and "contract" |
| `AUD-LEG-2026-10` — Contract Approval Compliance Review | shares "approval" |

The hero is the only record carrying the exact phrase *revenue recognition
exception* and the tag `REV-REC-01`. Ranking is `TODO` until Milestone 5.

---

## 6. What the simulation does **not** do

- **No CooL receipts for simulated activities.** `coolBacked: true` only on the
  hero's own rows (the original audit, finding, review, and the REV-REC-01
  working paper). Everyone else is labelled for a future UI as
  *"no cryptographic evidence"*.
- **No second event system and no second audit engine.**
- **No LLM-generated content at runtime.**
- **No fake verification.** A simulated activity never carries a verification
  state.
- **No database.** The corpus is a pure function of `SEED`.

This asymmetry is honest: the demo's value is one deeply evidenced audit
inside a plausibly noisy history.

---

## 7. Output contract

```ts
type SimulationResult = {
  simulationId: "SIM-20260915";
  generatedAt: "2026-12-15T09:00:00.000Z";  // DEMO_TODAY, not the wall clock
  seed: 20260915;
  demoToday: string;
  startDate: string;            // oldest activity
  endDate: string;              // newest activity
  heroAuditId: "AUD-FIN-2026-09";
  heroExecutionId: "EXEC-FIN-2026-09-001";
  audits: SimulatedAudit[];     // 14
  executions: SimulatedExecution[]; // 14; only the hero is coolBacked
  activities: Activity[];       // 55, newest first
  stats: {
    totalActivities: 55;
    spanDays: 90;              // activity min–max on SEED; demo window is 91 days
    activitiesNewerThanHero: number;  // 52
    scenariosCovered: 4;
  };
};
```

Invariants a test asserts (`tests/simulation.test.ts`):

1. `activities.length === 55`
2. `stats.activitiesNewerThanHero >= 40`
3. `stats.spanDays >= 88`
4. every `Activity.type` appears at least twice
5. all four scenarios appear
6. two runs with the same seed are **deeply equal**
7. exactly one audit has `isHero: true`
8. no timestamp exceeds `DEMO_TODAY`
9. the hero engine fingerprint is unchanged after `generateHistory`
10. a third start does not grow the list

---

## 8. API

| Method | Route | Result |
|---|---|---|
| `GET` | `/api/simulation` | full `SimulationResult` |
| `POST` | `/api/simulation/start` | compact summary + activities + audit index |
| `POST` | `/api/simulation/reset` | the same summary; there is no stored session to wipe |

All three call `generateHistory(SEED)`. Repeated POST does not append.

Compact summary:

```ts
{
  simulationId, seed, startDate, endDate,
  activityCount, auditCount,
  heroAuditId, heroExecutionId,
  stats
}
```

---

## 9. Presentation

`TODO` — the feed UI (month grouping, sticky headers, evidence chips, the
"Three months later…" interstitial) is a later milestone. The backend dataset
already represents the buried historical state. No frontend work was done in
Milestone 4.
