# Fable 5 Handoff

What to design. What not to change.

---

## Product

VeriAudit is an **audit execution accountability** system.

It is not a chatbot, not a generic AI dashboard, and not a cryptography
showcase.

### Core promise

> When AI makes an important decision, you should be able to reconstruct
> exactly what happened months later — and verify the integrity of the
> record.

---

## Demo story

The audience must **feel the problem before seeing the solution.**

1. **Welcome** — one sentence: *Let AI perform audit work. Keep a verifiable trail of what happened.*
2. **Choose an audit.** Financial is recommended. Legal, Cyber, and Procurement are complete first-class demos on the same engine.
3. **Run audit** — staged progress. Not a fake spinner. Result is computed (12 controls, 9 pass, 3 exceptions).
4. **Show the result** — findings, human review, conclusion. Steer toward simulation before the trail.
5. **Simulate three months** — copy is *“Three months later…”*, never “generate random data.”
6. **Busy history** — 55 activities. The September audit is genuinely far down the list.
7. **Boss question** — *“Why did we flag this revenue transaction? The client is disputing it and I need to know what the AI actually did.”*
8. **Search** — suggested chip `revenue recognition exception`. Also works: `why did we flag this revenue transaction`.
9. **Open the exact audit** — `AUD-FIN-2026-09` / `EXEC-FIN-2026-09-001`. Same decision as three months ago.
10. **Execution trail** — Evidence → Retrieval → Model → Control → Finding → Review → Conclusion.
11. **Inspect** evidence, the AI action, the finding, the human review, the conclusion.
12. **CooL verification** — passed / failed / unavailable / not recorded. Never a single green “trust” badge.

Target run: **4–5 minutes**. Timing hints: `lib/demo/copy.ts` → `DEMO_TIMING_SECONDS`.

---

## UX principles

Design for:

**Accountability · Traceability · Reconstruction · Verification**

Do not design a command center full of widgets. Two beats only:

1. The work got buried.
2. We can still reconstruct it and check the record.

The climax is the boss question, not the receipt.

---

## Design freedom

You may decide:

- layout, typography, visual hierarchy
- graph / timeline styling (the backend already has the edges)
- cards, transitions, sidebar
- search presentation and onboarding visuals
- motion — as presentation, not as fake telemetry

---

## You must not change

| Locked | Why |
|---|---|
| Backend semantics and API meaning | Contract: `FRONTEND_CONTRACT.md` |
| State machine and legal transitions | `DEMO_STATE_MACHINE.md`, `lib/demo` |
| Financial result 12 / 9 / 3 | Computed by the engine |
| Causal order of the trail | Backend `why.path` |
| Verification statuses | `verified` / `failed` / `unavailable` / `not-recorded` |
| CooL claims | Simulated attestation; not a correctness proof |
| Hero burial | Backend corpus; do not hide the row in CSS |

Do not invent findings, events, or a “VERIFIED” label when the API says
`unavailable`.

---

## Screens ↔ states

| Screen | State | Data |
|---|---|---|
| Welcome | `welcome` | static copy |
| Scenario picker | `scenario_select` | `GET /api/audits` |
| Running | `running` | wait for `POST /api/audits/run` |
| Result | `result` | run payload |
| Simulate CTA | `simulate_ready` | — |
| Three months later | `simulating` | `POST /api/simulation/start` |
| History feed | `history` | 55 activities |
| Boss + search | `investigation` | authored question |
| Results | `search_results` | `GET /api/search` |
| Historical audit | `reconstruction` | `GET …/reconstruction` |
| Trail | `trail` | `why` + `graph` |
| Verify | `verification` | POST receipts |

---

## Copy you can use

From `lib/demo/copy.ts`:

- Welcome line, boss question, “Three months later…”
- “CooL verification passed”
- “Execution integrity verified”
- “Trusted execution identity verified”
- “Verification unavailable for this session”
- “Integrity verification failed”
- “This verifies that the recorded execution has not been silently changed. It does not mean the AI decision was objectively correct.”

Do not use: “100% trustworthy”, “AI cannot be wrong”, “Guaranteed authentic”,
“Blockchain verified”, “Tamper-proof forever”, “hardware-attested”.

---

## Technical pointers

- Contract: `docs/FRONTEND_CONTRACT.md`
- States: `docs/DEMO_STATE_MACHINE.md`
- Reducer: `lib/demo/state-machine.ts` — `transition(session, event)`
- Golden path: `walkGoldenPath()`
- Hero query: `revenue recognition exception`
- Store receipts from `POST /api/audits/run`; GET routes cannot regenerate them

The state machine rejects illegal jumps. Drive the UI from `session.state`
and `session.phase` only.

The product application at `/product` is a later, separate experience. Do not
collapse it into the guided demo. See [PRODUCT_APPLICATION.md](PRODUCT_APPLICATION.md).
