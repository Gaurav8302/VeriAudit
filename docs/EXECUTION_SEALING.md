# Execution sealing

An **audit** is the workspace. An **execution** is one run of work inside it.

```text
AUDIT
  ├── EXEC-001   closed / sealed
  └── EXEC-002   active
```

EXEC-001 is never rewritten by EXEC-002.

## Lifecycle

```text
active → closed → sealed → verified
```

- **Active** — writable, unsealed. AI actions are recorded locally only.
- **Closed** — immutable product record. Not yet cryptographic evidence.
- **Sealed** — CooL produced receipts for the canonical events.
- **Verified** — the server verified those receipts. The browser cannot decide this.

Closing creates the audit boundary. Intermediate AI requests are not sealed
automatically.

## Close contract

1. Record remaining canonical events, including `audit.execution.closed`.
2. Build the CooL tree from those events.
3. Persist the receipt bundle and public log state.
4. Mark sealing status `sealed`.
5. Set verification to `verified` only after `verifyProductExecution` succeeds.

If CooL recording fails, the execution stays **closed and unsealed**.

## Endpoints

- `POST /api/product/executions/seal` — record events, return the seal bundle
- `POST /api/product/executions/verify` — verify a caller-held bundle
- `GET /api/product/executions/:id/verification` — policy and identity only.
  It cannot return VERIFIED without receipts.

A client `verified: true` field is ignored.

## Reopening

Reopening creates a new execution with `parentExecutionId`. The closed
execution, its events, and its seal stay as they were.
