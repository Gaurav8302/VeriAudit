/**
 * The audit engine. One implementation, four scenarios.
 *
 *   scenario → evidence → controls → reasoning → findings → review → conclusion
 *
 * Pure and deterministic: no clock reads, no randomness, no I/O, no CooL. The
 * same scenario produces a byte-identical `AuditResult` on every machine and
 * every run, which is what lets the demo be reproduced and the events be
 * regenerated instead of stored (docs/ARCHITECTURE.md §4).
 *
 * What differs between scenarios is data and rules. What does not differ is
 * this file.
 */
import { findingId as mintFindingId, reviewId as mintReviewId } from "./ids";
import type {
  AuditResult,
  AuditScenario,
  ControlResult,
  Conclusion,
  Finding,
  HumanReview,
  JsonValue,
  Severity,
} from "./types";

/** Severity order, for ranking findings. High severity gets `F-…-001`. */
const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/**
 * Logical clock: minutes from the scenario's `openedAt`. Never `Date.now()`.
 *
 * Takes the structural minimum rather than `AuditScenario<unknown>`: a
 * `Control<E>` is contravariant in its evidence type, so `AuditScenario<E>`
 * does not widen to `AuditScenario<unknown>`.
 */
export function stepAt(
  scenario: { scenarioId: string; openedAt: string; stepMinutes: number },
  step: number,
): string {
  const base = Date.parse(scenario.openedAt);
  if (Number.isNaN(base)) {
    throw new TypeError(`scenario ${scenario.scenarioId}: openedAt is not a valid date`);
  }
  return new Date(base + step * scenario.stepMinutes * 60_000).toISOString();
}

/** Drop `undefined` values so what gets committed is pure JSON. */
function pruneUndefined(
  observed: Readonly<Record<string, JsonValue | undefined>>,
): Readonly<Record<string, JsonValue>> {
  const out: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(observed)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function runAudit<E>(scenario: AuditScenario<E>): AuditResult {
  assertScenarioShape(scenario);

  const artifactsById = new Map(scenario.artifacts.map((a) => [a.artifactId, a]));
  const ctx = { evidence: scenario.evidence, artifactsById };

  // ── 1. Reasoning. Runs before the controls and cannot influence them. ──────
  const reasoning = scenario.reasoner.analyse({
    scenarioId: scenario.scenarioId,
    query: scenario.retrieval.query,
    passages: scenario.retrieval.passages,
    parsed: scenario.artifacts.map((a) => a.parsed),
  });

  // ── 2. Controls, in declaration order. ────────────────────────────────────
  const evaluations = scenario.controls.map((control) => {
    const evaluation = control.evaluate(ctx);
    if (evaluation.status === "exception" && !evaluation.finding) {
      throw new Error(
        `control ${control.controlId} raised an exception without a finding — ` +
          "an exception a reader cannot act on is not a usable audit result",
      );
    }
    return { control, evaluation };
  });

  // ── 3. Findings. Ranked by severity, then control id, so ids are stable. ──
  // The hero finding must be F-…-001, and that has to fall out of the data
  // rather than be asserted, or the ordering breaks the moment a control moves.
  const exceptions = evaluations
    .filter((e) => e.evaluation.status === "exception")
    .sort((a, b) => {
      const bySeverity =
        SEVERITY_RANK[a.evaluation.finding!.severity] -
        SEVERITY_RANK[b.evaluation.finding!.severity];
      return bySeverity !== 0
        ? bySeverity
        : a.control.controlId.localeCompare(b.control.controlId);
    });

  const findingIdByControl = new Map<string, string>();
  exceptions.forEach((e, index) => {
    findingIdByControl.set(e.control.controlId, mintFindingId(scenario, index + 1));
  });

  const controlResults: ControlResult[] = evaluations.map(({ control, evaluation }) => ({
    controlId: control.controlId,
    name: control.name,
    description: control.description,
    category: control.category,
    status: evaluation.status,
    observed: pruneUndefined(evaluation.observed),
    rationale: evaluation.rationale,
    artifactIds: control.artifactIds,
    findingId: findingIdByControl.get(control.controlId) ?? null,
  }));

  // ── 4. Reviews. A finding with no decision stays PENDING on purpose. ──────
  const reviews: HumanReview[] = [];
  const findings: Finding[] = [];

  exceptions.forEach(({ control, evaluation }, index) => {
    const spec = evaluation.finding!;
    const id = findingIdByControl.get(control.controlId)!;
    const reviewRequired = scenario.reviewPolicy.requiresReview({
      severity: spec.severity,
      controlId: control.controlId,
    });
    const decision = reviewRequired
      ? scenario.reviewPolicy.decisions[control.controlId]
      : undefined;

    let status: Finding["status"] = "open";
    let reviewIdValue: string | null = null;
    let severity = spec.severity;
    let originalSeverity: Severity | null = null;

    if (decision) {
      reviewIdValue = mintReviewId(scenario, index + 1);
      status = decision.decision;
      if (decision.decision === "modified" && decision.modifiedSeverity) {
        originalSeverity = spec.severity;
        severity = decision.modifiedSeverity;
      }
      reviews.push({
        reviewId: reviewIdValue,
        findingId: id,
        reviewer: scenario.reviewPolicy.reviewer,
        decision: decision.decision,
        note: decision.note,
        // Reviews happen after the audit steps; offset keeps them ordered.
        reviewedAt: stepAt(scenario, 100 + index),
        modifiedSeverity: decision.modifiedSeverity ?? null,
      });
    }

    findings.push({
      findingId: id,
      auditId: scenario.auditId,
      executionId: scenario.executionId,
      controlId: control.controlId,
      severity,
      title: spec.title,
      description: spec.description,
      rationale: evaluation.rationale,
      recommendedAction: spec.recommendedAction,
      evidenceArtifactIds: control.artifactIds,
      observed: pruneUndefined(evaluation.observed),
      amountUsd: spec.amountUsd ?? null,
      status,
      reviewRequired,
      reviewId: reviewIdValue,
      originalSeverity,
    });
  });

  // ── 5. Conclusion. ────────────────────────────────────────────────────────
  const controlsTested = controlResults.length;
  const controlsPassed = controlResults.filter((c) => c.status === "pass").length;
  const exceptionCount = controlsTested - controlsPassed;
  const pending = findings.filter((f) => f.reviewRequired && f.reviewId === null).length;

  const conclusion: Conclusion = {
    auditId: scenario.auditId,
    executionId: scenario.executionId,
    controlsTested,
    controlsPassed,
    exceptions: exceptionCount,
    findings: findings.length,
    humanReviewsCompleted: reviews.length,
    humanReviewsPending: pending,
    humanReviewCompleted: pending === 0 && reviews.length > 0,
    statement:
      `${controlsTested} controls tested, ${controlsPassed} passed, ` +
      `${exceptionCount} exception${exceptionCount === 1 ? "" : "s"}` +
      (pending === 0
        ? reviews.length > 0
          ? ", human verification completed."
          : "."
        : `, ${pending} finding${pending === 1 ? "" : "s"} awaiting human verification.`),
    concludedAt: stepAt(scenario, 110),
  };

  // ── 6. The tripwire. ──────────────────────────────────────────────────────
  assertMatchesExpected(scenario, conclusion);

  return {
    auditId: scenario.auditId,
    executionId: scenario.executionId,
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    period: scenario.period,
    isHero: scenario.isHero,
    openedAt: scenario.openedAt,
    artifacts: scenario.artifacts,
    retrieval: scenario.retrieval,
    reasoning: {
      ...reasoning,
      model: { name: scenario.reasoner.name, version: scenario.reasoner.version },
    },
    controlResults,
    findings,
    reviews,
    conclusion,
    searchTags: scenario.searchTags,
  };
}

/** Catch scenario-authoring mistakes at the boundary, with a useful message. */
function assertScenarioShape<E>(scenario: AuditScenario<E>): void {
  if (scenario.controls.length === 0) {
    throw new TypeError(`scenario ${scenario.scenarioId} declares no controls`);
  }

  const seen = new Set<string>();
  for (const control of scenario.controls) {
    if (seen.has(control.controlId)) {
      throw new TypeError(`scenario ${scenario.scenarioId}: duplicate control ${control.controlId}`);
    }
    seen.add(control.controlId);

    if (control.artifactIds.length === 0) {
      throw new TypeError(
        `control ${control.controlId} cites no evidence — a finding must be traceable ` +
          "to the artifacts that caused it",
      );
    }
    for (const artifactId of control.artifactIds) {
      if (!scenario.artifacts.some((a) => a.artifactId === artifactId)) {
        throw new TypeError(`control ${control.controlId} cites unknown artifact ${artifactId}`);
      }
    }
  }

  if (!scenario.reasoner.deterministic) {
    throw new TypeError(
      `scenario ${scenario.scenarioId} uses a non-deterministic reasoner — ` +
        "the demo result must not depend on a model's mood",
    );
  }
}

function assertMatchesExpected<E>(scenario: AuditScenario<E>, conclusion: Conclusion): void {
  const { expected } = scenario;
  const drift: string[] = [];
  if (conclusion.controlsTested !== expected.controlsTested) {
    drift.push(`controlsTested ${conclusion.controlsTested} ≠ ${expected.controlsTested}`);
  }
  if (conclusion.controlsPassed !== expected.controlsPassed) {
    drift.push(`controlsPassed ${conclusion.controlsPassed} ≠ ${expected.controlsPassed}`);
  }
  if (conclusion.exceptions !== expected.exceptions) {
    drift.push(`exceptions ${conclusion.exceptions} ≠ ${expected.exceptions}`);
  }
  if (conclusion.findings !== expected.findings) {
    drift.push(`findings ${conclusion.findings} ≠ ${expected.findings}`);
  }
  if (drift.length === 0) return;

  throw new Error(
    [
      `scenario ${scenario.scenarioId}: computed result does not match its declared expectation.`,
      ...drift.map((d) => `  - ${d}`),
      "  Either the evidence changed or a control rule changed. Fix the rule or update",
      "  the scenario's `expected` block deliberately — do not let the headline numbers drift.",
    ].join("\n"),
  );
}
