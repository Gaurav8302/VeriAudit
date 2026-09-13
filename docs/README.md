# VeriAudit documentation

Discovery and specification set, written before implementation per
`VeriAudit_CURSOR_BUILD_GUIDELINE.md` §0.

## Reading order

| # | Document | What it settles |
|---|---|---|
| 1 | [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md) | **AUTHORITATIVE PRODUCT SPECIFICATION.** Product intent, demo psychology, priorities |
| 2 | [COOL_SDK_AUDIT.md](COOL_SDK_AUDIT.md) | what `cool-nwc@3.0.0` actually does, proven by running it. **Read before anything technical** |
| 3 | [ARCHITECTURE.md](ARCHITECTURE.md) | repository inventory, stack, layers, the no-database decision |
| 4 | [COOL_INTEGRATION.md](COOL_INTEGRATION.md) | which events are CooL-backed and why; the adapter contract |
| 5 | [EVENT_MODEL.md](EVENT_MODEL.md) | event shape, causal relationships, CooL field mapping |
| 6 | [DATA_MODEL.md](DATA_MODEL.md) | entities, identifiers, indexes, storage footprint |
| 7 | [DEMO_FLOW.md](DEMO_FLOW.md) | the 12-stage judge-facing path, stage by stage |
| 8 | [SIMULATION_SPEC.md](SIMULATION_SPEC.md) | how three months of history are generated, deterministically |
| 9 | [SEARCH_SPEC.md](SEARCH_SPEC.md) | the index, the filters, the guaranteed demo queries |
| 10 | [VERIFICATION_SPEC.md](VERIFICATION_SPEC.md) | what is verified, and the claim boundaries |
| 11 | [SECURITY_AND_CLAIMS.md](SECURITY_AND_CLAIMS.md) | what we claim, what we refuse to claim, the threat model |
| 12 | [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel architecture, runtime, env vars, checklist |
| 13 | [TESTING_PLAN.md](TESTING_PLAN.md) | tests per area, release blockers |
| 14 | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | the 8-hour plan, P0/P1/P2, risk register |
| 15 | [README_PLAN.md](README_PLAN.md) | plan for the public root README |

Reproducible SDK evidence lives in [`../cool-proof/`](../cool-proof). Upstream
SDK documentation in `../cool-sdk/docs/` is cited rather than duplicated.

## Evidence tags

Every technical statement carries one:

- **CONFIRMED** — verified by inspecting source or by running code, with output.
- **INFERRED** — reasonable architectural inference, stated as such.
- **TODO** — not yet implemented.
- **UNKNOWN** — needs investigation.

---

# Consistency review

Final pass over the chain
`SOURCE OF TRUTH → ARCHITECTURE → COOL INTEGRATION → EVENT MODEL → DATA MODEL →
DEMO FLOW → SIMULATION → SEARCH → VERIFICATION → DEPLOYMENT`.

Contradictions were resolved by, in order: (1) actual CooL SDK capabilities,
(2) official product requirements, (3) the 8-hour constraint. No functionality
was invented to resolve one.

## Numbers reconciled across documents

| Quantity | Value | Appears in |
|---|---|---|
| Hero audit | `AUD-FIN-2026-09` | data model, demo flow, simulation, search |
| Audit result | 12 tested / 9 passed / 3 exceptions | source of truth, demo flow, testing |
| Hero artifacts | 4 | demo flow, data model, verification |
| Hero events generated | 30 | event model, data model, demo flow |
| Hero events CooL-backed | **9** | CooL integration, event model, demo flow, deployment |
| `finding.created` position | leaf 6 of tree 9 | demo flow, verification |
| Findings / reviews | 3 / 3 | all |
| Audits total | 14 (5 financial incl. hero, 3 each other scenario) | data model, simulation |
| Activities | 55 (≥50 required) | simulation, data model, testing |
| Timeline | hero `2026-09-15`, `DEMO_TODAY 2026-12-15`, 91 days | simulation, testing |
| Receipt size | ~29.7 KB | SDK audit, data model, simulation |
| Hero receipt total | ~270 KB | data model, event model |
| Guaranteed search queries | 8 | search, testing |

## Contradictions found and resolved

### 1. "Important events should be backed by CooL" vs. 30 KB and 17 ms per receipt

*Source of truth §7 wants CooL-backed evidence for important events; §6 lists
eleven event types; the simulation needs 50+ activities.*

**Resolved** by the SDK measurements: 9 canonical events per hero execution are
CooL-backed; the 55 simulated activities are not. Recording everything would
mean ~1.7 MB and ~930 ms for evidence nobody opens. The source of truth itself
says "Do not merely install `cool-nwc` and call one function" — nine
purposefully chosen events with documented reasons satisfies that better than
fifty-five indiscriminate ones. The UI labels unbacked records honestly.

### 2. "Verification" as a single VERIFIED state vs. what `verdict.ok` means

*Source of truth §3 step 8 shows a four-line VERIFIED panel.*

**Resolved** in favour of the SDK's real semantics. Two findings forced it:
`verdict.ok` stays `true` when the inclusion proof is stripped entirely, and a
receipt from any evidence plane verifies `ok: true` because it carries its own
keys. VeriAudit therefore adds a `key_id` allow-list, `expectedMeasurement`
pinning, and its own `inclusion === "pass"` requirement. The panel keeps the
source of truth's shape but shows `simulated` for the two hardware domains
rather than implying they passed.

### 3. Product wants a deployed, stateless Vercel app; a transparency log wants persistence

*Source of truth §11 requires a Vercel link; the SDK's own source warns that a
per-process log makes "a hundred trees of size one".*

**Resolved** by a confirmed SDK capability rather than by adding a database: the
tree rehydrates from an ordered list of public `binding_hash` strings, so the
client carries the log state and one append-only tree spans stateless
invocations. Honest limitation recorded — the head is client-held and there are
no external witnesses.

### 4. "Three months pass" vs. receipts sealed today

*The demo narrative is historical; every receipt's `issued_at` is now.*

**Resolved** by separating the two clocks explicitly (`occurredAt` vs.
`issued_at`, labelled **Occurred** and **Sealed** in the UI) and by stating in
the README that the history is simulated. Presenting the sealing time as
historical proof would be an overclaim. No functionality was invented.

### 5. P1 ordering: other scenarios vs. tamper demo

*Source of truth §13 lists the other three scenarios before the tamper demo.*

**Resolved** by guideline §19's decision rule: the tamper demo strengthens the
CooL integration, which is explicitly scored, at a fraction of the cost of three
scenarios. Reordered, and the deviation is flagged in the implementation plan
rather than made silently.

### 6. Guideline's doc list vs. the fuller set requested

*Guideline §2 lists 7 documents; the discovery brief lists 15.*

**Resolved** as a superset. The guideline's seven are all present with their
required content; `COOL_SDK_AUDIT.md`, `EVENT_MODEL.md`, `SIMULATION_SPEC.md`,
`SEARCH_SPEC.md`, `VERIFICATION_SPEC.md`, `SECURITY_AND_CLAIMS.md`,
`TESTING_PLAN.md`, and `README_PLAN.md` are additions, not replacements.

## Remaining open items

| Item | Type | Where it is resolved |
|---|---|---|
| ~~`cool-nwc` on Vercel's Node runtime~~ | **`CONFIRMED`** — was the only unproven link | **Resolved in Milestone 1**: 29/29 checks, byte-identical fingerprint. `DEPLOYMENT.md` §11 |
| ~~Cold-start and per-record timing on Vercel~~ | **`CONFIRMED`** | **Resolved in Milestone 1**: 291 ms connect, 35.9 ms/record in `iad1` |
| Hardware attestation, witnesses, anchoring | `UNKNOWN`, P2 | out of scope; never claimed |
| `npx cool-nwc verify` on a downloaded receipt | `UNKNOWN`, P1 | Milestone 9 stretch |
| Upstream report of the `software.digest` bug | `TODO` | after the build |
| Behaviour under concurrent requests on Vercel | `UNKNOWN` | Milestone 8; the Milestone 1 proof is single-request |

No contradiction remains unresolved.

---

## Milestone 1 corrections

Implementation contradicted the documentation in two places. Both are corrected
in place rather than quietly dropped:

1. **Tamper case 16 wording.** `COOL_SDK_AUDIT.md` §6 said "drop both
   `inclusion` and `sth`" yields `ok: true`. The harness actually assigned
   `null`; *deleting* the keys fails the SDK's structural validator instead. The
   security gap is real and unchanged — the `null` variant is the one an attacker
   would pick — but the mechanism is now stated precisely, and identified as the
   same `undefined`-vs-`null` asymmetry as the `software.digest` bug (§7.1).
2. **Key substitution was expected to fail verification.** It does not, and
   should not: pinning merges the real key back over the substituted one, so a
   genuine receipt still verifies. `COOL_SDK_AUDIT.md` §7.6 now sets out all
   three key-substitution cases and which defence covers each.
