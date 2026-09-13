/**
 * Historical reconstruction: search result → the recorded execution.
 *
 * The explanation is walked from sealed/recorded events. No LLM is asked
 * to remember what it decided. Catalog-only audits have no engine trail
 * and are returned as such, honestly.
 */
import {
  auditView,
  evidenceView,
  ExecutionTrail,
  resolveScenario,
  runAndSeal,
  trailView,
  verifyTrail,
  type AuditRun,
} from "@/lib/audit";
import { generateHistory } from "@/lib/simulation";

export interface ReconstructionEvidence {
  readonly receipts?: Record<string, unknown>;
  readonly logState?: unknown;
  readonly treeHead?: { logId: string; treeSize: number; rootHash: string };
}

export async function reconstructAudit(auditId: string, evidence?: ReconstructionEvidence) {
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    const simulation = generateHistory();
    const audit = simulation.audits.find((a) => a.auditId === auditId);
    if (!audit) return null;
    const execution = simulation.executions.find((e) => e.auditId === auditId) ?? null;
    return {
      kind: "catalog" as const,
      auditId,
      executionId: execution?.executionId ?? null,
      hasEngineTrail: false,
      audit,
      execution,
      why: {
        question: "Why did the AI make this decision?",
        answerSource: "catalog-only",
        note: "This audit is historical feed data. It has no engine trail and no CooL receipts.",
        path: [],
      },
      integrity: {
        status: "not-recorded" as const,
        cool: "not-recorded",
        identity: "not-recorded",
        reason: "catalog-only simulated audit; no cryptographic evidence was created",
      },
    };
  }

  const regenerated = await runAndSeal(scenario, { seal: false });
  const run = attachEvidence(regenerated, evidence);
  const trail = ExecutionTrail.fromRun(run);
  const why = trail.whyConclusion();
  const integrity = evidence?.receipts ? await verifyTrail(run) : null;

  const integrityView = integrity
    ? {
        status: integrity.status,
        cool: integrity.status,
        identity: integrity.receipts.every((r) => r.state.signerTrusted && r.state.measurementMatches)
          ? integrity.status
          : "failed",
        verified: integrity.verified,
        failed: integrity.failed,
        rootsMatch: integrity.tree.rootsMatch,
        reasons: integrity.receipts.flatMap((r) => [...r.state.coolReasons, ...r.bindFailures]),
        checkedAt: integrity.checkedAt,
      }
    : {
        status: "unavailable" as const,
        cool: "unavailable",
        identity: "unavailable",
        reason:
          "Receipts are session-held and cannot be regenerated. POST them to verify CooL and identity.",
      };

  return {
    kind: "engine" as const,
    auditId: run.result.auditId,
    executionId: run.result.executionId,
    hasEngineTrail: true,
    question: "Why did the AI make this decision?",
    answerSource: "recorded-execution" as const,
    audit: auditView(scenario, run.result),
    evidence: evidenceView(scenario),
    findings: run.result.findings,
    reviews: run.result.reviews,
    conclusion: run.result.conclusion,
    retrieval: run.result.retrieval,
    reasoning: run.result.reasoning,
    controls: run.result.controlResults,
    trail: trailView(run),
    why: {
      question: why.question,
      answerSource: "recorded-execution",
      conclusionEventId: why.conclusionEventId,
      path: why.path,
      evidence: run.result.artifacts.map((a) => ({ artifactId: a.artifactId, title: a.title })),
      retrieval: {
        query: run.result.retrieval.query,
        passages: run.result.retrieval.passages,
      },
      model: run.result.reasoning.model,
      primaryFinding: run.result.findings[0] ?? null,
      primaryReview: run.result.reviews[0] ?? null,
      conclusion: run.result.conclusion,
    },
    graph: {
      nodes: run.events.map((e) => ({
        eventId: e.eventId,
        parentEventId: e.parentEventId,
        eventType: e.type,
        title: e.title,
        references: {
          artifacts: e.artifactRefs,
          finding: e.findingRef,
          review: e.reviewRef,
          control: e.controlRef,
        },
      })),
      edges: run.events
        .filter((e) => e.parentEventId !== null)
        .map((e) => ({ from: e.parentEventId!, to: e.eventId })),
      spineEventIds: why.path.map((s) => s.eventId),
    },
    integrity: integrityView,
  };
}

function attachEvidence(run: AuditRun, evidence?: ReconstructionEvidence): AuditRun {
  if (!evidence?.receipts) return run;
  const receiptMap = new Map(Object.entries(evidence.receipts));
  return {
    ...run,
    events: run.events.map((event) => {
      const receiptRef = `${event.executionId}:${event.eventId}`;
      const envelope = receiptMap.get(receiptRef) as
        | {
            binding_hash?: string;
            record?: {
              record_id?: string;
              signature?: { key_id?: string; alg?: string };
              time?: { issued_at?: string };
              runtime?: { mode?: string };
            };
            inclusion?: { leaf_index?: number; tree_size?: number };
            sth?: { log_id?: string };
          }
        | undefined;
      if (!envelope) return event;
      return {
        ...event,
        cool: {
          recordId: envelope.record?.record_id ?? "",
          bindingHash: envelope.binding_hash ?? "",
          keyId: envelope.record?.signature?.key_id ?? "",
          signatureAlg: envelope.record?.signature?.alg ?? "",
          issuedAt: envelope.record?.time?.issued_at ?? "",
          runtimeMode: (envelope.record?.runtime?.mode ?? "simulated") as
            | "mock"
            | "simulated"
            | "hardware",
          leafIndex: envelope.inclusion?.leaf_index ?? null,
          treeSize: envelope.inclusion?.tree_size ?? null,
          logId: envelope.sth?.log_id ?? null,
          receiptRef,
          contentDigest: "",
        },
      };
    }),
    logState: Array.isArray(evidence.logState) ? (evidence.logState as string[]) : run.logState,
    receipts: receiptMap,
    sealing: {
      ...run.sealing,
      sealed: receiptMap.size,
      treeHead: evidence.treeHead ?? run.sealing.treeHead,
    },
  };
}
