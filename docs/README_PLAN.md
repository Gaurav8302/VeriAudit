# README Plan

Plan for the root `README.md`, written after implementation stabilises
(guideline §2). This is the outline, the required content, and the claim
discipline — not the final prose.

Audience: a Round 2 judge who has ~3 minutes before opening the Vercel link.

---

## Structure

```text
Title + one-line pitch
Live demo + repo links (above the fold)
1.  What is VeriAudit?
2.  The problem
3.  The product
4.  The demo (3-minute judge path)
5.  Architecture
6.  CooL integration
7.  Why CooL matters here
8.  Installation
9.  Environment variables
10. Running locally
11. Deployment
12. Technical decisions
13. Limitations
14. Future work
15. Links + license
```

---

## Above the fold

```markdown
# VeriAudit

**Ask, months later, "Why did the AI make this decision?" — and reconstruct a
searchable, verifiable trail of what actually happened.**

[**Live demo**](https://veriaudit.vercel.app) · [GitHub](…) · Built on [`cool-nwc`](https://www.npmjs.com/package/cool-nwc) v3.0.0

> 3-minute judge path: run the financial audit → simulate three months →
> search `revenue recognition exception` → open the execution trail → verify.
```

The Vercel URL and the 3-minute path go first. A judge who reads nothing else
must still know where to click.

---

## 1. What is VeriAudit?

The one-sentence product from the source of truth §15, then the distinction from
§4:

> Ordinary history answers *"what did we talk about?"* VeriAudit answers *"what
> did the AI actually do, what evidence did it use, what finding did it produce,
> what did the human reviewer do, and can the recorded evidence be verified?"*

State plainly what it is **not**: not a chatbot, not chat-history search, not a
generic audit dashboard, not a cryptography showcase.

## 2. The problem

Three short paragraphs:

1. AI now performs real audit work and keeps working for months.
2. The history becomes large and the original work is buried.
3. Someone senior asks why a decision was made — and scattered chat logs cannot
   answer it. They have no structure, no evidence links, no human-review record,
   and nothing tamper-evident.

Must explicitly cover **why ordinary chat history is insufficient** (guideline
§18.3), not just that it is.

## 3. The product

Four capabilities, one line each: deterministic AI audit workflow; structured
execution events with causal relationships; search and reconstruction over
months of history; CooL-backed cryptographic evidence with real verification.
Plus human-in-the-loop review as a first-class, separately verifiable event.

## 4. The demo

The 12 stages from `DEMO_FLOW.md`, compressed into a numbered list with 2–3
screenshots: the execution trail, the verification panel, and the buried history
feed. The trail screenshot is the one that sells the product.

## 5. Architecture

The Mermaid diagram from `ARCHITECTURE.md` §5, then the layer split:

- **Product layer (VeriAudit)** — audit workflows, scenarios, event semantics,
  execution graph, search, simulation, human review, UI.
- **CooL layer (`cool-nwc`)** — canonical encoding, salted commitments, hybrid
  post-quantum signatures, RFC 6962 transparency log, the 7-domain verifier.

One paragraph on why there is no database, because it is the most
counter-intuitive choice and it is a direct consequence of an SDK property:
deterministic keys + self-contained receipts + a rehydratable log.

## 6. CooL integration

The part a judge is scoring. Must be concrete, not decorative:

- Package and version: `cool-nwc@3.0.0`, from npm.
- The adapter boundary: `lib/cool/{client,recorder,verifier,log-state,identity}` —
  and that nothing else imports the SDK.
- **Which nine events are CooL-backed, and why each one** (the table from
  `COOL_INTEGRATION.md` §3). This is where "we installed it and called one
  function" is disproven.
- The data flow, from AI operation to verification UI.
- What a receipt contains (commitments, not data) and what it returns.
- The transparency log: one append-only tree rehydrated from the ordered binding
  hashes, so `inclusion` is a real proof rather than a tree of size one.
- Verification: `withTrustedKeys` + `expectedMeasurement` + `key_id` allow-list +
  our own `inclusion === "pass"` requirement — **with the reason each is needed**,
  because each came from a real finding.
- A real sample receipt (abbreviated) and a real verdict block.
- A pointer to `cool-proof/` as reproducible evidence, with the commands.

## 7. Why CooL matters here

Four sentences, no hype:

1. Reconstruction is only worth anything if the reconstructed record is
   trustworthy.
2. CooL makes each recorded step tamper-evident and offline-verifiable, with no
   account and without revealing the data.
3. The commitment model means sensitive evidence can be proven to exist and be
   unaltered without disclosing it.
4. The transparency log means removing an inconvenient record is detectable, not
   just editing one.

## 8. Installation

```sh
git clone <repo> && cd veriaudit
npm install
```

Note: Node ≥ 20, `cool-nwc` is ESM-only, no native build, no postinstall, no API
keys.

## 9. Environment variables

The table from `DEPLOYMENT.md` §4, with the two warnings that will otherwise cost
someone an hour:

- `COOL_IMAGE_DIGEST` must match the value `lib/cool/identity.ts` was generated
  against, or every verification fails.
- `COOL_DSTACK_ENDPOINT` must stay **unset**.

And the honest headline: **there are no secrets** — signing keys are derived from
the measurement, never stored.

## 10. Running locally

```sh
cp .env.example .env.local
npm run dev            # http://localhost:3000
npm run cool:proof     # reproduce the SDK verification harnesses
npm test
```

## 11. Deployment

Vercel project settings, the Node 22 runtime requirement and why (not Edge), the
deployment checklist from `DEPLOYMENT.md` §9, and the live URL.

## 12. Technical decisions

A table of decision → reason, favouring the ones a reviewer would otherwise
question:

| Decision | Reason |
|---|---|
| Next.js on Vercel, one project | the SDK needs no filesystem, socket, or daemon, so a separate backend buys nothing |
| Node runtime, not Edge | the vendor declines to support Edge; ML-DSA is CPU-bound |
| No database | deterministic keys + self-contained receipts + a rehydratable log make one unnecessary |
| Deterministic generated history | the same demo result every run; no LLM decides the hero audit |
| Keyword index, not semantic search | the demo query must work every time; reliability over sophistication |
| 9 CooL-backed events, not all 55 activities | 30 KB and 17 ms per receipt; evidence where it earns its cost |
| Hand-laid-out trail, no graph library | the trail is a known 8-node causal spine |
| `software.digest` always set explicitly | omitting it produces a receipt that fails verification (SDK behaviour, documented in `docs/COOL_SDK_AUDIT.md` §7.1) |

## 13. Limitations

The section that earns trust. Verbatim from `SECURITY_AND_CLAIMS.md` §2 and §3:

- **Simulated, not hardware-attested.** Every receipt reads
  `mode: "simulated"`; `attestation` and `enclave` are never `pass`. No TDX /
  SEV-SNP / dstack CVM.
- **No external witnesses.** `witnesses` is permanently `absent`; the only
  co-signature is CooL's own, marked non-independent.
- **No public anchor.** `anchor` is always `absent`.
- **Does not prove the AI was correct.** Authenticity, not accuracy.
- **Not regulatory compliance.** Synthetic data, illustrative controls.
- **Not complete capture.** Only what VeriAudit's engine emits.
- **Tamper-evident, not tamper-proof.** Deleting a receipt destroys it; what
  stays detectable is that the log no longer matches its earlier signed head.
- **Sealing time ≠ historical time.** The three-month history is simulated;
  `issued_at` is when the receipt was sealed, which is when the demo ran.
- **Session-scoped evidence.** Receipts live in the browser's IndexedDB; the log
  head is client-held.
- **One scenario is deep.** Financial is fully built; the other three are
  scenario data only.

Also list the two gaps we found and compensate for, because finding them is a
credibility signal: `verdict.ok` permits a stripped inclusion proof, and a
receipt's embedded key directory is self-asserted.

## 14. Future work

External witnesses and log gossip · OpenTimestamps/Bitcoin anchoring · real Phala
dstack deployment with hardware attestation and `requireAttestation` ·
independently witnessed durable log (Trillian/Rekor) behind the same
`EvidenceLog` seam · the other three scenarios at hero depth · selective
disclosure UI via `cool disclose` · downloadable audit packs verifiable with
`npx cool-nwc verify` · semantic search.

## 15. Links + license

Live demo · GitHub repository · `cool-nwc` on npm and its GitHub · the `docs/`
index · license. Credit `cool-nwc` (Apache-2.0, Northwind Cipher Pvt. Ltd.).

---

## Writing rules

1. **No claim without an implementation.** If it is not in
   `SECURITY_AND_CLAIMS.md` §1, it does not go in the README.
2. **Never** *hardware-attested*, *quantum-proof*, *unhackable*,
   *production-ready*, *immutable*, or *proves the AI was correct*.
3. Limitations are a real section with real content, not one hedging sentence.
4. Show real output — an actual receipt, an actual verdict block — rather than
   describing what it would look like.
5. Lead with the demo link.
6. Architecture diagram included (guideline §18).
7. Say plainly that all data is synthetic.

## Blockers before publishing

```text
[ ] live Vercel URL present and working
[ ] screenshots of the trail and verification panel
[ ] a real receipt + real verdict pasted in
[ ] cool-proof/ commands verified from a clean clone
[ ] limitations complete
[ ] no secrets; .env.example present
[ ] every claim traceable to SECURITY_AND_CLAIMS.md §1
```
