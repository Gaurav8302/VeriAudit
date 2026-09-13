/**
 * POST /api/simulation/reset — reinitialize the demo corpus.
 *
 * There is no stored session to wipe. Reset is generateHistory again,
 * which cannot accumulate duplicates.
 */
import { NextResponse } from "next/server";
import { SEED, generateHistory, simulationSummary } from "@/lib/simulation";

export const runtime = "nodejs";

export async function POST() {
  const result = generateHistory(SEED);
  return NextResponse.json({
    reset: true,
    ...simulationSummary(result),
  });
}
