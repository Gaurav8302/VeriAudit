import type { RunPayload, SessionEvidence } from "./payloads";

const KEY = "veriaudit.session.evidence";

export function evidenceFromRun(run: RunPayload): SessionEvidence {
  return {
    auditId: run.audit.auditId,
    executionId: run.audit.executionId,
    receipts: run.receipts,
    logState: run.logState,
    treeHead: run.sealing.treeHead,
  };
}

export function persistEvidence(evidence: SessionEvidence | null): void {
  if (typeof window === "undefined") return;
  if (evidence === null) {
    sessionStorage.removeItem(KEY);
    return;
  }
  sessionStorage.setItem(KEY, JSON.stringify(evidence));
}

export function loadEvidence(): SessionEvidence | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionEvidence;
  } catch {
    return null;
  }
}
