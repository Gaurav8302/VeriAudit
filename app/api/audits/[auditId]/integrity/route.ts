/**
 * Execution integrity.
 *
 * GET  — the snapshot and the causal reconstruction. Receipts are not here
 *        (they cannot be regenerated), so CooL status is `not-recorded` on a
 *        GET of a regenerated audit. That is honest, not a failure.
 *
 * POST { receipts, logState, treeHead? }
 *      — verifies caller-held receipts under the Milestone 1 policy AND
 *        binds each receipt to its leaf in the rehydrated tree. A genuine
 *        receipt sitting on the wrong event is a failure.
 */
import { NextResponse } from "next/server";
import {
  executionView,
  resolveScenario,
  runAndSeal,
  verifyTrail,
} from "@/lib/audit";
import type { AuditRun } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const execution = executionView(run);

  return NextResponse.json({
    ...execution,
    note:
      "Regenerated trail. POST the receipts and logState from POST /api/audits/run " +
      "to verify CooL integrity and the append-only tree.",
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

  const regenerated = await runAndSeal(scenario, { seal: false });
  const receiptMap = new Map(Object.entries(receipts as Record<string, unknown>));

  const run: AuditRun = {
    ...regenerated,
    events: regenerated.events.map((event) => {
      const receiptRef = `${event.executionId}:${event.eventId}`;
      const evidence = receiptMap.get(receiptRef);
      if (evidence === undefined) return event;
      // Re-attach the compact reference from the receipt itself so bindReceipt
      // can compare binding_hash, leafIndex, type, and execution_id.
      const envelope = evidence as {
        binding_hash?: string;
        record?: {
          record_id?: string;
          signature?: { key_id?: string; alg?: string };
          time?: { issued_at?: string };
          runtime?: { mode?: string };
          event?: { type?: string; execution_id?: string };
        };
        inclusion?: { leaf_index?: number; tree_size?: number };
        sth?: { log_id?: string };
      };
      return {
        ...event,
        cool: {
          recordId: envelope.record?.record_id ?? "",
          bindingHash: envelope.binding_hash ?? "",
          keyId: envelope.record?.signature?.key_id ?? "",
          signatureAlg: envelope.record?.signature?.alg ?? "",
          issuedAt: envelope.record?.time?.issued_at ?? "",
          runtimeMode: (envelope.record?.runtime?.mode ?? "simulated") as
            | "mock"
            | "simulated"
            | "hardware",
          leafIndex: envelope.inclusion?.leaf_index ?? null,
          treeSize: envelope.inclusion?.tree_size ?? null,
          logId: envelope.sth?.log_id ?? null,
          receiptRef,
          contentDigest: "",
        },
      };
    }),
    logState: Array.isArray(body["logState"]) ? (body["logState"] as string[]) : [],
    receipts: receiptMap,
    sealing: {
      ...regenerated.sealing,
      sealed: receiptMap.size,
      treeHead:
        body["treeHead"] && typeof body["treeHead"] === "object"
          ? (body["treeHead"] as { logId: string; treeSize: number; rootHash: string })
          : null,
    },
  };

  const integrity = await verifyTrail(run);
  return NextResponse.json(integrity);
}
