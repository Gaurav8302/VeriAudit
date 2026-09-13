import { NextResponse } from "next/server";
import { isProductTamperAllowed, isSealBundle, verifyProductExecution } from "@/lib/product/seal";
import type { SealSnapshot } from "@/lib/product/productEvents";
import type { TamperSimulation } from "@/lib/product/sealTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAMPERS = new Set<TamperSimulation>([
  "payload",
  "delete-leaf",
  "fingerprint",
  "finding",
  "review",
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    snapshot?: SealSnapshot;
    seal?: unknown;
    simulateTamper?: unknown;
    verified?: unknown;
  } | null;

  if (!body?.snapshot?.execution?.executionId || !isSealBundle(body.seal)) {
    return NextResponse.json(
      { error: "An execution snapshot and seal bundle are required." },
      { status: 400 },
    );
  }

  const requested =
    typeof body.simulateTamper === "string" && TAMPERS.has(body.simulateTamper as TamperSimulation)
      ? (body.simulateTamper as TamperSimulation)
      : null;
  if (requested && !isProductTamperAllowed()) {
    return NextResponse.json(
      { error: "Historical tampering simulation is disabled." },
      { status: 403 },
    );
  }

  const verification = await verifyProductExecution(body.snapshot, body.seal, {
    simulateTamper: requested,
  });

  return NextResponse.json({
    verification,
    ignoredClientVerdict: body.verified ?? null,
    tamperAllowed: isProductTamperAllowed(),
  });
}
