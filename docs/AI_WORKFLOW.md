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

## Keys

API keys stay in server environment variables. They are not
`NEXT_PUBLIC_*` and are not sent to the browser.
