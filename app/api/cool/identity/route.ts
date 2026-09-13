/**
 * GET /api/cool/identity — the published, pinnable evidence-plane identity.
 *
 * Public values only: a measurement and public keys. This is what an external
 * verifier would pin to check that a receipt came from VeriAudit, and it is how
 * the Vercel deployment is checked for identity drift against the committed
 * `lib/cool/identity.generated.ts`.
 */
import { NextResponse } from "next/server";
import { GENERATED_FOR, describeIdentity, dstackEndpointIsSet } from "@/lib/cool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await describeIdentity();

  return NextResponse.json({
    ...identity,
    pin: {
      generatedFor: GENERATED_FOR,
      matches: identity.pinned.matches,
      differingRegisters: identity.pinned.differingRegisters,
    },
    warnings: dstackEndpointIsSet()
      ? ["COOL_DSTACK_ENDPOINT is set; it must be unset outside a real TEE"]
      : [],
    runtime: {
      name: "nodejs",
      node: process.version,
      vercel: process.env["VERCEL"] === "1",
      region: process.env["VERCEL_REGION"] ?? null,
    },
  });
}
