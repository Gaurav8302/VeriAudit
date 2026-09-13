/**
 * POST /api/cool/verify — verify a receipt as VeriAudit evidence.
 *
 * Node.js runtime. Verification is also available client-side (CONFIRMED
 * browser-compatible, docs/COOL_SDK_AUDIT.md §6), but the server route is the
 * authoritative one and the one this milestone proves on Vercel.
 *
 * Body:  { receipt: unknown } | { receipts: unknown[] }
 * Reply: IntegrityState | { results: IntegrityState[] }
 *
 * A receipt that fails verification is a 200 with `status: "failed"`, not an
 * HTTP error — "this evidence is bad" is a successful answer to the question.
 */
import { NextResponse } from "next/server";
import { verifyReceipt, verifyReceipts } from "@/lib/cool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }

  if (Array.isArray(body["receipts"])) {
    const receipts = body["receipts"] as unknown[];
    if (receipts.length > 64) {
      return NextResponse.json({ error: "max 64 receipts per call" }, { status: 400 });
    }
    const results = await verifyReceipts(receipts);
    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        verified: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      },
      runtime: { name: "nodejs", node: process.version },
    });
  }

  if (!("receipt" in body)) {
    return NextResponse.json(
      { error: "provide `receipt` or `receipts`" },
      { status: 400 },
    );
  }

  const state = await verifyReceipt(body["receipt"]);
  return NextResponse.json({ ...state, runtime: { name: "nodejs", node: process.version } });
}
