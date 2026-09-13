/**
 * POST /api/audits/run — execute an audit and seal its canonical events.
 *
 * Body:  { scenario: "financial" | "legal" | "cyber" | "procurement",
 *          logState?: string[], seal?: boolean }
 * Reply: { audit, trail, sealing, logState, receipts }
 *
 * Node.js runtime for the same reason as `/api/cool/record`: the authoritative
 * sealing path needs full ML-DSA and is CPU-bound (docs/COOL_SDK_AUDIT.md §9).
 *
 * `logState` in, `logState` out. The server holds nothing between calls, so the
 * caller owns the tree head and persists it (docs/ARCHITECTURE.md §4).
 *
 * Receipts ARE returned here — this is the only call that produces them, and
 * they cannot be regenerated (a fresh salt per record). Every other route omits
 * them and the caller serves them from its own store.
 */
import { NextResponse } from "next/server";
import { auditView, resolveScenario, runAndSeal, trailView } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** ~9 records at ~25 ms plus ~100 ms of key derivation, with headroom. */
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }

  const requested = (body["scenario"] ?? body["scenarioId"] ?? body["auditId"]) as unknown;
  if (typeof requested !== "string") {
    return NextResponse.json(
      { error: "provide `scenario` as a scenario id or audit id" },
      { status: 400 },
    );
  }

  const scenario = resolveScenario(requested);
  if (!scenario) {
    return NextResponse.json({ error: `unknown scenario ${requested}` }, { status: 404 });
  }

  try {
    const run = await runAndSeal(scenario, {
      logState: body["logState"] ?? [],
      seal: body["seal"] !== false,
    });

    return NextResponse.json({
      audit: auditView(scenario, run.result),
      trail: trailView(run),
      sealing: run.sealing,
      logState: run.logState,
      receipts: Object.fromEntries(run.receipts),
    });
  } catch (error) {
    const message = (error as Error).message;
    const isInput = error instanceof TypeError;
    return NextResponse.json(
      { error: message, ...(isInput ? {} : { kind: (error as Error).name }) },
      { status: isInput ? 400 : 500 },
    );
  }
}
