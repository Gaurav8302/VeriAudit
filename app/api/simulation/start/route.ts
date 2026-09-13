/**
 * POST /api/simulation/start — load the three-month demo state.
 *
 * Idempotent. Optional `{ seed }` for tests; the demo always uses SEED.
 * Returns the compact summary plus the activity feed.
 */
import { NextResponse } from "next/server";
import { SEED, generateHistory, simulationSummary } from "@/lib/simulation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let seed = SEED;
  try {
    const body = (await request.json()) as { seed?: unknown };
    if (typeof body.seed === "number" && Number.isInteger(body.seed)) {
      seed = body.seed;
    }
  } catch {
    // empty body is fine — use the demo seed
  }

  const result = generateHistory(seed);
  return NextResponse.json({
    ...simulationSummary(result),
    activities: result.activities,
    audits: result.audits.map((a) => ({
      auditId: a.auditId,
      title: a.title,
      scenario: a.scenario,
      isHero: a.isHero,
      hasEngineTrail: a.hasEngineTrail,
      executionIds: a.executionIds,
    })),
  });
}
