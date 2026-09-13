# Product application

Status of the real VeriAudit workspace on the `new-product` branch. The locked
guided demo is a separate experience and is not redefined here.

## Experiences

| Route | Role |
|---|---|
| `/` | Public landing |
| `/demo` | Locked guided demo |
| `/product` | Application shell — the same destination from every product entry |

Intended judging path:

Landing → Start demo → guided demo → final screen → Explore product → `/product`

Temporary development shortcut:

Landing → Explore product → `/product`

That shortcut is marked in source as:

`TEMPORARY DEVELOPMENT SHORTCUT — REMOVE BEFORE FINAL HACKATHON SUBMISSION`

It must not expose “DEV MODE” wording. Both entry points open the same
application. There is no second dashboard.

## Information architecture

```
/product                 Overview
/product/audits          Sample audit list
/product/audits/new      Create a local WIP audit
/product/audits/[id]     Audit workspace
  /evidence
  /evidence/[artifactId]
  /findings
  /findings/[findingId]
  /executions
  /executions/[executionId]
  /executions/[executionId]/trace
  /trace
/product/executions      Global execution list
/product/evidence        Global evidence list
/product/findings        Global findings list
/product/traces          Global trace list
/product/settings        Structure only
/product/data            Authored test-data downloads
```

## Audit vs execution

An **audit** is the long-lived workspace.

An **execution** is one recorded period of work inside that audit.

A **trace** belongs to one execution. The audit does not have a single mixed
trail.

Reopening the hero audit creates a new product-level execution (`Execution 002`)
linked to `EXEC-FIN-2026-09-001`. The original execution, its events, findings,
and reconstruction remain unchanged. The new execution starts with an empty
trace. No events are fabricated.

Relationship language in the UI:

- “Reopened from Execution 001”
- “The original sealed execution remains unchanged.”

Not `reopenedFrom = EXEC-…`.

Lifecycle statuses in the product workspace:

| Status | Meaning |
|---|---|
| Open | Work is currently being performed |
| Sealed | The execution is finalized and must not be rewritten |
| Reopened | A later execution has been created from an earlier one |
| WIP | A feature or catalog row is not fully implemented |

**Sealed** here is a lifecycle label. It is not CooL “Verified.” Cryptographic
receipts remain with the guided demo session.

Product work persists in `localStorage` (`veriaudit.product.workspace.v1`).
Iteration 4 reopen extras are migrated from `veriaudit.product.reopens.v1`.
The original hero execution is never stored there. It is always merged from a
frozen catalog record.

Local audits (`AUD-LOCAL-00N`) start **Open**, with one empty execution.
Sample evidence and findings attach only to writable (unsealed) executions.
They are product activity, not CooL events.

## Hero workspace

`AUD-FIN-2026-09` / `EXEC-FIN-2026-09-001` is fully explorable.

Overview uses the authored conclusion: 12 tested, 9 passed, 3 exceptions.

Evidence, findings, and the trace come from the existing reconstruction path
(`reconstructAudit`, `seal: false`). The product view does not hold demo
receipts, so CooL verification is not claimed. The original hero execution is
labelled **Sealed** as a finalized product record. Catalog-only rows stay
**Sample**. After reopen, the audit is **Reopened** and Execution 002 is
**Open**.

The product does not call `POST /api/audits/run` for workspace browsing.
Ask VeriAudit uses `POST /api/product/ai/analyze` on open executions only.

Ask VeriAudit (`/product/audits/[id]/ai`) is an execution-scoped workspace:
conversation on the left, structured action trace on the right. Uploaded
TXT/CSV files are extracted. PDF/XLSX are fingerprinted only. AI findings
start under review and are never sealed.

## What remains WIP

- Authentication, organisations, billing
- Deep PDF/XLSX extraction
- CooL sealing of AI-assisted executions
- Product-level search engine (list filter only)

## Visual system

The product application uses its own tokens in `components/product/app.css`.
It does not inherit the cinematic brass palette of the landing or guided demo.

| Layer | Role |
|---|---|
| `--app` | Outer application background |
| `--side` | Persistent sidebar |
| `--main` | Main workspace |
| `--surface` | Section / table grouping |
| `--surface-2` | Nested headers, chrome |

Typography: page title 24px, section title 17px, body 15px, tables 14px,
metadata 13px, labels 12px. Primary text is `--ink`; secondary is `--muted`;
tertiary is `--faint` and still readable.

Status badges: Sample, WIP, Open, Sealed, Reopened, Recorded. Never style a
catalog row as CooL Verified. Sealed means the original execution is finalized,
not that this product view holds receipts.

## Data honesty

Never display CooL Verified in the product workspace. The hero original may be
labelled Sealed as a finalized, immutable execution. Catalog-only rows remain
Sample. Product reconstruction without receipts does not invent cryptographic
status.
