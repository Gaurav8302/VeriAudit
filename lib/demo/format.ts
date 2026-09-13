const UTC: Intl.DateTimeFormatOptions = { timeZone: "UTC" };

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    ...UTC,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    ...UTC,
    month: "long",
    year: "numeric",
  });
}

export function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    ...UTC,
    day: "numeric",
    month: "short",
  });
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export const STAGE_LABEL: Record<string, string> = {
  "audit.started": "Engagement opened",
  "artifact.ingested": "Evidence ingested",
  "artifact.parsed": "Evidence parsed",
  "retrieval.executed": "Retrieval",
  "model.executed": "Model action",
  "control.tested": "Control evaluation",
  "finding.created": "Finding",
  "human.review.completed": "Human review",
  "conclusion.created": "Conclusion",
};

export function stageLabel(type: string): string {
  return STAGE_LABEL[type] ?? type.replace(/\./g, " ");
}

export function money(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function statusWord(status: string): string {
  return status.replace(/-/g, " ");
}
