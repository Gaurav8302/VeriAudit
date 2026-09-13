# Execution lineage

Lineage is the product explanation of reopen. It is not a rewrite.

```text
AUDIT-001
  └── EXEC-001
        closed / sealed
            │ reopened
            ▼
        EXEC-002
        active
```

## Rules

- An audit can contain many executions.
- The latest closed execution is the parent of the next one.
- The child starts empty. It does not copy the parent's events or receipts.
- The parent's IDs, timestamps, findings, fingerprints, and seal stay as stored.
- `HERO_ORIGINAL_SNAPSHOT` remains the frozen catalog record for
  `EXEC-FIN-2026-09-001`. Product sealing never writes into it.

## What the UI must say

The new work continues from the old execution, but does not rewrite it.

Dates stay on the execution that produced them. A later December execution does
not move the September original.
