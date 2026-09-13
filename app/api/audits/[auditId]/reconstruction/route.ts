/**
 * GET  /api/audits/:id/reconstruction — recorded execution, no new AI answer.
 * POST /api/audits/:id/reconstruction — same, plus CooL verification of
 *      caller-held receipts.
 */
import { NextResponse } from "next/server";
import { reconstructAudit } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  const reconstruction = await reconstructAudit(auditId);
  if (!reconstruction) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }
  return NextResponse.json(reconstruction);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const receipts = body["receipts"];
  if (receipts !== undefined && (receipts === null || typeof receipts !== "object" || Array.isArray(receipts))) {
    return NextResponse.json(
      { error: "provide `receipts` as an object keyed by receiptRef" },
      { status: 400 },
    );
  }

  const reconstruction = await reconstructAudit(auditId, {
    receipts: receipts as Record<string, unknown> | undefined,
    logState: body["logState"],
    treeHead: body["treeHead"] as { logId: string; treeSize: number; rootHash: string } | undefined,
  });
  if (!reconstruction) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }
  return NextResponse.json(reconstruction);
}
