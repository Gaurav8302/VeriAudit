# Trace model

The live trace is the machine-readable record of work on one execution.
Chat is only the explanation.

| Record | State |
|---|---|
| Upload / add evidence | IMPLEMENTED |
| SEARCH_EVIDENCE (what was retrieved) | IMPLEMENTED |
| READ_EVIDENCE | IMPLEMENTED |
| ANALYZE_EVIDENCE (request, evidence, result) | IMPLEMENTED |
| CREATE_FINDING → human review | IMPLEMENTED |
| CooL seal of these actions | TODO — status remains Unsealed |

Canonical event mapping in `lib/product/canonicalEvents.ts` is independent
of CooL. Those records are not receipts.
