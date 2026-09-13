/**
 * GET /api/audits/:auditId/execution — the compact execution snapshot.
 *
 * Regenerated, so `treeHead` is null and `verificationStatus` is
 * `not-recorded` unless the caller already holds receipts from POST /run.
 * The causal reconstruction (`why`) does not need receipts: it walks
 * `parentEventId`.
 */
import { NextResponse } from "next/server";
import { executionView, resolveScenario, runAndSeal } from "@/lib/audit";

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
  return NextResponse.json(executionView(run));
}
