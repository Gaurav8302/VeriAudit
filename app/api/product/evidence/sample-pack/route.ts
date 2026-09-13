import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ingestFile } from "@/lib/ai/ingest";
import { sampleFilesFor } from "@/lib/evidence/samplePack";
import { HERO_EXECUTION_ID } from "@/lib/product/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    executionId?: string;
    domain?: string;
  } | null;
  if (body?.executionId === HERO_EXECUTION_ID) {
    return NextResponse.json(
      { error: "The sealed original execution cannot receive uploads." },
      { status: 409 },
    );
  }

  const files = sampleFilesFor(body?.domain);
  const root = path.join(process.cwd(), "public");
  const ingested = [];
  for (const file of files) {
    const bytes = new Uint8Array(await readFile(path.join(root, file.path.replace(/^\//, ""))));
    ingested.push({
      ...ingestFile({ name: file.filename, type: "", bytes }),
      kind: file.kind,
      sample: true,
    });
  }
  return NextResponse.json({ files: ingested });
}
