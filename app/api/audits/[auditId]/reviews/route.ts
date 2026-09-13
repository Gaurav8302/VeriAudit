/**
 * POST /api/audits/:auditId/reviews — record a human review decision.
 *
 * Body:  { findingId, decision: "accepted"|"modified"|"rejected", note,
 *          reviewer?, modifiedSeverity?, sequence?, logState? }
 * Reply: { review, finding, event, sealing, logState, receipt }
 *
 * The decision becomes a new `human.review.completed` event, sealed with the
 * real CooL adapter. Events are append-only, so this does not edit the
 * scenario's baseline review — it appends a second decision on the same
 * finding, and a reader sees both in order.
 *
 * GET returns the review state and which findings are still awaiting a person.
 */
import { NextResponse } from "next/server";
import { ReviewError, resolveScenario, runAndSeal, submitReview } from "@/lib/audit";
import type { ReviewSubmission } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }

  const { result } = await runAndSeal(scenario, { seal: false });

  return NextResponse.json({
    auditId: result.auditId,
    reviewer: scenario.reviewPolicy.reviewer,
    humanReviewCompleted: result.conclusion.humanReviewCompleted,
    reviews: result.reviews,
    awaitingReview: result.findings
      .filter((f) => f.reviewRequired && f.reviewId === null)
      .map((f) => ({ findingId: f.findingId, controlId: f.controlId, severity: f.severity, title: f.title })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }

  let body: ReviewSubmission;
  try {
    body = (await request.json()) as ReviewSubmission;
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }

  try {
    const outcome = await submitReview(scenario, body);
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof ReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: (error as Error).message, kind: (error as Error).name },
      { status: 500 },
    );
  }
}
