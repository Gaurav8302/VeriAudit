# Evidence intelligence

Status of the Iteration 8 evidence layer on `new-product`.
This is not a vector database and not the locked demo.

| Capability | State |
|---|---|
| Upload + SHA-256 fingerprint | IMPLEMENTED |
| TXT / CSV / JSON parse | IMPLEMENTED |
| Lightweight PDF text extraction | IMPLEMENTED — text PDFs only |
| XLSX cell extraction | TODO — fingerprinted, honest “unavailable” |
| Addressable chunks | IMPLEMENTED |
| Deterministic lexical retrieval | IMPLEMENTED |
| External vector DB / LangChain | TODO — not introduced |

## Flow

```
file → fingerprint → parse → chunks → evidence record
query → tokenize → score chunks → top hits → AI context
```

Chunks live on the execution evidence record in `localStorage`.
The same document is not re-parsed on every chat turn.

## Honesty

If text cannot be extracted, the file is still attached and fingerprinted.
The UI says Ready or Fingerprint only or Failed. It does not invent contents.
