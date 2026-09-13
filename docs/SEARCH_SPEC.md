# Search Spec

Search is the **entry point** to the product, not the product (source of truth
§4). Per guideline §12: *"A reliable search is more important than an impressive
search algorithm."* The demo query must work every single time.

---

## 1. Approach

An in-memory inverted index built from the deterministic corpus. No vector
database, no embeddings, no external search service.

Why not semantic search: it needs an API key, adds network latency inside the
demo's most important interaction, introduces non-determinism into the one moment
that must never fail, and costs setup time an 8-hour budget cannot spare. It is
`TODO`/P2 at best.

The index is rebuilt on load (~150 KB corpus, a few milliseconds) and runs
client-side, so results are instant with no round trip.

---

## 2. What is searchable

| Entity | Indexed fields | Weight |
|---|---|---|
| `Audit` | `title`, `period`, `searchTags`, finding titles | 3.0 |
| `Finding` | `title`, `rationale`, `controlId`, `severity` | 2.5 |
| `Activity` | `title`, `type`, `searchTags` | 1.0 |
| `Event` | `title`, `summary`, `type` | 0.8 |

Audits and findings outrank activity noise, which is what makes the hero audit
surface above 55 competing rows.

---

## 3. Query handling

```text
query → normalise → tokenise → expand → score → rank → group
```

1. **Normalise** — lowercase, strip punctuation except `-` (so `REV-REC-01`
   survives as one token), collapse whitespace.
2. **Tokenise** — split on whitespace. Drop a small stopword list (`the`, `a`,
   `of`, `for`, `in`, `on`, `did`, `we`, `why`).
3. **Expand** — a small authored synonym map, because judges type natural
   language, not keywords:

   | Typed | Also matches |
   |---|---|
   | `exception` | `exceptions`, `finding`, `flagged`, `failed` |
   | `revenue` | `revenue recognition`, `rev-rec` |
   | `approval` | `approved`, `authorisation`, `sign-off` |
   | `september` | `2026-09`, `Q3` |
   | `flag`, `flagged` | `exception`, `finding` |
   | `recognition` | `rev-rec`, `revenue recognition` |

4. **Score** — per matching record:

   ```text
   score = Σ over matched tokens of:
             entityWeight
           × fieldBoost        (title 2.0, tags 1.5, body 1.0)
           × matchQuality      (exact token 1.0, prefix 0.6)
         + phraseBonus         (+5.0 if the full query appears as a substring of the title/summary)
         + tagExactBonus       (+4.0 if a token exactly equals a searchTag)
   ```

   Deterministic integer/float arithmetic over a deterministic corpus, so ranking
   is reproducible. Ties break on `occurredAt` descending, then id — never on
   object iteration order.

5. **Rank** — descending score; drop anything scoring below 1.0.
6. **Group** — results grouped by audit, so one audit does not flood the list
   with its own events.

---

## 4. Filters

Minimum set per the brief, applied as a conjunction after scoring:

| Filter | Values |
|---|---|
| **Date** | last 7 / 30 / 90 days, or an explicit range. Relative to `DEMO_TODAY`, not the wall clock |
| **Audit** | any of the 14 audits, or all |
| **Event type** | the 11 event types + the 9 activity types |
| **Result / status** | `completed`, `exception`, `in_review`, `scheduled` |

Plus one extra that showcases the integration honestly:

| **Evidence** | `CooL-backed` / `no cryptographic evidence` / any |

Filters are reflected in the URL query string so a judge can be handed a link
straight to a filtered view.

---

## 5. Result → trail navigation

```text
Search result
   ↓  (auditId)
Audit page           AUD-FIN-2026-09
   ↓  (executionIds[0])
Execution            EXEC-FIN-2026-09-001
   ↓  (eventIds, ordered by sequence; edges from parentEventId)
Event trail          30 events, collapsed to the 8-node causal spine
   ↓  (event.cool.receiptRef)
Receipt              loaded from IndexedDB
   ↓
Verification         POST /api/cool/verify
```

Every search result carries `auditId` and, when it has one, `executionId` and
`eventId`, so a result can deep-link straight to a highlighted node in the trail.

A result rendered in the list shows: title, audit, date, type, status, matched
snippet with terms highlighted, and the evidence chip.

---

## 6. Guaranteed demo queries

These must return the hero audit as the **top** result. A test asserts each one,
and it is a release blocker.

| Query | Must rank #1 |
|---|---|
| `revenue recognition exception` | `AUD-FIN-2026-09` |
| `revenue recognition` | `AUD-FIN-2026-09` |
| `September revenue audit` | `AUD-FIN-2026-09` |
| `approval missing` | `AUD-FIN-2026-09` (finding `F-FIN-002`) |
| `why did we flag this revenue transaction` | `AUD-FIN-2026-09` |
| `REV-REC-01` | `AUD-FIN-2026-09` |
| `F-FIN-001` | `AUD-FIN-2026-09` |
| `1.42M` / `1420000` | `AUD-FIN-2026-09` |

The last natural-language query matters most: it is the boss's exact words, and a
judge is likely to paste it. It is handled by stopword removal plus the
`flag → exception` expansion, not by any semantic model.

To make this robust, the hero audit's `searchTags` are authored deliberately:

```ts
searchTags: [
  "revenue", "recognition", "revenue recognition", "rev-rec", "REV-REC-01",
  "exception", "exceptions", "flagged", "september", "2026-09", "Q3",
  "approval", "approval missing", "contract", "C-1001", "C-1002",
  "deferred revenue", "performance obligation", "1.42M", "1420000",
]
```

Tags are the reliability mechanism. Scoring can be tuned; an exact tag hit
(+4.0) plus the phrase bonus (+5.0) keeps the hero ahead of the four
deliberate near-miss audits from `SIMULATION_SPEC.md` §5.

---

## 7. Empty and degraded states

| State | Behaviour |
|---|---|
| Empty query | show recent history, unfiltered |
| No results | show the four suggestion chips — never a bare "no results" |
| One result | open it directly? **No** — always show the list, so the judge sees the search worked |
| Index not built | render the feed and re-attempt; search never blocks the page |

Suggestion chips are visible **before** the judge types, offering
`revenue recognition exception`, `approval missing`, `September revenue audit`,
and `REV-REC-01`. If a judge freezes at the keyboard, the demo still lands.

---

## 8. Out of scope

`TODO`/P2: semantic or vector search, fuzzy typo tolerance beyond prefix
matching, cross-field boolean query syntax, saved searches, search analytics,
server-side search. None of them improve the judge-facing core experience within
8 hours (guideline §19).
