import { NextResponse } from "next/server";
import { describeIdentity } from "@/lib/cool";
import { isProductTamperAllowed, PRODUCT_VERIFY_POLICY } from "@/lib/product/seal";
import { UNAVAILABLE_EXECUTION_CLAIM } from "@/lib/product/sealTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await params;
  // `describeIdentity` derives sealed keys (~100ms of ML-DSA work on a cold
  // instance). This endpoint cannot verify anything, so identity is opt-in
  // rather than a cost paid on every workspace render.
  const wantsIdentity = new URL(request.url).searchParams.get("identity") === "1";
  const identity = wantsIdentity ? await describeIdentity() : null;

  return NextResponse.json({
    executionId,
    status: "unavailable",
    policy: PRODUCT_VERIFY_POLICY,
    identity: identity
      ? {
          applicationId: identity.applicationId,
          imageDigest: identity.imageDigest,
          logId: identity.logId,
          trustedKeyIds: identity.trustedKeyIds,
          runtimeMode: identity.runtimeMode,
          hardware: identity.hardware,
        }
      : null,
    tamperAllowed: isProductTamperAllowed(),
    claim: UNAVAILABLE_EXECUTION_CLAIM,
    note:
      "Receipts are held with the product workspace and cannot be regenerated. " +
      "POST them to /api/product/executions/verify. A client verified flag is ignored.",
  });
}
