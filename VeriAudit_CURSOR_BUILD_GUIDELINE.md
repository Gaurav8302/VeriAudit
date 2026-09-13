# Cursor Build Guideline --- VeriAudit Round 2

**Mission:** Start the 8-hour build with disciplined discovery and
documentation before writing application code.

## 0. Non-negotiable rule

**Do not start coding immediately.**

First inspect the repository, the cloned CooL code/package, existing
files, package versions, and runtime constraints.

Then create the project documentation below.

Only after the documentation is complete should implementation begin.

The goal is to ship a reliable judging demo in 8 hours, not to build an
over-engineered production platform.

------------------------------------------------------------------------

# 1. First task: inspect everything

Before modifying code:

1.  Inspect the complete repository tree.
2.  Identify the existing CooL repository/package structure.
3.  Inspect `package.json`, lockfiles, configs, scripts, environment
    examples, and README files.
4.  Determine how `cool-nwc` is installed/used.
5.  Find the actual exported APIs and examples in the CooL source/docs.
6.  Determine whether CooL functionality can run in a Vercel-compatible
    deployment.
7.  Identify whether any CooL operation requires server-side secrets,
    persistent storage, filesystem access, long-running processes, or
    unsupported runtime features.
8.  Inspect the existing frontend/backend stack before choosing new
    technologies.
9.  Reuse existing working infrastructure wherever possible.
10. Do not rewrite working CooL code unnecessarily.

### Important

Do not hallucinate CooL APIs.

If documentation and source code disagree, inspect the implementation
and test the actual package.

------------------------------------------------------------------------

# 2. Create these documents BEFORE coding

Create:

``` text
docs/
├── SOURCE_OF_TRUTH.md
├── IMPLEMENTATION_PLAN.md
├── ARCHITECTURE.md
├── COOL_INTEGRATION.md
├── DATA_MODEL.md
├── DEMO_FLOW.md
└── DEPLOYMENT.md
```

Also update the root `README.md` later, after the implementation
stabilizes.

------------------------------------------------------------------------

# 3. SOURCE_OF_TRUTH.md

Copy the product direction from the provided VeriAudit Source of Truth.

This document is authoritative for: - product goal - demo psychology -
workflow - scenarios - CooL's role - claims - priorities

Do not silently change the product concept.

------------------------------------------------------------------------

# 4. IMPLEMENTATION_PLAN.md

Before coding, create a concrete 8-hour implementation plan.

It must contain:

## Phase 1 --- CooL proof

Create the smallest possible working test proving:

``` text
application event
    ↓
cool-nwc
    ↓
real CooL evidence/receipt
    ↓
verification
```

Record: - exact API used - input - output - verification method -
runtime requirements - failure modes

This is the first technical milestone.

If this does not work, stop and resolve it before building the rest.

## Phase 2 --- Financial audit

Build one excellent deterministic audit scenario.

Do not build four mediocre scenarios first.

## Phase 3 --- Event system

Implement a structured event model that can represent the audit
execution.

## Phase 4 --- Trail

Build timeline + causal graph.

## Phase 5 --- Search

Implement natural-language/keyword search plus basic filters.

## Phase 6 --- Simulation

Generate three months of realistic historical activity.

## Phase 7 --- Verification

Connect important events to real CooL-backed evidence.

## Phase 8 --- Deployment

Deploy to Vercel early enough to discover runtime problems.

## Phase 9 --- Polish

Improve the demo path and only then add secondary scenarios.

------------------------------------------------------------------------

# 5. ARCHITECTURE.md

Document the actual architecture after inspecting the repo.

At minimum describe:

``` text
Frontend
   ↓
API / application layer
   ↓
Audit engine
   ↓
Event manager
   ├── Search/index
   ├── Simulation
   └── CooL adapter
             ↓
          cool-nwc
```

Clearly distinguish:

### Product layer

-   audit workflows
-   scenarios
-   event semantics
-   search
-   graph
-   simulation
-   human review

### CooL layer

-   cryptographic evidence
-   receipts/proofs
-   verification

Do not make CooL the application's primary database unless the actual
SDK requires it.

------------------------------------------------------------------------

# 6. COOL_INTEGRATION.md

This is a high-priority document because CooL is explicitly part of the
judging criteria.

Document:

## Actual package

``` text
cool-nwc
```

## Installation

Record the exact installation command and version.

## APIs

Document only APIs confirmed from: - installed source - official package
documentation - successful local tests

## Event mapping

Explain exactly which VeriAudit events are backed by CooL.

Example:

``` text
finding.created
model.executed
control.tested
human.review.completed
conclusion.created
```

Do not necessarily record every UI event.

Record the events where cryptographic evidence adds meaningful value.

## Data flow

Document:

``` text
AI operation
    ↓
VeriAudit event
    ↓
canonical event payload
    ↓
CooL evidence operation
    ↓
receipt/proof
    ↓
persistent reference
    ↓
verification UI
```

## Security/claims boundary

Document what verification actually establishes.

Do not claim that CooL proves AI correctness unless the implementation
genuinely does so.

## Deployment

Document whether the integration works on Vercel and what runtime it
requires.

------------------------------------------------------------------------

# 7. DATA_MODEL.md

Design the minimum data model required for the demo.

Recommended entities:

``` text
Audit
Execution
Event
Artifact
Finding
HumanReview
Receipt
```

Relationships:

``` text
Audit
 └── Execution
      └── Event
           ├── Artifact references
           ├── parent event
           └── CooL receipt

Finding
 └── HumanReview
```

Keep the schema simple.

Do not create a huge enterprise database model during an 8-hour
hackathon.

------------------------------------------------------------------------

# 8. DEMO_FLOW.md

Write the exact judge-facing flow.

It must contain:

``` text
1. Welcome
2. Choose Financial Audit
3. AI performs audit
4. Show result
5. Simulate next 3 months
6. Show 50+ historical activities
7. “Three months later…”
8. Boss asks why a decision was made
9. Search for the decision
10. Open exact audit
11. Open execution graph
12. Inspect evidence/model/finding/human review
13. Verify CooL-backed evidence
14. Optional tamper demonstration
```

For every step define: - what the user sees - what the application
does - what data is involved - what must be deterministic

------------------------------------------------------------------------

# 9. DEPLOYMENT.md

Before major UI work, document the deployment plan.

Answer:

-   What runs on Vercel?
-   What is client-side?
-   What requires server-side execution?
-   Where are environment variables stored?
-   Does `cool-nwc` work in Vercel's runtime?
-   Is a separate API necessary?
-   Where is demo data stored?
-   Is persistent storage required?
-   What happens on a fresh browser?

The deployment architecture must be compatible with the actual CooL SDK.

------------------------------------------------------------------------

# 10. Coding rules

Once documentation is complete:

### Rule 1 --- Build P0 first

Do not start with: - animations - elaborate dashboards - multiple audit
types - advanced cryptography UI

Build the core narrative.

### Rule 2 --- Real CooL

The application must genuinely invoke `cool-nwc`.

Do not mock CooL calls in the final implementation.

Mocks may be used only for isolated development where necessary, and
must not be mistaken for the final integration.

### Rule 3 --- One CooL adapter

Keep SDK interaction behind a small service/module.

For example:

``` text
services/
└── cool/
    ├── client
    ├── recorder
    ├── verifier
    └── types
```

Adapt the structure to the actual repository.

### Rule 4 --- Deterministic demo

The same demo action should produce the same critical result.

Do not let an LLM randomly determine whether the hero audit passes or
fails.

### Rule 5 --- Don't overbuild

Prefer: - simple storage - simple event model - simple search -
deterministic simulation - reusable components

over complex infrastructure.

### Rule 6 --- Keep the UI judge-friendly

The judge should understand the screen without reading documentation.

The execution trail should be visually obvious.

### Rule 7 --- Preserve evidence relationships

Do not store isolated logs.

Events need relationships:

``` text
evidence → retrieval → model → control → finding → review → conclusion
```

------------------------------------------------------------------------

# 11. Three-month simulation implementation

The simulation should generate believable activity.

Each record should have: - timestamp - title - type - audit
association - status - optional finding - optional execution ID

Generate at least 50 historical activities.

Include the original hero audit early enough that it naturally becomes
buried.

Do not simply duplicate the same chat 100 times.

Use several activity types: - audit - control test - evidence review -
finding - follow-up - human review - compliance check - vendor review -
access review

------------------------------------------------------------------------

# 12. Search implementation

Search must retrieve the exact hero audit reliably.

The demo query should work every time.

At minimum support: - text search - date filter - event/audit type -
result/status

If semantic search takes too long, use a robust indexed keyword/tag
search first.

A reliable search is more important than an impressive search algorithm.

------------------------------------------------------------------------

# 13. Execution graph

Do not make a random node graph.

Use a causal workflow.

Recommended:

``` text
Evidence
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
Conclusion
```

Each node should open details.

The graph should answer:

> "Why did this decision happen?"

------------------------------------------------------------------------

# 14. CooL integration visibility

The judge must be able to tell that CooL is actually being used.

Show a compact verification section in the trail.

For example:

``` text
Cryptographic Evidence
✓ Recorded
✓ Verified
Receipt: REC-XXXX
```

Then allow technical details to expand.

Do not fill the main UI with cryptography jargon.

------------------------------------------------------------------------

# 15. Error handling

The demo must fail gracefully.

If CooL verification fails: - show the actual failure - preserve the
event - provide useful debugging information in development

Do not silently report "VERIFIED" when the underlying verification did
not happen.

------------------------------------------------------------------------

# 16. Testing checkpoints

After each major milestone test:

### CooL

Can a real event be recorded and verified?

### Audit

Can the financial audit produce the expected result?

### Event trail

Can the entire causal chain be reconstructed?

### Search

Can the hero audit always be found?

### Simulation

Does the original audit become buried?

### Verification

Does the UI reflect the real CooL verification state?

### Deployment

Does the same flow work from a clean Vercel session?

------------------------------------------------------------------------

# 17. Git workflow

Create the VeriAudit repository as the open-source project.

Commit meaningful milestones:

``` text
init: project structure
feat: prove CooL integration
feat: financial audit workflow
feat: execution event system
feat: execution trail
feat: historical simulation
feat: search and filters
feat: verification UI
feat: deployment configuration
docs: round 2 README
```

Do not commit secrets.

Create `.env.example`.

------------------------------------------------------------------------

# 18. README requirements

The final README must clearly explain:

1.  What VeriAudit is
2.  The problem
3.  Why ordinary chat history is insufficient
4.  The demo workflow
5.  Architecture
6.  How CooL is integrated
7.  Why CooL is important
8.  How to run locally
9.  Environment variables
10. Deployment
11. Technical decisions
12. Limitations
13. Future improvements

Include an architecture diagram.

Include the live Vercel link once deployed.

------------------------------------------------------------------------

# 19. 8-hour decision rule

Whenever choosing between two implementation options, ask:

> **Does this improve the judge-facing core experience or make the CooL
> integration stronger?**

If neither:

**Do not build it.**

------------------------------------------------------------------------

# 20. Final acceptance checklist

Before declaring the prototype complete:

``` text
[ ] GitHub repo exists
[ ] No secrets committed
[ ] cool-nwc is actually integrated
[ ] CooL verification works
[ ] Financial audit works
[ ] Critical result is deterministic
[ ] Human review exists
[ ] 50+ historical activities exist
[ ] Three-month simulation works
[ ] Original audit becomes buried
[ ] Search finds the original audit
[ ] Execution graph works
[ ] Evidence can be inspected
[ ] CooL verification status is visible
[ ] Vercel deployment works
[ ] Clean-browser test works
[ ] README is complete
[ ] Limitations are documented
```

## Final instruction to the coding agent

**Do not optimize for code volume. Optimize for a convincing, reliable,
technically honest demonstration of the core idea.**

The most important path is:

``` text
AI Audit
   ↓
3 Months Pass
   ↓
Boss Question
   ↓
Search
   ↓
Exact Historical Audit
   ↓
Execution Trail
   ↓
Evidence + Human Review
   ↓
CooL Verification
```

Everything else is secondary.
