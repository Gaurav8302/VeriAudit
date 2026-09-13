# AI workflow

How the product AI uses evidence. This is not ChatGPT with an audit theme.

| Capability | State |
|---|---|
| Execution-scoped analysis | IMPLEMENTED |
| Retrieved chunks only in the prompt | IMPLEMENTED |
| Evidence-backed vs insufficient | IMPLEMENTED |
| Citation validation | IMPLEMENTED — unknown IDs dropped |
| Provider fallback | IMPLEMENTED |
| Auto-approve findings | Never |

## Contract

The analyze route returns `reply`, `confidence`, `grounding`,
`evidenceReferences`, `suggestedFindings`, and structured `actions`.

`evidenceReferences` only include IDs that retrieval actually produced.

If nothing relevant is found, the product answers:

> I couldn't find enough evidence in the uploaded audit materials to
> support that conclusion.

The model is not asked to invent an answer in that case.

## Canonical trail

A completed analysis is recorded as product events, not as a chat
transcript:

1. `ai.action.started`
2. `evidence.read` when retrieval ran
3. `ai.action.completed` with an output commitment (action id, evidence
   ids, chunk ids, finding id)
4. `finding.created` when a finding was suggested
5. `finding.reviewed` when a human accepts, modifies, or rejects it

Those events are sealed only when the execution is closed. The AI is never
the human reviewer.

See [EXECUTION_SEALING.md](EXECUTION_SEALING.md).

## Keys

API keys stay in server environment variables. They are not
`NEXT_PUBLIC_*` and are not sent to the browser.
