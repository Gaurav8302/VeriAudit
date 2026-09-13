import { NextResponse } from "next/server";
import { getArtifactContent } from "@/lib/product/workspace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Provide an artifact id." }, { status: 400 });
  }
  const file = getArtifactContent(id);
  if (!file) {
    return NextResponse.json({ error: "Unknown artifact." }, { status: 404 });
  }
  return new NextResponse(file.text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
