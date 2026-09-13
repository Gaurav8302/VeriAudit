/**
 * A Milestone 1 fixture: the nine canonical events of a hero execution.
 *
 * This exists ONLY to exercise the CooL adapter end to end. It is not the audit
 * engine — Milestone 2 replaces it with `lib/audit/engine.ts`, which computes
 * these values from synthetic artifacts instead of stating them. The event
 * shapes and the causal chain are already the real ones (docs/EVENT_MODEL.md),
 * so the adapter is being proved against production-shaped input.
 *
 * Deterministic: no wall-clock reads, no random values.
 */
import type { VeriAuditEvent } from "@/lib/cool/types";

const AUDIT_ID = "AUD-FIN-2026-09";
const EXECUTION_ID = "EXEC-FIN-2026-09-001";

/** Fixed logical timestamps. See docs/SIMULATION_SPEC.md §2 on the fixed clock. */
const T = (minutes: number) =>
  new Date(Date.UTC(2026, 8, 15, 9, 0, 0) + minutes * 60_000).toISOString();

interface Step {
  type: VeriAuditEvent["type"];
  actor: VeriAuditEvent["actor"];
  title: string;
  summary: string;
  detail: VeriAuditEvent["detail"];
  artifactRefs?: string[];
  inputPayload?: string;
  outputPayload?: string;
}

const STEPS: Step[] = [
  {
    type: "audit.started",
    actor: "system",
    title: "September revenue recognition audit opened",
    summary: "Engagement opened for period 2026-Q3 with 12 controls in scope.",
    detail: { period: "2026-Q3", controls_in_scope: 12 },
  },
  {
    type: "artifact.ingested",
    actor: "system",
    title: "Evidence ingested",
    summary: "Four synthetic artifacts entered the audit scope.",
    detail: { artifact_count: 4, ledger_rows: 412 },
    artifactRefs: ["ART-FIN-001", "ART-FIN-002", "ART-FIN-003", "ART-FIN-004"],
    inputPayload: JSON.stringify({ ledger_rows: 412, contracts: ["C-1001", "C-1002"] }),
  },
  {
    type: "artifact.parsed",
    actor: "ai",
    title: "Documents parsed",
    summary: "Ledger and contracts interpreted into structured figures.",
    detail: { parsed: 4, failed: 0 },
    artifactRefs: ["ART-FIN-001", "ART-FIN-002", "ART-FIN-003", "ART-FIN-004"],
    outputPayload: JSON.stringify({ line_items: 412, obligations_identified: 18 }),
  },
  {
    type: "retrieval.executed",
    actor: "ai",
    title: "Relevant evidence retrieved",
    summary: "Seven passages retrieved for revenue recognition testing.",
    detail: { query: "revenue recognition performance obligation", hits: 7 },
    artifactRefs: ["ART-FIN-001", "ART-FIN-004"],
  },
  {
    type: "model.executed",
    actor: "ai",
    title: "Reasoning step executed",
    summary: "Revenue recognition timing assessed against the policy.",
    detail: { model: "veriaudit-reasoner", model_version: "0.1.0", deterministic: true },
    inputPayload: JSON.stringify({ passages: 7, policy: "REV-POL-3" }),
    outputPayload: JSON.stringify({
      assessment: "revenue recognized before performance obligation satisfied",
    }),
  },
  {
    type: "control.tested",
    actor: "ai",
    title: "Controls tested",
    summary: "12 controls tested; 9 passed; 3 exceptions raised.",
    detail: { controls_tested: 12, controls_passed: 9, exceptions: 3, control: "REV-REC-01" },
  },
  {
    type: "finding.created",
    actor: "ai",
    title: "Revenue recognized before performance obligation satisfied",
    summary: "Contract C-1001 revenue recognised in Q3 ahead of delivery milestones.",
    detail: {
      finding_id: "F-FIN-001",
      control: "REV-REC-01",
      severity: "high",
      amount_usd: 1_420_000,
    },
    artifactRefs: ["ART-FIN-001", "ART-FIN-002"],
    outputPayload: JSON.stringify({
      conclusion: "revenue recognized before performance obligation satisfied",
      contract: "C-1001",
    }),
  },
  {
    type: "human.review.completed",
    actor: "human",
    title: "Human verification completed",
    summary: "Reviewer accepted the finding without modification.",
    detail: {
      review_id: "REV-FIN-001",
      reviewer: "J. Okafor",
      reviewer_role: "Senior Manager, Assurance",
      decision: "accepted",
    },
  },
  {
    type: "conclusion.created",
    actor: "system",
    title: "Audit conclusion recorded",
    summary: "12 controls tested, 9 passed, 3 exceptions, human verification completed.",
    detail: {
      controls_tested: 12,
      controls_passed: 9,
      exceptions: 3,
      human_review_completed: true,
    },
  },
];

/** The nine canonical events, in causal order, each parented to the previous. */
export function sampleTrail(): VeriAuditEvent[] {
  return STEPS.map((step, index) => ({
    eventId: `EVT-FIN-2609-${String(index + 1).padStart(3, "0")}`,
    auditId: AUDIT_ID,
    executionId: EXECUTION_ID,
    sequence: index,
    type: step.type,
    actor: step.actor,
    scenario: "financial" as const,
    occurredAt: T(index * 7),
    parentEventId: index === 0 ? null : `EVT-FIN-2609-${String(index).padStart(3, "0")}`,
    artifactRefs: step.artifactRefs ?? [],
    title: step.title,
    summary: step.summary,
    detail: step.detail,
    ...(step.inputPayload === undefined ? {} : { inputPayload: step.inputPayload }),
    ...(step.outputPayload === undefined ? {} : { outputPayload: step.outputPayload }),
  }));
}

/** A single event, for the smallest possible record→verify proof. */
export function sampleEvent(): VeriAuditEvent {
  const event = sampleTrail()[6];
  if (!event) throw new Error("sample trail is missing the finding.created event");
  return event;
}
