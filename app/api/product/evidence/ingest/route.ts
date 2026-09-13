import { NextResponse } from "next/server";
import { ingestFile } from "@/lib/ai/ingest";
import { HERO_EXECUTION_ID } from "@/lib/product/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const executionId = String(form?.get("executionId") ?? "");
  if (executionId === HERO_EXECUTION_ID) {
    return NextResponse.json(
      { error: "The sealed original execution cannot receive uploads." },
      { status: 409 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ingested = ingestFile({ name: file.name, type: file.type, bytes });
    return NextResponse.json(ingested);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The file could not be attached." },
      { status: 400 },
    );
  }
}
