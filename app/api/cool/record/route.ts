/**
 * POST /api/cool/record — seal events into CooL evidence.
 *
 * Node.js runtime, not Edge. CONFIRMED in docs/COOL_SDK_AUDIT.md §9: the
 * authoritative path must run where `node:crypto`-backed WebCrypto and full
 * ML-DSA are available, and Edge's 4 MB response cap and 25 s wall clock are
 * the wrong shape for ~30 KB receipts sealed in a loop.
 *
 * Body:  { events?: VeriAuditEvent[], logState?: string[], useSample?: boolean }
 * Reply: { recorded, logState, treeHead, timings }
 *
 * `logState` in, `logState` out: the server holds no state between calls, so
 * the caller owns the tree head. See docs/COOL_INTEGRATION.md §5.
 */
import { NextResponse } from "next/server";
import { recordEvents } from "@/lib/cool";
import type { VeriAuditEvent } from "@/lib/cool/types";
import { sampleTrail } from "@/lib/proof/sample-trail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Sealing is CPU-bound: ~25 ms/event plus ~100 ms of key derivation. */
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }

  const useSample = body["useSample"] === true || body["events"] === undefined;
  const events = (useSample ? sampleTrail() : body["events"]) as VeriAuditEvent[];

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: "provide a non-empty `events` array, or `useSample: true`" },
      { status: 400 },
    );
  }
  if (events.length > 64) {
    return NextResponse.json(
      { error: `too many events in one call: ${events.length} (max 64)` },
      { status: 400 },
    );
  }

  try {
    const result = await recordEvents(events, body["logState"] ?? []);
    return NextResponse.json({
      recorded: result.recorded,
      logState: result.logState,
      treeHead: result.treeHead,
      timings: result.timings,
      runtime: { name: "nodejs", node: process.version },
    });
  } catch (error) {
    // Client mistakes (bad event shape, bad logState) are 400; anything else
    // is a real failure and must surface, not be swallowed into a fake success.
    const message = (error as Error).message;
    const isInput = error instanceof TypeError;
    return NextResponse.json(
      { error: message, ...(isInput ? {} : { kind: (error as Error).name }) },
      { status: isInput ? 400 : 500 },
    );
  }
}
