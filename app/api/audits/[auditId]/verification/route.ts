/**
 * Verification status for an audit.
 *
 * GET  — which events are CooL-backed, and the policy and pinned identity they
 *        are checked against. It CANNOT report verified/failed, because the
 *        server holds no receipts: `randomSalt()` makes them unreproducible, so
 *        the session that ran the audit is the only holder
 *        (docs/COOL_SDK_AUDIT.md §7.2). Reporting a verdict here without a
 *        receipt would be exactly the "log viewer pretending to be evidence"
 *        that VeriAudit argues against.
 *
 * POST { receipts: { "<receiptRef>": <envelope>, … } }
 *      — verifies caller-held receipts under the unchanged Milestone 1
 *        production policy: SDK verdict, signer in the published allow-list,
 *        measurement equal to the pin, and `inclusion === "pass"`.
 */
import { NextResponse } from "next/server";
import { resolveScenario, runAndSeal } from "@/lib/audit";
import { describeIdentity, verifyReceipt } from "@/lib/cool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLICY = [
  "cool verdict ok",
  "signer key_id in the published allow-list",
  "measurement equals the pinned image measurement",
  'inclusion === "pass"',
] as const;

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
  const identity = await describeIdentity();

  return NextResponse.json({
    auditId: scenario.auditId,
    executionId: scenario.executionId,
    policy: POLICY,
    identity: {
      applicationId: identity.applicationId,
      imageDigest: identity.imageDigest,
      logId: identity.logId,
      trustedKeyIds: identity.trustedKeyIds,
      runtimeMode: identity.runtimeMode,
      hardware: identity.hardware,
    },
    coolBackedEventIds: run.canonicalEventIds,
    notRecordedEventIds: run.events
      .filter((e) => !e.canonical)
      .map((e) => e.eventId),
    status: "unavailable",
    note:
      "Receipts are held by the session that ran the audit and cannot be " +
      "regenerated. POST them here to verify.",
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  const scenario = resolveScenario(auditId);
  if (!scenario) {
    return NextResponse.json({ error: `unknown audit ${auditId}` }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }

  const receipts = body["receipts"];
  if (receipts === null || typeof receipts !== "object" || Array.isArray(receipts)) {
    return NextResponse.json(
      { error: "provide `receipts` as an object keyed by receiptRef" },
      { status: 400 },
    );
  }

  const entries = Object.entries(receipts as Record<string, unknown>);
  if (entries.length === 0) {
    return NextResponse.json({ error: "`receipts` is empty" }, { status: 400 });
  }
  if (entries.length > 64) {
    return NextResponse.json(
      { error: `too many receipts in one call: ${entries.length} (max 64)` },
      { status: 400 },
    );
  }

  const results = [];
  for (const [receiptRef, evidence] of entries) {
    const state = await verifyReceipt(evidence);
    results.push({
      receiptRef,
      // `receiptRef` is `${executionId}:${eventId}`, so the event id is derivable.
      eventId: receiptRef.split(":")[1] ?? null,
      state,
    });
  }

  const verified = results.filter((r) => r.state.ok).length;

  return NextResponse.json({
    auditId: scenario.auditId,
    policy: POLICY,
    status: verified === results.length ? "verified" : "failed",
    counts: { checked: results.length, verified, failed: results.length - verified },
    results,
  });
}
