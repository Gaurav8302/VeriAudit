/**
 * GET /api/audits — the scenario catalogue.
 *
 * The engagement list. No CooL involved and nothing sealed, so this is the one
 * audit route that is cheap and cacheable.
 */
import { NextResponse } from "next/server";
import { HERO_SCENARIO_ID, scenarioCatalogue } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    heroScenarioId: HERO_SCENARIO_ID,
    scenarios: scenarioCatalogue(),
  });
}
