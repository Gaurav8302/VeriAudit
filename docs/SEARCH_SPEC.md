# Search Spec

Search is the **entry point** to the product, not the product (source of truth
§4). Per guideline §12: *"A reliable search is more important than an impressive
search algorithm."* The demo query must work every single time.

> **Milestone 5 status.** The in-memory inverted index, the eight asserted
> queries, filters, and reconstruction are `CONFIRMED` in `lib/search/` and
> `tests/search.test.ts`. The search UI is still `TODO`. This is explainable
> deterministic search — not semantic, vector, or AI ranking.

---

## 1. Approach

An in-memory inverted index built from the deterministic corpus. No vector
database, no embeddings, no external search service.

The index is rebuilt from `generateHistory()` plus `runAudit` on the four
real scenarios (`lib/search/corpus.ts`). A few milliseconds; the corpus is
~150 KB of authored text.

`CONFIRMED` — `GET /api/search` is server-side in this build (the original
plan said client-side). Same function, same determinism; the future UI can
still call it from the browser.

---

## 2. What is searchable

| Entity | Indexed fields | Weight | As built |
|---|---|---|---|
| `Audit` | `title`, `period`, `searchTags` | 3.0 | 14 catalog audits |
| `Finding` | `title`, `rationale`, `controlId`, `severity`, amount | 2.5 | findings from the four engine scenarios |
| `Activity` | `title`, `description`, `type`, `searchTags` | 1.0 | 55 simulation rows |
| `Event` | `title`, `summary`, `type`, control/finding refs | 0.8 | engine event chains |

Audits and findings outrank activity noise, which is what makes the hero
audit surface above 55 competing rows. `CONFIRMED` (tests S1, S3, S8).

---

## 3. Query handling

```text
query → normalise → tokenise → expand → score → rank → group
```

1. **Normalise** — lowercase; keep `-` and `.` so `REV-REC-01` and `1.42M` survive.
2. **Tokenise** — split on whitespace. Stopwords: `the`, `a`, `an`, `of`, `for`,
   `in`, `on`, `did`, `we`, `why`, `this`, `that`, `is`, `to`, `and`, `or`.
3. **Expand** — authored synonyms (`exception` → finding/flagged, `flag` →
   exception, `september` → `2026-09`/`q3`, …). Multi-word phrases
   (`revenue recognition`, `approval missing`) are scored as phrase hits.
4. **Score** — per docs:

   ```text
   score = Σ over matched tokens of:
             entityWeight
           × fieldBoost        (title 2.0, tags 1.5, body 1.0)
           × matchQuality      (exact token 1.0, prefix 0.6)
         + phraseBonus         (+5.0 if the full query / expanded phrase is a substring)
         + tagExactBonus       (+4.0 if a token exactly equals a searchTag)
   ```

   Best field per token. Ties break on `occurredAt` descending, then id.

5. **Rank** — descending score; drop anything below 1.0.
6. **Group** — by `auditId`. The group score is the best member score, so one
   audit cannot flood the list. `results[0].auditId` and `groups[0].auditId`
   are the same ranking.

---

## 4. Filters

Applied as a conjunction after candidate retrieval. Relative dates use
`DEMO_TODAY`, not the wall clock.

| Query param | Values |
|---|---|
| `q` | free text; empty → recent activity, newest first |
| `after` / `before` | ISO timestamps, inclusive |
| `since` | `7` / `30` / `90` days before `DEMO_TODAY` |
| `domain` | `financial` / `legal` / `cyber` / `procurement` |
| `type` | activity type or event type |
| `audit` | audit id |
| `status` | `completed` / `exception` / `in_review` / `scheduled` / `open` |
| `evidence` | `cool` / `none` / `any` |

`CONFIRMED` by test S5.

---

## 5. Result → trail navigation

```text
GET /api/search?q=revenue+recognition+exception
   ↓  groups[0].auditId
GET /api/audits/AUD-FIN-2026-09/reconstruction
   ↓  executionId EXEC-FIN-2026-09-001
POST …/reconstruction  { receipts, logState, treeHead }
   ↓
why.path + integrity.status
```

Every hit carries `auditId`, `executionId` when it has one, `activityId` /
`eventId` / `findingId` when they apply, `relevance`, `matchedTerms`, and
`tags`.

`GET` reconstruction reports `integrity.status: "unavailable"` because
receipts cannot be regenerated. That is not a pass. `POST` with the session's
receipts runs `verifyTrail` (Milestone 1 policy).

---

## 6. Guaranteed demo queries

`CONFIRMED` — each ranks `AUD-FIN-2026-09` / `EXEC-FIN-2026-09-001` first
(test S1). Near-misses stay below the hero for the precise query (test S3).

| Query | Must rank #1 |
|---|---|
| `revenue recognition exception` | `AUD-FIN-2026-09` |
| `revenue recognition` | `AUD-FIN-2026-09` |
| `September revenue audit` | `AUD-FIN-2026-09` |
| `approval missing` | `AUD-FIN-2026-09` |
| `why did we flag this revenue transaction` | `AUD-FIN-2026-09` |
| `REV-REC-01` | `AUD-FIN-2026-09` |
| `F-FIN-001` | `AUD-FIN-2026-09` |
| `1.42M` / `1420000` | `AUD-FIN-2026-09` |

The boss sentence is stopword removal plus `flag → exception`, not a semantic
model.

Hero tags that make this reliable live on the simulation audit and on the
hero activities (`HERO_SEARCH_TAGS`), plus engine findings (`REV-REC-01`,
`F-FIN-001`, `1420000`).

---

## 7. Empty and degraded states

| State | Behaviour |
|---|---|
| Empty query | 55 activities, newest first |
| No results | `results: []` plus the four suggestion chips |
| One result | still a list — the UI must not auto-open |
| Catalog-only audit | reconstruction `kind: "catalog"`, `integrity: not-recorded` |

Suggestion chips: `revenue recognition exception`, `approval missing`,
`September revenue audit`, `REV-REC-01`.

---

## 8. Out of scope

`TODO`/P2: semantic or vector search, fuzzy typo tolerance beyond prefix
matching, boolean query syntax, saved searches, search analytics, the search
UI. None of them were built. Do not claim them.
