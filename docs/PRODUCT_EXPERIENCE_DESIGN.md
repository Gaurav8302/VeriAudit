# VeriAudit — Product Experience Design Philosophy

> This document is authoritative for the frontend experience.
>
> It exists to prevent VeriAudit from becoming a conventional hackathon
> prototype or generic AI dashboard.

---

# 1. What We Are Building

VeriAudit is NOT a prototype.

VeriAudit is a **product experience**.

The objective is not to demonstrate that we can make an audit run.

The objective is to make the user experience the problem of AI accountability
and then experience VeriAudit solving it.

Most hackathon submissions will demonstrate functionality:

> Upload → AI analyzes → Result

VeriAudit should demonstrate a much more important capability:

> Execute → Time passes → Context disappears → Someone asks "Why?" →
> Find the exact execution → Reconstruct what happened → Verify the record

The distinction is fundamental.

We are not building a collection of features.

We are designing an experience around a single powerful question:

> **"Why did the AI make this decision?"**

And the answer must be based on recorded execution evidence, not an AI
generated explanation invented after the fact.

---

# 2. The Product Promise

## Verify the execution, not just the outcome.

AI systems increasingly make decisions that affect:

- finance
- legal work
- cybersecurity
- procurement
- compliance
- enterprise operations

The result alone is insufficient.

An organization may need to know months later:

- What evidence did the AI see?
- What did it retrieve?
- What did the AI actually do?
- Which control was evaluated?
- Why was a finding created?
- What did the human reviewer change?
- What conclusion was reached?
- Can we prove the recorded execution has not been silently altered?

VeriAudit exists to answer those questions.

---

# 3. The Core Experience

The entire demo should feel like one continuous story.

```text
RUN
  ↓
RESULT
  ↓
TIME PASSES
  ↓
HISTORY BECOMES NOISY
  ↓
A QUESTION APPEARS
  ↓
SEARCH
  ↓
FIND THE EXACT EXECUTION
  ↓
RECONSTRUCT THE TRAIL
  ↓
UNDERSTAND WHY
  ↓
VERIFY
````

The user should never feel like they have jumped between unrelated
features.

Every screen exists because it advances this story.

---

# 4. The Psychological Structure

The demo deliberately has two psychological acts.

## ACT I — TRUST PROBLEM

Initially, everything works.

The AI performs an audit.

The user sees the result.

Nothing appears wrong.

Then time passes.

The organization becomes busy.

More audits happen.

More AI actions happen.

More activity accumulates.

The original audit becomes buried.

Then comes the question:

> **"Why did we flag this transaction?"**

At this moment, the user should understand the problem.

The difficulty isn't necessarily that the AI failed.

The difficulty is:

> **Can we reconstruct what happened?**

This creates tension.

---

## ACT II — VERIFIABLE ANSWER

VeriAudit resolves the tension.

The user searches.

The historical audit is found.

The original execution is opened.

The entire causal trail becomes visible.

The user can follow:

```text
Evidence
   ↓
Ingestion
   ↓
Parsing
   ↓
Retrieval
   ↓
Model Action
   ↓
Control Evaluation
   ↓
Finding
   ↓
Human Review
   ↓
Conclusion
```

Then comes the final question:

> "Can I trust that this historical record is actually the record of
> what happened?"

CooL verification provides the answer.

```text
COOL
Cryptographic evidence verification

IDENTITY
Trusted execution identity

INTEGRITY
Historical execution integrity
```

The product experience ends with confidence based on evidence.

---

# 5. Do Not Design a Dashboard

This is one of the strongest constraints in this document.

Do NOT make VeriAudit look like:

* a generic SaaS dashboard
* an analytics dashboard
* an AI chatbot
* an admin panel
* a monitoring dashboard
* a collection of cards
* a collection of metrics

A dashboard answers:

> "What is happening?"

VeriAudit needs to answer:

> **"What happened, why did it happen, and can I verify it?"**

The interface should therefore feel closer to:

* an investigation console
* forensic tooling
* enterprise audit software
* developer infrastructure
* high-trust financial software

than a conventional SaaS dashboard.

---

# 6. The Product Should Feel Like an Investigation

The final experience should have a sense of progression.

The user begins with a normal task.

Then discovers a problem.

Then investigates.

Then reconstructs.

Then verifies.

The interface should visually reinforce this progression.

Possible conceptual hierarchy:

```text
NORMAL WORK
     ↓
HISTORICAL CONTEXT
     ↓
INVESTIGATION
     ↓
EXECUTION RECONSTRUCTION
     ↓
VERIFICATION
```

The visual language should become progressively more forensic and detailed
as the user investigates.

---

# 7. Onboarding Is Part of the Product

Onboarding is not a splash screen.

It is the beginning of the story.

The first screen should immediately communicate:

### VeriAudit

**Verify the execution, not just the outcome.**

Then explain the concept in a few words.

Do not overload the user with technical terminology.

The first action should be obvious:

> Run an audit

The user should understand what VeriAudit does before interacting with it.

---

# 8. The First Audit

The first audit establishes the baseline.

The user chooses:

* Financial
* Legal
* Cybersecurity
* Procurement

Financial is the hero scenario.

The audit should feel like a real enterprise operation.

Not a toy.

Not a "demo dataset".

Not a chatbot conversation.

The interface should communicate that the system is performing a structured
audit execution.

---

# 9. The Result Must Be Clear

For the Financial Audit:

```text
12 Controls Tested

9 Passed
3 Exceptions
```

The result should be understandable immediately.

Do not overwhelm the user with technical event details yet.

At this stage the user should simply understand:

> The AI performed an audit and reached a conclusion.

Then transition naturally into:

> What happens when this becomes history?

---

# 10. Time Must Feel Real

The three-month simulation is one of the most important parts of the product.

It should feel like organizational time has passed.

Use:

> **Three months later...**

The interface should communicate increasing activity.

55 historical activities exist across multiple domains.

The original Financial Audit is now buried.

This is intentional.

Do not pin the hero audit.

Do not highlight it.

Do not make it artificially easy to find.

The user needs to feel the retrieval problem.

---

# 11. The Sidebar Is Narrative Infrastructure

The activity sidebar is not merely navigation.

It represents organizational memory.

Initially:

```text
Few activities
```

After three months:

```text
Many activities
Many audits
Many decisions
Many domains
Many AI actions
```

The sidebar should visually demonstrate information overload.

The important audit should disappear into history naturally.

This makes the search interaction meaningful.

---

# 12. The Boss Question

The transition into investigation should be driven by a believable human
question.

Use:

> **"Why did we flag this revenue transaction?"**

This is better than:

> "Search your audit history."

The first is a real-world problem.

The second is a feature instruction.

The user should feel like they are responding to a request from a CFO,
manager, auditor, legal team, or compliance lead.

The system exists because someone needs an answer.

---

# 13. Search Is the Door Into the Past

Search should feel important.

Not like a tiny utility at the top of a dashboard.

The user types:

> revenue recognition exception

or:

> why did we flag this revenue transaction

The correct historical execution appears.

The user should experience:

> "We found it."

Not:

> "Here are some search results."

The search result should establish:

* exact audit
* execution
* date
* domain
* relevance
* matched context

---

# 14. Reconstruction Is the Hero Feature

The execution trail is the centerpiece of VeriAudit.

Do not reduce it to a generic timeline.

The user should be able to understand the causal chain.

```text
WHY DID THIS HAPPEN?

Conclusion
    ↑
Human Review
    ↑
Finding
    ↑
Control Evaluation
    ↑
Model Action
    ↑
Retrieval
    ↑
Parsed Evidence
    ↑
Ingested Evidence
```

The user should be able to click into each stage.

Every stage should answer:

### What happened?

### What went in?

### What came out?

### What evidence was involved?

### What happened before this?

### What happened because of this?

---

# 15. Evidence Must Feel Concrete

The system has actual evidence artifacts.

For the Financial Audit:

* ledger
* C-1001
* C-1002
* REV-POL-3

These should not feel like decorative filenames.

They represent the foundation of the decision.

The interface should make the relationship visible:

```text
Evidence
   ↓
Retrieved
   ↓
Used by AI
   ↓
Supports finding
   ↓
Reviewed by human
   ↓
Contributes to conclusion
```

---

# 16. Human Review Matters

VeriAudit must never imply:

> AI = truth

The Financial Audit contains:

* accepted
* accepted
* modified

human review outcomes.

This is strategically important.

The product is not trying to replace human judgment.

It is creating accountability around AI-assisted work.

The story is:

```text
AI
 ↓
Evidence
 ↓
Decision
 ↓
Human Review
 ↓
Final Outcome
```

---

# 17. Verification Is the Payoff

Verification should not appear as another dashboard metric.

It should feel like the resolution of the investigation.

The user has now reconstructed what happened.

Then:

> **Can we verify the record?**

Show three distinct concepts:

### CooL

Cryptographic evidence verification.

### Identity

Was the execution associated with the trusted VeriAudit identity?

### Integrity

Does the reconstructed execution remain consistent with its recorded
evidence and append-only history?

For a valid session:

```text
COOL        VERIFIED
IDENTITY    VERIFIED
INTEGRITY   VERIFIED
```

This is the payoff.

---

# 18. Never Overclaim

The product must never claim:

* "The AI decision is correct."
* "The AI cannot be wrong."
* "100% trustworthy AI."
* "AI decision verified."
* "Blockchain verified."
* "Tamper-proof forever."

Instead:

> **Execution evidence verified.**

or:

> **Recorded execution integrity verified.**

VeriAudit proves the integrity/authenticity properties provided by its
implemented verification model.

It does not prove that the underlying AI decision was objectively correct.

---

# 19. Real vs Simulated

The product must distinguish between actual system behavior and demo
simulation.

### REAL

* audit engine
* audit events
* execution trail
* CooL receipts
* CooL verification
* identity verification
* integrity verification
* search
* reconstruction
* causal relationships

### SIMULATED

* passage of three months
* historical organizational activity
* surrounding activity that buries the hero audit

The UI must never imply that simulated activities were independently sealed
by CooL if they were not.

---

# 20. Visual Language

The product should feel:

* precise
* trustworthy
* technical
* calm
* premium
* enterprise-grade
* investigative

Avoid visual clichés.

DO NOT use:

* giant AI brains
* robot illustrations
* excessive neon
* random gradients
* excessive glassmorphism
* floating blobs
* meaningless 3D objects
* generic AI imagery
* "futuristic" decoration without purpose

Every visual element must have a reason.

---

# 21. Information Hierarchy

At every moment, the user should know:

1. Where am I?
2. What happened?
3. What am I investigating?
4. What evidence supports it?
5. What can I verify?

Avoid presenting every piece of information simultaneously.

Progressive disclosure is important.

Start simple.

Reveal complexity as the investigation becomes deeper.

---

# 22. Motion

Motion should communicate state and causality.

Good motion:

* audit execution progressing
* time passing
* activities accumulating
* search revealing the historical record
* trail expanding through causal relationships
* verification resolving

Bad motion:

* decorative particles
* meaningless floating cards
* excessive page transitions
* animation everywhere
* animations that slow the investigation

Motion should reinforce the story.

---

# 23. The Experience Must Be Directed

This is a **guided product experience**.

We are not expecting the judge to explore randomly and discover the product.

The interface should naturally guide them toward the golden path.

But it must still feel like a real product.

The user should always understand what they can do next.

Avoid giant:

> NEXT → NEXT → NEXT

buttons everywhere.

Use natural product interactions.

---

# 24. The Golden Path

The canonical demo is:

```text
WELCOME
   ↓
CHOOSE FINANCIAL AUDIT
   ↓
RUN AUDIT
   ↓
SEE RESULT
   ↓
THREE MONTHS LATER
   ↓
BUSY HISTORY
   ↓
BOSS QUESTION
   ↓
SEARCH
   ↓
FIND HISTORICAL AUDIT
   ↓
OPEN EXECUTION
   ↓
RECONSTRUCT TRAIL
   ↓
INSPECT EVIDENCE
   ↓
INSPECT AI ACTION
   ↓
INSPECT FINDING
   ↓
INSPECT HUMAN REVIEW
   ↓
SEE CONCLUSION
   ↓
VERIFY
   ↓
COOL + IDENTITY + INTEGRITY
```

This is the experience the frontend must optimize for.

---

# 25. Product Quality Bar

The frontend should not be considered complete because:

* all screens exist
* buttons work
* APIs are connected
* the colors look good

It is complete when the experience feels intentional.

A person unfamiliar with VeriAudit should be able to use the demo and
understand:

### Before investigation

"I understand the problem."

### During investigation

"I understand what happened."

### At the end

"I understand why it happened, and I can verify the record."

---

# 26. The Critical Test

Before calling the frontend complete, ask:

> If we removed the labels saying "VeriAudit", would the experience itself
> communicate the problem of AI accountability?

If the answer is no, the design is not strong enough.

Another test:

> Could a judge describe what VeriAudit does after watching the demo once,
> without us explaining it verbally?

The answer should be yes.

---

# 27. Final Design Principle

Do not build:

> **A UI that demonstrates our technology.**

Build:

> **An experience that makes the technology necessary.**

The technology should become obvious because the experience creates a reason
for it to exist.

The final emotional progression should be:

```text
"This audit worked."

        ↓

"Three months passed."

        ↓

"Where did that decision come from?"

        ↓

"I found the exact execution."

        ↓

"Now I can see exactly why it happened."

        ↓

"And I can verify the record."

        ↓

"That's what VeriAudit is for."
```

This philosophy is locked.

Any frontend decision that conflicts with this document should be questioned
before implementation.

````

Then give Fable/Cursor **this separate execution prompt**:

```text
VERIAUDIT — FRONTEND EXPERIENCE DESIGN & IMPLEMENTATION

READ FIRST — DO NOT CODE IMMEDIATELY.

You are implementing the final VeriAudit Product Experience.

This is NOT a prototype.
This is NOT a generic SaaS dashboard.
This is NOT a feature showcase.

Read these documents completely before touching the frontend:

docs/PRODUCT_EXPERIENCE_DESIGN.md
docs/FABLE5_HANDOFF.md
docs/FRONTEND_CONTRACT.md
docs/DEMO_STATE_MACHINE.md
docs/DEMO_FLOW.md
docs/SOURCE_OF_TRUTH.md
docs/DATA_MODEL.md
docs/EVENT_MODEL.md
docs/COOL_INTEGRATION.md

==================================================
IMPORTANT: TAKE YOUR TIME
==================================================

Do NOT rush into implementation.

This frontend experience can make or break the hackathon result.

Spend significant time understanding the product narrative before writing
components.

Do not iterate rapidly by generating a screen, deciding it looks acceptable,
and moving on.

Instead:

1. Read all design/product documentation.
2. Inspect the existing backend APIs.
3. Inspect the existing frontend/project structure.
4. Understand every state in the demo state machine.
5. Map the golden path.
6. Decide the information hierarchy.
7. Design the experience as one continuous narrative.
8. Implement.
9. Run the application.
10. Open it in a real browser.
11. Walk through EVERY state.
12. Check every transition.
13. Check every API interaction.
14. Check search.
15. Check reconstruction.
16. Check the execution trail.
17. Check verification.
18. Check responsive behavior.
19. Fix visual and UX problems.
20. Repeat until the experience feels deliberate.

If this takes an hour or more, that is acceptable.

DO NOT optimize for speed at the expense of quality.

==================================================
THE CENTRAL QUESTION
==================================================

Everything should revolve around:

"Why did the AI make this decision?"

The experience must create this question naturally.

The user should first experience:

AI audit works.

Then:

Three months pass.

Then:

The audit is buried.

Then:

Someone asks why.

Then:

VeriAudit reconstructs the answer.

Then:

VeriAudit verifies the record.

==================================================
DO NOT BUILD A DASHBOARD
==================================================

Avoid generic:

- metric grids
- SaaS cards everywhere
- dashboard templates
- AI chatbot layouts
- excessive glassmorphism
- decorative gradients
- generic AI visuals

Design an enterprise investigation product.

It should feel credible enough that an auditor, CFO, compliance officer,
legal professional, or security lead could imagine using it.

==================================================
IMPLEMENT THE GOLDEN PATH
==================================================

The primary experience must be:

WELCOME
→ SCENARIO
→ FINANCIAL AUDIT
→ RUN
→ RESULT
→ THREE MONTHS LATER
→ HISTORY
→ BOSS QUESTION
→ SEARCH
→ HISTORICAL AUDIT
→ RECONSTRUCTION
→ EXECUTION TRAIL
→ EVIDENCE
→ FINDINGS
→ HUMAN REVIEW
→ CONCLUSION
→ VERIFICATION

Optimize the entire UI around this path.

Secondary scenarios must remain accessible but should not dilute the hero
experience.

==================================================
USE REAL BACKEND DATA
==================================================

Do not fabricate:

- audit results
- findings
- execution events
- evidence
- human reviews
- verification states
- CooL results

Consume the existing APIs.

The frontend is a presentation layer over the real system.

==================================================
USE THE EXISTING STATE MACHINE
==================================================

Use:

lib/demo/state-machine.ts

Do not create an independent navigation architecture.

Respect the documented state transitions.

==================================================
THE EXPERIENCE SHOULD FEEL GUIDED
==================================================

Guide the user without making the application feel like a slideshow.

Avoid:

NEXT
NEXT
NEXT
NEXT

Instead create natural product interactions.

The user should always understand what the next meaningful action is.

==================================================
VISUAL HIERARCHY
==================================================

Prioritize:

1. Current context
2. Primary action
3. Important evidence
4. Causal relationships
5. Verification status

Do not show everything at once.

Use progressive disclosure.

==================================================
EXECUTION TRAIL
==================================================

This is the visual centerpiece.

Do not simply render a list of 30 events.

Use the backend's authoritative causal structure.

The user should understand:

Evidence
↓
Retrieval
↓
Model
↓
Control
↓
Finding
↓
Human Review
↓
Conclusion

Allow deeper inspection when appropriate.

Make the trail feel like a reconstruction of an actual execution.

==================================================
VERIFICATION
==================================================

Make verification the climax.

Clearly distinguish:

CooL
Identity
Integrity

Do not display VERIFIED unless the backend actually reports verified.

Do not claim that the AI decision itself is verified.

Use approved terminology from:

lib/demo/copy.ts

==================================================
SIMULATION
==================================================

Make "Three months later..." feel like time passing.

The 55 activities should make the environment feel busy.

Do not simply dump 55 rows onto the screen.

The historical activity should establish context and information overload.

==================================================
SEARCH
==================================================

Search must feel like an investigation tool.

The user should be able to enter:

revenue recognition exception

and:

why did we flag this revenue transaction

The exact historical execution should emerge naturally as the strongest
result.

Do not fake search results.

==================================================
RESPONSIVE QUALITY
==================================================

Test:

- desktop
- laptop-sized viewport
- narrower browser
- reasonable mobile behavior where applicable

The hackathon judging environment is likely desktop, but the product must
not visually break at common widths.

==================================================
ACCESSIBILITY
==================================================

Use:

- semantic HTML
- keyboard-accessible controls
- visible focus states
- readable contrast
- meaningful labels
- sensible interaction states

Do not sacrifice usability for visual novelty.

==================================================
PERFORMANCE
==================================================

Do not add unnecessary dependencies.

Do not add external services.

Do not introduce heavy animation libraries unless genuinely necessary.

Keep the application fast.

==================================================
BROWSER VALIDATION IS REQUIRED
==================================================

Do not consider the work complete after a successful build.

You MUST open the running application in a browser and manually walk through
the complete golden path.

Check:

WELCOME
↓
SCENARIO
↓
AUDIT RUN
↓
RESULT
↓
SIMULATION
↓
HISTORY
↓
SEARCH
↓
RECONSTRUCTION
↓
TRAIL
↓
VERIFICATION

At every step inspect:

- visual hierarchy
- spacing
- typography
- loading behavior
- transitions
- data correctness
- errors
- empty states
- scroll behavior
- sidebar behavior
- search behavior
- graph/trail readability
- verification clarity

If something looks like a generic AI-generated interface, redesign it.

==================================================
DO NOT STOP AT "IT WORKS"
==================================================

Functional correctness is necessary but insufficient.

Ask after each browser walkthrough:

"Would this make a judge stop and pay attention?"

"Does this screen advance the story?"

"Does this feel like a real product?"

"Is the reason for this UI element obvious?"

"Does this help communicate accountability, traceability, reconstruction,
or verification?"

If not, improve it.

==================================================
DO NOT MODIFY BACKEND SEMANTICS
==================================================

If the frontend needs information that genuinely does not exist in the API,
identify the gap.

Do not silently invent frontend data.

Do not weaken verification semantics.

Do not change CooL integration.

Do not change audit results merely to make the UI easier.

==================================================
FINAL VALIDATION
==================================================

Before reporting completion:

- run all tests
- run typecheck
- run production build
- start production server
- open browser
- walk entire golden path
- verify every API call
- verify search
- verify reconstruction
- verify CooL state
- test reset
- test error/loading states
- inspect visual consistency
- inspect responsive behavior

Then fix issues found during browser inspection.

Repeat if necessary.

==================================================
MOST IMPORTANT INSTRUCTION
==================================================

TAKE YOUR TIME.

Do not try to finish this as quickly as possible.

The frontend is the part the judges will actually experience.

A technically correct backend hidden behind a mediocre interface will lose
against a technically correct backend presented through an exceptional
product experience.

We have already invested in making the backend real.

Now make the experience worthy of it.

Only stop when the product feels intentional, coherent, premium, and
memorable.

==================================================
FINAL REPORT
==================================================

When genuinely complete, report:

FRONTEND PRODUCT EXPERIENCE COMPLETE

Golden path:
- Welcome:
- Scenario:
- Audit:
- Result:
- Simulation:
- History:
- Search:
- Reconstruction:
- Trail:
- Verification:

Browser validation:
- Full golden path:
- Search:
- Reconstruction:
- Verification:
- Reset:
- Responsive:

Quality:
- Tests:
- Typecheck:
- Build:

Files created:
...

Files modified:
...

Known issues:
...

DO NOT claim complete merely because the application builds.
````

**One important addition:** don't let Fable start by generating all screens independently. The instruction to **walk the whole experience in the browser repeatedly** is intentional. The strongest frontend will come from treating it as a single 3–5 minute narrative rather than twelve separate UI pages.
