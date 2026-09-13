import { NextResponse } from "next/server";
import { describeIdentity } from "@/lib/cool";
import { isProductTamperAllowed, PRODUCT_VERIFY_POLICY } from "@/lib/product/seal";
import { UNAVAILABLE_EXECUTION_CLAIM } from "@/lib/product/sealTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await params;
  const identity = await describeIdentity();

  return NextResponse.json({
    executionId,
    status: "unavailable",
    policy: PRODUCT_VERIFY_POLICY,
    identity: {
      applicationId: identity.applicationId,
      imageDigest: identity.imageDigest,
      logId: identity.logId,
      trustedKeyIds: identity.trustedKeyIds,
      runtimeMode: identity.runtimeMode,
      hardware: identity.hardware,
    },
    tamperAllowed: isProductTamperAllowed(),
    claim: UNAVAILABLE_EXECUTION_CLAIM,
    note:
      "Receipts are held with the product workspace and cannot be regenerated. " +
      "POST them to /api/product/executions/verify. A client verified flag is ignored.",
  });
}
