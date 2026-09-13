/**
 * GET /api/audits/:auditId/findings — findings with their causal context.
 *
 * Each finding is returned with the control that produced it, the evidence that
 * control read, and the review decision if one exists — so a client can render
 * "what did the AI find, and why" without a second request.
 *
 *   Evidence → Control → Finding → Review
 */
import { NextResponse } from "next/server";
import { resolveScenario, runAndSeal } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }

  const run = await runAndSeal(scenario, { seal: false });
  const { result } = run;

  return NextResponse.json({
    auditId: result.auditId,
    executionId: result.executionId,
    counts: {
      findings: result.findings.length,
      reviewRequired: result.findings.filter((f) => f.reviewRequired).length,
      pending: result.findings.filter((f) => f.status === "open").length,
    },
    findings: result.findings.map((finding) => {
      const control = result.controlResults.find((c) => c.controlId === finding.controlId);
      const review = result.reviews.find((r) => r.findingId === finding.findingId) ?? null;
      const event = run.events.find(
        (e) => e.type === "finding.created" && e.findingRef === finding.findingId,
      );

      return {
        ...finding,
        eventId: event?.eventId ?? null,
        control: control
          ? {
              controlId: control.controlId,
              name: control.name,
              description: control.description,
              category: control.category,
              status: control.status,
              rationale: control.rationale,
              observed: control.observed,
            }
          : null,
        evidence: finding.evidenceArtifactIds.map((artifactId) => {
          const artifact = scenario.artifacts.find((a) => a.artifactId === artifactId);
          return {
            artifactId,
            title: artifact?.title ?? null,
            kind: artifact?.kind ?? null,
          };
        }),
        review,
      };
    }),
  });
}
