# Product workspace

Status of the Iteration 7 audit workspace on `new-product`.
This is not the locked guided demo.

## Principle

Humans perform audits. AI assists. Every meaningful AI action becomes
traceable work. Evidence supports findings. Humans decide. Completed
executions can later be sealed. New product work is **unsealed**.

## What exists

| Capability | State |
|---|---|
| Audit list | IMPLEMENTED — name, domain, status, execution, last activity |
| Create audit | IMPLEMENTED — name, domain, description, optional period |
| Audit workspace | IMPLEMENTED — chat, live trace, evidence, findings |
| Evidence upload | IMPLEMENTED — PDF/CSV/XLSX/TXT; TXT/CSV extracted |
| Deep PDF/XLSX extraction | TODO |
| AI chat + structured actions | IMPLEMENTED — server gateway |
| Live trace | IMPLEMENTED — unsealed action history |
| Findings + human review | IMPLEMENTED — Accept / Modify / Reject, modify note |
| Close execution | IMPLEMENTED — local and hero-reopen children |
| Reopen | IMPLEMENTED — new execution, old trail unchanged |
| Execution history / lineage | IMPLEMENTED |
| Canonical event mapping | IMPLEMENTED — unsealed candidates, not receipts |
| Persistence | MOCK — `localStorage` (`veriaudit.product.workspace.v1`) |
| CooL sealing of new work | TODO |
| Auth / orgs / billing | TODO |

## Flow

```
Landing → Explore product → Audits → Create audit
  → Workspace (evidence, AI, findings, live trace)
  → Review finding → Close execution → History → Reopen
```

The guided demo stays on `/demo`.

## Execution states

| Status | Meaning |
|---|---|
| Active (`open`) | Writable, unsealed |
| Review required | Active, with pending AI findings |
| Closed | Immutable, unsealed |
| Sealed | Hero original only |
| Recorded / Sample | Catalog rows |

Closing does not write into the previous execution. Reopening creates
`EXEC-…-002` with `parentExecutionId`.

## Canonical events

`lib/product/canonicalEvents.ts` maps local activity to types such as
`audit.started`, `evidence.ingested`, `ai.action.completed`,
`finding.reviewed`, `audit.closed`. These are **not** CooL receipts.
