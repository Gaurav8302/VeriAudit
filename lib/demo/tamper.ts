/**
 * Presentation helper for the integrity demonstration.
 *
 * Mutates only the caller-held public log hashes. Receipts themselves are
 * left intact so a separate identity check can still pass. The reconstruction
 * POST then fails for a real reason: the sealed tree no longer matches.
 */
export function tamperLogState(logState: unknown): unknown {
  if (!Array.isArray(logState) || logState.length === 0) return logState;
  const next = logState.map((leaf) => String(leaf));
  const last = next[next.length - 1];
  if (!last) return next;
  const hex = last.match(/^(mh:sha256:)([0-9a-f]{64})$/);
  const prefix = hex?.[1];
  const body = hex?.[2];
  if (prefix && body) {
    next[next.length - 1] = prefix + body.slice(0, -1) + (body.endsWith("0") ? "1" : "0");
    return next;
  }
  next[next.length - 1] = last.slice(0, -1) + (last.endsWith("0") ? "1" : "0");
  return next;
}

export function firstReceipt(receipts: Record<string, unknown>): unknown | null {
  const values = Object.values(receipts);
  return values[0] ?? null;
}
