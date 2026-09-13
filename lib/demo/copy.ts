/**
 * Approved product language. The UI may paraphrase, but it may not
 * strengthen these claims (docs/SECURITY_AND_CLAIMS.md, this milestone).
 */
export const APPROVED_CLAIMS = {
  welcome:
    "Let AI perform audit work. Keep a verifiable trail of what happened.",
  simulateLater: "Three months later…",
  bossQuestion:
    "Why did we flag this revenue transaction? The client is disputing it and I need to know what the AI actually did.",
  heroQuery: "revenue recognition exception",
  bossQuery: "why did we flag this revenue transaction",
  coolPassed: "CooL verification passed",
  integrityVerified: "Execution integrity verified",
  identityVerified: "Trusted execution identity verified",
  unavailable: "Verification unavailable for this session",
  failed: "Integrity verification failed",
  notACorrectnessProof:
    "This verifies that the recorded execution has not been silently changed. It does not mean the AI decision was objectively correct.",
  productAfterProof:
    "The decision is backed by cryptographic evidence. The record shows what the AI did, what it found, and what the human approved.",
  productFoundation: "This is the foundation of VeriAudit.",
  productVision:
    "VeriAudit is being built as a real audit workspace: AI-assisted investigation, live execution traces, evidence, review, and a history you can reconstruct later.",
  exploreProduct: "Explore the product",
  restartWalkthrough: "Restart walkthrough",
  continueRework: "What if we need to investigate this again?",
  landingAfterWalkthrough:
    "You've seen the demonstration. Now you can inspect the product yourself.",
} as const;

export const FORBIDDEN_CLAIMS = [
  "100% trustworthy",
  "AI cannot be wrong",
  "Guaranteed authentic",
  "Blockchain verified",
  "Tamper-proof forever",
  "hardware-attested",
] as const;

export const SUGGESTION_CHIPS = [
  "revenue recognition exception",
  "approval missing",
  "September revenue audit",
  "REV-REC-01",
] as const;

export const DEMO_TIMING_SECONDS = {
  welcome: 15,
  scenarioSelect: 10,
  running: [15, 30],
  result: 15,
  simulating: [5, 10],
  history: 10,
  investigation: 15,
  trail: [30, 45],
  verification: [10, 15],
} as const;
