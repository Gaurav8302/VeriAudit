/**
 * Query and field normalisation. Deterministic, no locale tricks.
 *
 * Punctuation is stripped except `-` and `.` so `REV-REC-01` and `1.42M`
 * stay intact (docs/SEARCH_SPEC.md §3).
 */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "for",
  "in",
  "on",
  "did",
  "we",
  "why",
  "this",
  "that",
  "is",
  "to",
  "and",
  "or",
]);

const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  exception: ["exceptions", "finding", "flagged", "failed"],
  exceptions: ["exception", "finding", "flagged", "failed"],
  revenue: ["rev-rec", "recognition"],
  approval: ["approved", "authorisation", "authorization", "sign-off"],
  approved: ["approval"],
  september: ["2026-09", "q3"],
  flag: ["exception", "finding", "flagged"],
  flagged: ["exception", "finding", "flag"],
  recognition: ["rev-rec"],
  failed: ["exception", "finding"],
  finding: ["exception", "flagged"],
};

export const SUGGESTION_CHIPS = [
  "revenue recognition exception",
  "approval missing",
  "September revenue audit",
  "REV-REC-01",
] as const;

export const DEMO_QUERIES = [
  "revenue recognition exception",
  "revenue recognition",
  "September revenue audit",
  "approval missing",
  "why did we flag this revenue transaction",
  "REV-REC-01",
  "F-FIN-001",
  "1420000",
] as const;

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\w.\-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenise(text: string): string[] {
  if (!text) return [];
  return normalise(text)
    .split(" ")
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

export function expand(tokens: readonly string[]): { tokens: string[]; phrases: string[] } {
  const expanded = new Set<string>();
  const phrases = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    for (const synonym of SYNONYMS[token] ?? []) {
      if (synonym.includes(" ")) phrases.add(synonym);
      else expanded.add(synonym);
    }
  }

  // Authored multi-word phrases the demo queries rely on.
  const joined = tokens.join(" ");
  if (joined.includes("revenue") && joined.includes("recognition")) {
    phrases.add("revenue recognition");
    phrases.add("revenue recognition exception");
  }
  if (joined.includes("approval") && joined.includes("missing")) {
    phrases.add("approval missing");
  }
  if (joined.includes("september") && joined.includes("revenue")) {
    phrases.add("september revenue audit");
  }

  return {
    tokens: [...expanded].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    phrases: [...phrases].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  };
}

export function fieldTokens(text: string): string[] {
  return tokenise(text);
}
