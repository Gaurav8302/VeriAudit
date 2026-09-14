import { NextResponse } from "next/server";
import { analyzeExecution } from "@/lib/ai/analyze";
import type { AiWorkspaceContext } from "@/lib/ai/context";
import type { AiChatMessage, AiEvidenceContext } from "@/lib/ai/types";
import { HERO_EXECUTION_ID } from "@/lib/product/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    auditId?: string;
    executionId?: string;
    prompt?: string;
    prior?: AiChatMessage[];
    evidence?: AiEvidenceContext[];
    auditTitle?: string;
    context?: AiWorkspaceContext;
  } | null;
  const prompt = body?.prompt?.trim();
  const executionId = body?.executionId?.trim();
  const auditId = body?.auditId?.trim();
  if (!prompt || !executionId || !auditId) {
    return NextResponse.json({ error: "An audit, execution, and question are required." }, { status: 400 });
  }
  if (executionId === HERO_EXECUTION_ID) {
    return NextResponse.json(
      { error: "The sealed original execution cannot receive AI work." },
      { status: 409 },
    );
  }

  const result = await analyzeExecution({
    prompt,
    prior: body?.prior ?? [],
    evidence: body?.evidence ?? [],
    auditTitle: body?.auditTitle,
    executionId,
    context: body?.context,
  });

  return NextResponse.json({
    reply: result.work.reply,
    actions: result.work.actions,
    grounding: result.work.grounding ?? null,
    confidence: result.work.confidence ?? null,
    evidenceReferences: result.work.evidenceReferences ?? [],
    suggestedFindings: result.work.suggestedFindings ?? [],
    provider: result.response.provider,
    model: result.response.model,
    requestId: result.response.requestId,
    usage: result.response.usage,
    latencyMs: result.response.latencyMs,
    status: result.response.status,
    mode: result.response.mode,
    failures: result.failures.map((item) => ({
      provider: item.provider,
      reason: item.reason,
    })),
  });
}
