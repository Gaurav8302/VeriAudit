# Product CooL integration

How the `/product` workspace uses the existing CooL adapter.

This is **not** a second evidence plane. Product sealing calls the same
`recordEvents` / `verifyReceipt` path as the locked demo.

## What is implemented

| Step | State |
|---|---|
| Canonical product events | IMPLEMENTED |
| Evidence / finding / AI commitments | IMPLEMENTED |
| Seal on execution close | IMPLEMENTED |
| Server verification | IMPLEMENTED |
| Trusted key allow-list | IMPLEMENTED — unchanged |
| Measurement pin | IMPLEMENTED — unchanged |
| Inclusion + tree rehydration | IMPLEMENTED |
| Hardware attestation | UNAVAILABLE — simulated mode |
| Enclave / witnesses / anchor | UNAVAILABLE / absent |
| Durable server receipt store | MOCK — receipts live in the workspace |

## Flow

```text
canonical product event
        ↓
public binding / content digest
        ↓
CooL recordEvents
        ↓
receipt + logState
        ↓
POST /api/product/executions/verify
```

Product event names (`audit.execution.started`, `evidence.read`, …) are stored
in `detail.product_event`. The CooL `type` stays in the existing vocabulary
(`audit.started`, `retrieval.executed`, `model.executed`, …).

## Trust rules that stay load-bearing

1. Software identity still sets `digest: null`.
2. `verifyEvidence.ok` alone is not VERIFIED.
3. VERIFIED still requires the published key allow-list, the pinned
   measurement, and `inclusion === "pass"`.
4. A receipt's own `key_directory` is not proof that VeriAudit produced it.
5. The tree is rehydrated from public `mh:sha256:…` leaf hashes.
6. Deleting a historical leaf fails consistency / root checks.

## What is not sealed

Raw documents, prompts, chat rendering, and UI state are not placed in CooL
events. Events carry evidence IDs, fingerprints, chunk IDs, finding IDs, and
output commitments.

## Persistence

Vercel invocations are stateless. Product receipts are stored in the browser
workspace (`localStorage`, `veriaudit.product.workspace.v1`). The server
verifies caller-held receipts. That is the same honesty model as the demo.

This is `MOCK` persistence. It is not a database.

## Locked demo

`/demo` is unchanged. Product routes do not rewrite hero
`EXEC-FIN-2026-09-001`.
