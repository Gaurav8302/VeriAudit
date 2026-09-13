# VeriAudit --- Round 2 Source of Truth

**Status:** FINAL\
**Purpose:** Authoritative product and engineering direction for the
8-hour Round 2 build.

## 1. Product

VeriAudit is an AI audit workspace with a searchable, verifiable
execution trail.

### Core promise

> Months after an AI-assisted decision was made, an organization should
> be able to answer: **"Why did the AI make this decision?"** and
> reconstruct what happened from evidence.

VeriAudit is **not** merely: - an AI chatbot - a chat-history search
tool - a generic audit dashboard - a cryptography showcase - an "AI
receipt" generator

The product combines:

**AI audit work + continuous history + structured execution events +
search/reconstruction + human review + cryptographic evidence.**

## 2. Demo psychology

The demo must make the audience experience the problem before revealing
the solution.

The intended emotional/product sequence is:

``` text
AI can perform the work
        ↓
AI keeps working for months
        ↓
History becomes large and the original work is buried
        ↓
A senior person asks: “Why did the AI make this decision?”
        ↓
Ordinary chat history is insufficient
        ↓
VeriAudit searches for the decision
        ↓
The exact audit and execution trail are reconstructed
        ↓
Evidence, AI actions, and human review are visible
        ↓
CooL-backed evidence can be verified
```

The **boss question is the heart of the demo**.

Do not make the climax "look at our cryptographic receipt." The climax
is:

> **"Why was this decision made three months ago?"**

Cryptographic verification is the final trust layer.

## 3. Canonical demo

### Step 1 --- Onboarding

Welcome the user and explain in one screen:

> Let AI perform audit work. Keep a verifiable trail of what happened.

Then offer:

-   Financial Audit
-   Legal / Compliance Audit
-   Cybersecurity / IT Audit
-   Procurement / Vendor Controls

### Step 2 --- Financial audit

Financial audit is the hero scenario.

Use a deterministic synthetic dataset involving a realistic control such
as revenue recognition.

Example result:

``` text
12 controls tested
9 passed
3 exceptions
Human verification completed
```

The exact numbers can change, but the result must be deterministic.

### Step 3 --- Show AI working

Do not use a fake "loading..." screen.

Show meaningful stages:

``` text
Evidence loaded              ✓
Documents parsed             ✓
Relevant evidence retrieved  ✓
Controls tested              ✓
Finding generated             ✓
Human verification requested ✓
```

### Step 4 --- Three-month simulation

After the audit, provide:

> **Simulate the next 3 months**

The system generates realistic historical activity: - audit tasks - AI
executions - retrievals - findings - human reviews - follow-ups -
unrelated audit work

Target: **50+ visible historical interactions/tasks**.

The simulation exists to create the problem. It does not need
production-grade sophistication.

### Step 5 --- Boss question

Display:

> **Three months later...**
>
> "Why did we flag this revenue transaction?"

The original audit is now buried under many activities.

### Step 6 --- Search

The user searches:

> `revenue recognition exception`

or equivalent natural language.

Search should support: - audit - finding/result - date - event type -
evidence - natural-language terms

### Step 7 --- Execution trail

Open the exact audit and show a causal trail:

``` text
Source Evidence
      ↓
Retrieval
      ↓
Model Execution
      ↓
Control Test
      ↓
Finding
      ↓
Human Review
      ↓
Final Conclusion
```

The graph is the hero UI for historical reconstruction.

### Step 8 --- Verification

Show an understandable integrity state:

``` text
Execution Integrity

✓ Binding
✓ Signature
✓ Inclusion
✓ Evidence integrity

VERIFIED
```

If time permits, show a controlled tamper demo:

``` text
Original: 3 exceptions
Integrity: VERIFIED

After alteration:
Integrity: VERIFICATION FAILED
```

## 4. Product distinction

Ordinary history answers:

> "What did we talk about?"

VeriAudit answers:

> "What did the AI actually do, what evidence did it use, what finding
> did it produce, what did the human reviewer do, and can the recorded
> evidence be verified?"

Search is the entry point, not the product itself.

## 5. Human-in-the-loop

The intended workflow is:

``` text
AI analyzes
    ↓
Finding generated
    ↓
Human verification requested
    ↓
Human reviews
    ↓
Accepted / modified / rejected
    ↓
Final outcome recorded
```

VeriAudit does not claim to prove that the AI was correct.

## 6. Event model

Application-level events should include concepts such as:

``` text
audit.started
artifact.ingested
artifact.parsed
retrieval.executed
model.executed
tool.executed
control.tested
finding.created
human.review.requested
human.review.completed
conclusion.created
```

Each event should have, where applicable:

``` text
event_id
audit_id
execution_id
timestamp
event_type
actor
model/software identity
input commitment
output commitment
evidence references
parent event
CooL receipt/reference
```

Do not invent CooL API capabilities. Use the actual installed SDK API.

## 7. CooL's role

CooL is an important technical foundation, but it is not the product.

VeriAudit owns: - audit workflows - event semantics - execution graph -
search - simulation - human review - UI - scenario data

CooL should provide cryptographic evidence capabilities for important
recorded execution events.

Conceptually:

``` text
VeriAudit Event
      ↓
CooL adapter
      ↓
CooL SDK (cool-nwc)
      ↓
Evidence / receipt
      ↓
Stored reference
      ↓
Verification
```

Important events should be backed by CooL in a way that is visible in
the implementation and demo.

Do not merely install `cool-nwc` and call one function to claim
integration.

## 8. Architecture principle

The repository should be a **VeriAudit repository**, with CooL consumed
as a dependency or integrated from the cloned CooL source as required.

Recommended conceptual structure:

``` text
veriaudit/
├── frontend/
├── backend/
├── data/
├── simulation/
├── docs/
├── tests/
├── README.md
└── ...
```

If the cloned CooL repository/package structure requires a different
layout, preserve its required structure while keeping VeriAudit
application code clearly separated.

Create a small CooL adapter/service boundary rather than scattering SDK
calls throughout the codebase.

## 9. Data and scenarios

Use synthetic or appropriately licensed data.

Four scenarios: 1. Financial Audit --- hero 2. Legal / Compliance 3.
Cybersecurity / IT 4. Procurement / Vendor Controls

Do not build four separate complex AI systems. Reuse the same
execution/event architecture with different scenario data and workflows.

## 10. Deterministic demo

LLM behavior must not randomly change the critical demo result.

Recommended:

``` text
Scenario data
    ↓
Retrieval / AI reasoning
    ↓
Structured finding
    ↓
Deterministic validation
    ↓
Execution events
    ↓
CooL evidence
```

Critical outputs, simulation records, and search targets should be
deterministic enough for repeated judging.

## 11. Deployment requirement

Round 2 requires: - open-source GitHub repository - complete
project/code - proper README - deployed Vercel link

The live product must let a judge: 1. open the site 2. understand the
product 3. run the financial audit 4. simulate history 5. search for the
old decision 6. open the execution trail 7. see CooL-backed verification

Do not leave deployment until the final hour.

## 12. What CooL proves --- and does not prove

Depending on actual SDK implementation, VeriAudit may establish evidence
for: - integrity of recorded evidence - binding between committed values
and receipts - signatures - inclusion/proof information - other
capabilities explicitly supported by CooL

It does **not automatically prove**: - the AI was correct - the AI
understood the evidence correctly - the audit conclusion was
substantively correct - regulatory compliance - that every system action
was captured

Claims must match the actual implementation.

## 13. Build priorities

### P0 --- mandatory

-   Product shell
-   Onboarding
-   Financial audit
-   Synthetic evidence
-   AI/audit workflow
-   Event model
-   Execution trail/timeline
-   Search
-   3-month simulation
-   Human review
-   Real CooL integration
-   Verification
-   Vercel deployment
-   GitHub README

### P1 --- if time remains

-   Other three scenarios
-   Tamper demo
-   Rich evidence viewer
-   Advanced filters
-   Receipt details
-   Visual polish

### P2 --- do not sacrifice P0 for these

-   TEE deployment
-   advanced attestation
-   blockchain infrastructure
-   complex distributed architecture
-   selective disclosure
-   advanced policy engines

## 14. Success test

A judge should be able to understand:

**Problem:** AI-assisted work becomes difficult to reconstruct months
later.

**Product:** VeriAudit creates a searchable execution trail around AI
audit work.

**CooL value:** Important recorded execution evidence is
cryptographically backed and verifiable.

**Why it matters:** When someone challenges an old AI-assisted decision,
the organization can reconstruct what happened instead of relying on
memory and scattered logs.

## 15. One-sentence product

> **VeriAudit lets organizations ask, months later, "Why did the AI make
> this decision?" and reconstruct a searchable, verifiable trail of what
> actually happened.**

## 16. Final principle

Build the experience, not the pitch.

The audience should experience:

> **AI worked → time passed → the decision was questioned → the history
> was buried → VeriAudit reconstructed it → the evidence was verified.**
