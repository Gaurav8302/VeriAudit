/**
 * GET /api/simulation — the deterministic three-month corpus.
 *
 * Pure generation. Safe to call repeatedly: the same seed always yields the
 * same activities, never a longer list.
 */
import { NextResponse } from "next/server";
import { SEED, generateHistory } from "@/lib/simulation";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(generateHistory(SEED));
}
