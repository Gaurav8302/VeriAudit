import { NextResponse } from "next/server";
import { HERO_EXECUTION_ID } from "@/lib/product/workspace";
import { sealProductExecution } from "@/lib/product/seal";
import type { SealSnapshot } from "@/lib/product/productEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    snapshot?: SealSnapshot;
    verified?: unknown;
  } | null;
  const snapshot = body?.snapshot;
  if (!snapshot?.execution?.executionId || !snapshot.auditId) {
    return NextResponse.json({ error: "An execution snapshot is required." }, { status: 400 });
  }
  if (snapshot.execution.executionId === HERO_EXECUTION_ID) {
    return NextResponse.json(
      { error: "The sealed original execution cannot be sealed again." },
      { status: 409 },
    );
  }

  try {
    const bundle = await sealProductExecution(snapshot);
    return NextResponse.json({
      seal: bundle,
      ignoredClientVerdict: body?.verified ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This execution could not be sealed." },
      { status: 400 },
    );
  }
}
