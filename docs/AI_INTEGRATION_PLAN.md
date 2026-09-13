# AI integration plan

Status of the product-layer AI gateway on `new-product`.
This is not the locked guided demo and not the CooL adapter.

| Capability | State |
|---|---|
| Server gateway + fallback | IMPLEMENTED |
| Structured actions on the execution | IMPLEMENTED |
| Chat as explanation only | IMPLEMENTED |
| Human review of AI findings | IMPLEMENTED |
| Provider names as the product | MOCK — subtle “AI analysis / Mock analysis” only |
| Live keys on Vercel | MOCK until the host has keys |
| CooL sealing of AI work | TODO |

## Principle

VeriAudit is not ChatGPT with an audit skin.

```
AUDIT
  └── EXECUTION
        ├── Evidence
        ├── Conversation          (chat data)
        ├── AI actions            (structured work)
        ├── Findings
        └── Human decisions
              ↓
            TRACE                 (action history)
              ↓
        future CooL sealing
```

A conversation is conversational data. The audit trail is structured
execution data. Chat never claims to be a CooL receipt.

## Gateway architecture

Server-only module: `lib/ai/`.

```
POST /api/product/ai/analyze
        ↓
   AI Gateway
        ├── OpenRouter
        ├── Groq
        └── NVIDIA
        ↓
   NormalizedAiResponse
        ↓
   structured actions
        ↓
   product workspace (client persist)
```

The browser never sees provider SDKs or API keys. Route handlers run on
the Node runtime. Product UI posts a prompt plus execution-scoped evidence
summaries. The gateway returns one normalized response.

## Provider abstraction

Every provider implements:

```ts
chat(request: AiChatRequest): Promise<NormalizedAiResponse>
```

Normalized shape:

```ts
{
  provider: "openrouter" | "groq" | "nvidia" | "mock",
  model: string,
  response: string,
  usage: { promptTokens, completionTokens } | null,
  latencyMs: number,
  requestId: string | null,
  status: "ok" | "unavailable",
  mode: "live" | "mock"
}
```

Provider-specific JSON is not used outside `lib/ai/providers`.

## Fallback

Bounded chain, one attempt each:

1. OpenRouter
2. Groq
3. NVIDIA

A provider is skipped when its key is missing. Failure conditions:
timeout, HTTP 429, 5xx, missing model, network error.

The user receives one reply. Failed hops are recorded as action
`failed` records, not as extra assistant messages.

If every hop fails:

> AI analysis is temporarily unavailable.
> Your audit workspace and existing records are safe.

No findings are invented from a failed call.

## Environment

Names only. Values live in `.env.local` and the host environment.

| Name | Role |
|---|---|
| `AI_MODE` | `live` or `mock` |
| `OPENROUTER_API_KEY` | OpenRouter |
| `GROQ_API_KEY` | Groq |
| `NVIDIA_API_KEY` | NVIDIA NIM |
| `OPENROUTER_MODEL` | default `openai/gpt-4o-mini` |
| `GROQ_MODEL` | default `qwen/qwen3.8-27b` (Groq's current general chat model; Llama chat IDs are gone) |
| `NVIDIA_MODEL` | default `mistralai/mistral-7b-instruct-v0.3` |
| `AI_TIMEOUT_MS` | per-provider timeout, default 12000 |

Keys are never `NEXT_PUBLIC_*`. `.gitignore` already excludes `.env*`
except `.env.example`.

## Conversation model

Every message belongs to one execution.

```
messageId
executionId
auditId
role            user | assistant | system
content
occurredAt
provider?       assistant only
model?
requestId?
mode?           live | mock
```

Conversations do not cross execution boundaries. The sealed hero
original cannot receive messages.

## AI action model

Meaningful work is stored as actions, not as raw prompt/response pairs.

Types:

- `SEARCH_EVIDENCE`
- `READ_EVIDENCE`
- `ANALYZE_EVIDENCE`
- `COMPARE_EVIDENCE`
- `CREATE_FINDING`
- `UPDATE_FINDING`
- `SUMMARIZE`
- `REQUEST_HUMAN_REVIEW`

Each action:

```
actionId
executionId
type
title
status          started | completed | failed
evidenceIds
findingId?
occurredAt
completedAt?
detail
```

The model is asked for JSON `{ reply, actions[] }`. If the live model
returns prose only, the conversation is still saved and a `SUMMARIZE`
action is recorded. `completeStructuredWork` then records a `READ_EVIDENCE`
action for each attached item the model omitted — those files were
actually sent to the gateway. If the reply or actions already request
human review, a `CREATE_FINDING` proposal is added so the exception is
structured and stays under review. Failed gateway calls still create no
findings.

## Evidence

Evidence is not a chat attachment blob.

```
artifactId
executionId
filename?
kind
source
description
fingerprint?    sha256 of uploaded bytes
extraction      text | unavailable | none
textExcerpt?    capped extracted text for analysis
sample          true for metadata-only sample rows
```

AI actions reference `artifactId` values.

Upload accepts PDF, CSV, XLSX, TXT. TXT and CSV are extracted. PDF and
XLSX are fingerprinted and stored as metadata; extraction is labelled
unavailable. Contents are never fabricated.

## Findings

AI findings are structured and start `under_review`.

```
findingId
executionId
title
severity
status
description
evidenceIds
originatingActionId
origin            ai | user
review            pending | accepted | modified | rejected
```

They are never auto-approved. Human accept / modify / reject is a
separate activity. Modify requires a short human note.

## Live trace

The AI workspace shows chat on the left and the execution action trace
on the right. Chat text is not the trace.

Sealed hero events stay on Execution 001. New AI actions are unsealed
product activity. They are shaped so a later iteration can map them to
canonical execution events and seal the execution once, not message by
message.

## Mock / development mode

`AI_MODE=mock` is deterministic and labelled **Mock analysis**. It
produces structured actions and a finding when the prompt asks to check
revenue against policy. It never claims to be a live provider.

Unit tests use the mock and injected provider stubs. They do not call
the network and do not read API keys.

## Future CooL sealing

The existing `lib/cool` adapter is unchanged. New AI work is `UNSEALED`.
The action record is the candidate event source for a later seal of the
whole execution.

## Protected systems

- Locked guided demo
- Hero execution `EXEC-FIN-2026-09-001` (30 events, F-FIN-001/002/003)
- CooL recorder / verifier
- Financial audit engine
