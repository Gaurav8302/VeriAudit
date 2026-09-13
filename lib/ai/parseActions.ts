import type { AiActionType, ParsedAiWork, ProposedAction } from "./types";

const ACTION_TYPES: readonly AiActionType[] = [
  "SEARCH_EVIDENCE",
  "READ_EVIDENCE",
  "ANALYZE_EVIDENCE",
  "COMPARE_EVIDENCE",
  "CREATE_FINDING",
  "UPDATE_FINDING",
  "SUMMARIZE",
  "REQUEST_HUMAN_REVIEW",
];

function asAction(value: unknown): ProposedAction | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!ACTION_TYPES.includes(row.type as AiActionType)) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) return null;
  return {
    type: row.type as AiActionType,
    title,
    detail: typeof row.detail === "string" ? row.detail : "",
    evidenceIds: Array.isArray(row.evidenceIds)
      ? row.evidenceIds.filter((id): id is string => typeof id === "string")
      : [],
    findingTitle: typeof row.findingTitle === "string" ? row.findingTitle : undefined,
    findingSeverity:
      row.findingSeverity === "low" ||
      row.findingSeverity === "medium" ||
      row.findingSeverity === "high" ||
      row.findingSeverity === "critical"
        ? row.findingSeverity
        : undefined,
    findingDescription: typeof row.findingDescription === "string" ? row.findingDescription : undefined,
    chunkIds: Array.isArray(row.chunkIds)
      ? row.chunkIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function parseAiWork(raw: string): ParsedAiWork {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        reply?: unknown;
        actions?: unknown;
        confidence?: unknown;
        evidenceReferences?: unknown;
        suggestedFindings?: unknown;
      };
      const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
      const actions = Array.isArray(parsed.actions)
        ? parsed.actions.map(asAction).filter((item): item is ProposedAction => Boolean(item))
        : [];
      if (reply || actions.length) {
        const confidence =
          parsed.confidence === "high" ||
          parsed.confidence === "medium" ||
          parsed.confidence === "low" ||
          parsed.confidence === "none"
            ? parsed.confidence
            : undefined;
        const refs = Array.isArray(parsed.evidenceReferences)
          ? parsed.evidenceReferences.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const row = item as Record<string, unknown>;
              if (typeof row.evidenceId !== "string" || typeof row.chunkId !== "string") return [];
              return [
                {
                  evidenceId: row.evidenceId,
                  chunkId: row.chunkId,
                  label: typeof row.label === "string" ? row.label : row.chunkId,
                  excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
                },
              ];
            })
          : [];
        const suggested = Array.isArray(parsed.suggestedFindings)
          ? parsed.suggestedFindings.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const row = item as Record<string, unknown>;
              if (typeof row.title !== "string" || typeof row.description !== "string") return [];
              const severity =
                row.severity === "low" ||
                row.severity === "medium" ||
                row.severity === "high" ||
                row.severity === "critical"
                  ? row.severity
                  : undefined;
              return [
                {
                  title: row.title,
                  description: row.description,
                  severity,
                  evidenceIds: Array.isArray(row.evidenceIds)
                    ? row.evidenceIds.filter((id): id is string => typeof id === "string")
                    : [],
                  chunkIds: Array.isArray(row.chunkIds)
                    ? row.chunkIds.filter((id): id is string => typeof id === "string")
                    : [],
                } satisfies NonNullable<ParsedAiWork["suggestedFindings"]>[number],
              ];
            })
          : [];
        return {
          reply: reply || "Analysis recorded.",
          actions,
          confidence,
          evidenceReferences: refs,
          suggestedFindings: suggested,
        };
      }
    } catch {
      // fall through to prose
    }
  }
  return {
    reply: raw.trim() || "The model returned no usable text.",
    actions: [
      {
        type: "SUMMARIZE",
        title: "Recorded unstructured reply",
        detail: "The model did not return structured actions.",
        evidenceIds: [],
      },
    ],
  };
}

export function completeStructuredWork(
  work: ParsedAiWork,
  evidence: readonly { evidenceId: string; title: string; extraction: string }[],
): ParsedAiWork {
  if (evidence.length === 0) return work;
  const actions = [...work.actions];
  const missingReads = evidence.filter(
    (item) =>
      !actions.some((action) => action.type === "READ_EVIDENCE" && action.evidenceIds.includes(item.evidenceId)),
  );
  for (const item of missingReads.reverse()) {
    actions.unshift({
      type: "READ_EVIDENCE",
      title: `Read ${item.title}`,
      detail: item.extraction === "text" ? "Used extracted text on this execution." : "Used evidence metadata only.",
      evidenceIds: [item.evidenceId],
    });
  }
  const ids = evidence.map((item) => item.evidenceId);
  const askedReview =
    actions.some((item) => item.type === "REQUEST_HUMAN_REVIEW") ||
    /review|exception|violat|needs human/i.test(work.reply);
  if (askedReview && !actions.some((item) => item.type === "CREATE_FINDING")) {
    actions.push({
      type: "CREATE_FINDING",
      title: "Create finding",
      detail: "Proposed from the analysis for human review.",
      evidenceIds: ids,
      findingTitle: "Exception proposed for human review",
      findingSeverity: "medium",
      findingDescription: work.reply,
    });
  }
  if (askedReview && !actions.some((item) => item.type === "REQUEST_HUMAN_REVIEW")) {
    actions.push({
      type: "REQUEST_HUMAN_REVIEW",
      title: "Request human review",
      detail: "AI proposals are not approved automatically.",
      evidenceIds: ids,
    });
  }
  return { reply: work.reply, actions };
}
