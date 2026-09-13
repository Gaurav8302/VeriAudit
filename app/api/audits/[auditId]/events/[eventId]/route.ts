/**
 * GET /api/audits/:auditId/events/:eventId — one event and its neighbourhood.
 *
 * Same payload as `?eventId=` on the collection route. The path form is what
 * the trail UI will bookmark.
 */
import { NextResponse } from "next/server";
import { eventDetailView, resolveScenario, runAndSeal } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditId: string; eventId: string }> },
) {
  const { auditId, eventId } = await params;
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }

  const run = await runAndSeal(scenario, { seal: false });
  const detail = eventDetailView(run, eventId);
  if (!detail) {
    return NextResponse.json(
      { error: `unknown event ${eventId} in ${scenario.auditId}` },
      { status: 404 },
    );
  }

  return NextResponse.json(detail);
}
