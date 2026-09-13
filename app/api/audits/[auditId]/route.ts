/**
 * GET /api/audits/:auditId — the audit as it stood, regenerated.
 *
 * There is no database. The engine is deterministic, so an audit is retrieved
 * by re-running it: same scenario in, byte-identical result out
 * (docs/ARCHITECTURE.md §4).
 *
 * What CANNOT be regenerated is the receipts — `randomSalt()` draws fresh bytes
 * per record, so re-sealing produces different `record_id` and `binding_hash`
 * values (CONFIRMED, docs/COOL_SDK_AUDIT.md §7.2). This route therefore runs
 * with `seal: false` and every event carries `cool: null`. The session that ran
 * the audit holds the receipts and the references; it re-attaches them.
 *
 * Accepts a scenario id (`financial`) as well as an audit id, so the demo can
 * link either way.
 */
import { NextResponse } from "next/server";
import { auditView, evidenceView, resolveScenario, runAndSeal, trailView } from "@/lib/audit";

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

  return NextResponse.json({
    audit: auditView(scenario, run.result),
    evidence: evidenceView(scenario),
    trail: {
      ...trailView(run),
      // Said explicitly so a client never mistakes a regenerated trail for an
      // unsealed one.
      note:
        "Regenerated deterministically. CooL references are null here because " +
        "receipts are produced once at run time and cannot be reproduced; " +
        "re-attach them from the session store.",
    },
  });
}
