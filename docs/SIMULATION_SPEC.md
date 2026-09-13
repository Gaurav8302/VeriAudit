# Simulation Spec

The simulation exists for one reason: **to bury the hero audit** so that
reconstructing it is a real achievement. Per the source of truth §4, it does not
need production-grade sophistication.

---

## 1. Requirements

| Requirement | Target |
|---|---|
| Historical activities | **50+** (spec: 55) |
| Time span | ~92 days (3 months) |
| Audit types represented | all 4 scenarios |
| Activity types | 9 distinct kinds |
| Hero audit | present, dated early, genuinely buried |
| Search | must find the hero audit reliably |
| Determinism | **absolute** — same output every run, every machine, every instance |

---

## 2. Determinism

Non-negotiable, per source of truth §10 and guideline Rule 4.

- **Seeded PRNG only.** `Math.random()`, `Date.now()`, and `crypto.randomUUID()`
  are forbidden in `lib/simulation/`. A test greps for them.
- **No LLM.** No critical record — not the hero audit's numbers, not a search
  target, not an activity title — comes from a model at runtime. Any generated
  prose is authored ahead of time and stored as a constant.
- **Fixed reference date.** `DEMO_TODAY = "2026-12-15T09:00:00Z"`. Timestamps are
  computed as offsets from it, never from the wall clock, so the demo looks the
  same in January as in June.
- **Pure function.** `generateHistory(seed) → { audits, executions, activities }`
  with no I/O and no ambient state, so server and client produce byte-identical
  corpora.

```ts
// lib/simulation/rng.ts — mulberry32, 32-bit, no dependencies
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const SEED = 20260915;
```

The generator picks from **authored pools** rather than inventing text: the PRNG
chooses which pre-written title, which reviewer, which vendor. That is what keeps
it believable without being random.

---

## 3. Timeline

```text
2026-09-15   HERO: September Revenue Recognition Audit (AUD-FIN-2026-09)
             ↓  ~55 activities across 13 other audits
2026-12-15   DEMO_TODAY — the boss asks the question
```

The hero audit sits **91 days back**, in the oldest 10% of the feed. Distribution
is weighted toward recent dates so the feed looks like a live workspace:

| Window | Activities |
|---|---|
| Days 0–14 (most recent) | 16 |
| Days 15–35 | 14 |
| Days 36–60 | 13 |
| Days 61–85 | 9 |
| Days 86–92 (oldest, contains the hero) | 3 |

Constraints the generator enforces:

- Activities fall on weekdays, between 08:00 and 19:00 local, so timestamps read
  like real work.
- The hero audit's activities are not the newest rows, and at least **40**
  activities are newer than it.
- No two activities share a timestamp.
- Activity ordering is stable: ties break on `activityId`.

---

## 4. Activity types

All nine from the guideline §11, with authored title pools:

| Type | Count | Example title |
|---|---|---|
| `audit` | 8 | "Q4 Deferred Revenue Audit" |
| `control_test` | 11 | "Control ACC-04: segregation of duties" |
| `evidence_review` | 7 | "Reviewed 38 purchase orders for October" |
| `finding` | 6 | "Finding: unapproved journal entry above threshold" |
| `follow_up` | 6 | "Follow-up on F-CYB-002 remediation" |
| `human_review` | 6 | "M. Reyes verified inventory count variance" |
| `compliance_check` | 4 | "SOX 404 quarterly control walkthrough" |
| `vendor_review` | 4 | "Vendor risk review: Northgate Logistics" |
| `access_review` | 3 | "Quarterly privileged access recertification" |
| **Total** | **55** | |

Per guideline §11, this is not the same row duplicated. Nine types × authored
pools × four scenarios produces a feed that reads as varied at a glance, which is
what makes the burial convincing.

---

## 5. Audits generated

14 total: 1 hero + 13 simulated.

| Scenario | Audits | Purpose |
|---|---|---|
| financial | 5 (incl. **hero**) | the hero must not be the only financial audit, or search would be trivially easy |
| legal / compliance | 3 | |
| cybersecurity / IT | 3 | |
| procurement / vendor | 3 | |

**Deliberate near-misses.** Four simulated audits are designed to compete with
the hero in search results, so that finding it is a genuine retrieval rather than
the only option:

| Audit | Why it competes |
|---|---|
| `AUD-FIN-2026-11` — Q4 Deferred Revenue Audit | shares "revenue" |
| `AUD-FIN-2026-10` — October Revenue Cut-off Testing | shares "revenue", closer in date |
| `AUD-FIN-2026-12` — Revenue Contract Modification Review | shares "revenue" and "contract" |
| `AUD-LEG-2026-10` — Contract Approval Compliance Review | shares "approval" |

The hero still ranks first for the demo queries because it is the only record
carrying the exact phrase *revenue recognition exception* and the tag
`REV-REC-01`. This is asserted by a test (`SEARCH_SPEC.md` §6), and it is the
reason near-misses are safe to include.

---

## 6. What the simulation does **not** do

- **No CooL receipts for simulated activities.** 55 × 30 KB ≈ 1.65 MB and ~930 ms
  of ML-DSA signing for evidence nobody opens (`COOL_SDK_AUDIT.md` §8). They
  carry `coolBacked: false` and the UI labels them *"no cryptographic evidence"*.
- **No deep event trees.** Simulated audits have activities and summaries, not
  30-event executions. Only the hero has a full execution trail. P1 adds
  lazy on-demand recording when a judge opens a non-hero execution.
- **No LLM-generated content at runtime.**
- **No fake verification.** A simulated activity never displays a verification
  state, because it has nothing to verify.

This asymmetry is honest and it is also the correct engineering trade: the demo's
value is one deeply evidenced audit inside a plausibly noisy history, not 55
shallow ones.

---

## 7. Output contract

```ts
type SimulationResult = {
  generatedAt: string;          // DEMO_TODAY, not the wall clock
  seed: number;                 // SEED
  demoToday: string;
  heroAuditId: "AUD-FIN-2026-09";
  audits: Audit[];              // 14
  executions: Execution[];      // ~18
  activities: Activity[];       // 55, newest first
  stats: {
    totalActivities: number;    // 55
    spanDays: number;           // 91
    activitiesNewerThanHero: number;  // >= 40
    scenariosCovered: 4;
  };
};
```

Invariants a test asserts:

1. `activities.length >= 50`
2. `stats.activitiesNewerThanHero >= 40`
3. `stats.spanDays >= 88`
4. every `Activity.type` value appears at least twice
5. all four scenarios appear
6. two runs with the same seed are **deeply equal**
7. the hero audit appears in the corpus exactly once
8. no timestamp exceeds `DEMO_TODAY`

---

## 8. Presentation

The feed shows: date, type icon, title, audit link, status, and an evidence chip
(*sealed* / *no cryptographic evidence*). Grouped by month with sticky headers,
so scrolling past 55 rows to reach September **feels** like three months of work
— which is the emotional beat the stage exists to produce.
