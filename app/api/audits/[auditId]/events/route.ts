/**
 * GET /api/audits/:auditId/events — the execution trail.
 *
 * Returns nodes, parent edges, `spineEventIds`, and `why`: the path from the
 * conclusion back to the root. That path is the answer to "why did this
 * conclusion happen?" and is exactly the set of events that get sealed.
 *
 * Query params:
 *   ?eventId=EVT-FIN-2609-023   one event with its payloads, ancestors, children
 *   ?type=control.tested        filter by event type
 *   ?order=sequence|occurredAt  sort (default: sequence)
 *
 * Regenerated, so `cool` is null on every event — see the parent route.
 */
import { NextResponse } from "next/server";
import {
  eventDetailView,
  resolveScenario,
  runAndSeal,
  trailView,
} from "@/lib/audit";
import type { EventOrder, EventType } from "@/lib/audit";

export const runtime = "nodejs";

const EVENT_TYPES = new Set<EventType>([
  "audit.started",
  "artifact.ingested",
  "artifact.parsed",
  "retrieval.executed",
  "model.executed",
  "tool.executed",
  "control.tested",
  "finding.created",
  "human.review.requested",
  "human.review.completed",
  "conclusion.created",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }

  const run = await runAndSeal(scenario, { seal: false });
  const search = new URL(request.url).searchParams;
  const eventId = search.get("eventId");

  if (eventId !== null) {
    const detail = eventDetailView(run, eventId);
    if (!detail) {
      return NextResponse.json(
        { error: `unknown event ${eventId} in ${scenario.auditId}` },
        { status: 404 },
      );
    }
    return NextResponse.json(detail);
  }

  const type = search.get("type");
  if (type !== null && !EVENT_TYPES.has(type as EventType)) {
    return NextResponse.json({ error: `unknown event type ${type}` }, { status: 400 });
  }

  const order = search.get("order");
  if (order !== null && order !== "sequence" && order !== "occurredAt") {
    return NextResponse.json({ error: "order must be sequence or occurredAt" }, { status: 400 });
  }

  return NextResponse.json(
    trailView(run, {
      ...(type === null ? {} : { type: type as EventType }),
      ...(order === null ? {} : { order: order as EventOrder }),
    }),
  );
}
