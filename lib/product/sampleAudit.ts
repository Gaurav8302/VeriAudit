/**
 * Machine-readable definition of the sample financial audit.
 *
 * This is the single source of truth for what the sample evidence corpus can
 * actually answer. It exists so the AI receives real controls and scope instead
 * of guessing from a prompt, and so the supported questions can be tested
 * rather than assumed. Nothing here is a cryptographic claim.
 */

export interface SampleControl {
  readonly controlId: string;
  readonly title: string;
  readonly requirement: string;
  /** Filenames in the sample pack that establish this control. */
  readonly sourceFiles: readonly string[];
}

export interface SampleEvidenceSpec {
  readonly filename: string;
  readonly label: string;
  readonly kind: string;
  readonly answers: readonly string[];
}

export interface SampleExceptionSpec {
  readonly entryId: string;
  readonly contractRef: string;
  readonly amountUsd: number;
  readonly controlIds: readonly string[];
  readonly reason: string;
}

export const SAMPLE_AUDIT_SCOPE = {
  title: "September Revenue Recognition Audit",
  period: "2026-09",
  reference: "REV-REC-01",
  objective:
    "Test whether September revenue was recognised only where a performance obligation was satisfied, and whether material entries were approved by someone other than the preparer.",
  ledgerAccount: "4000 Revenue",
} as const;

export const SAMPLE_CONTROLS: readonly SampleControl[] = [
  {
    controlId: "REV-REC-01",
    title: "Recognition on satisfied obligation",
    requirement:
      "Revenue is recognised only when a performance obligation is satisfied and the customer has obtained control.",
    sourceFiles: ["revenue-recognition-policy.txt"],
  },
  {
    controlId: "REV-REC-02",
    title: "No recognition on undelivered goods",
    requirement:
      "Revenue must not be recognised for undelivered or partially delivered shipments. Milestone M2 requires recorded delivery.",
    sourceFiles: ["revenue-recognition-policy.txt", "customer-contract-c-1001.txt"],
  },
  {
    controlId: "REV-SOD-01",
    title: "Segregation of preparer and approver",
    requirement: "The same person must not prepare and approve a material revenue entry.",
    sourceFiles: ["revenue-recognition-policy.txt"],
  },
  {
    controlId: "REV-APV-01",
    title: "Second reviewer above threshold",
    requirement:
      "Approvals above $250,000 require a second reviewer who is not the preparer.",
    sourceFiles: ["revenue-recognition-policy.txt"],
  },
  {
    controlId: "REV-DOC-01",
    title: "Contract support for material entries",
    requirement:
      "Each material revenue entry must be supported by the customer contract it was billed against.",
    sourceFiles: ["q3-general-ledger.csv"],
  },
];

export const SAMPLE_EVIDENCE: readonly SampleEvidenceSpec[] = [
  {
    filename: "q3-general-ledger.csv",
    label: "Q3 Revenue Ledger",
    kind: "Ledger",
    answers: [
      "Which September revenue entries exist, their amounts, delivery status, preparer and approver",
      "Which contract reference each entry was billed against",
    ],
  },
  {
    filename: "customer-contract-c-1001.txt",
    label: "Customer Contract C-1001",
    kind: "Contract",
    answers: [
      "Northwind Logistics obligations M1 and M2 and the $1,420,000 M2 milestone",
      "That no delivery receipt was recorded for M2",
    ],
  },
  {
    filename: "customer-contract-c-1002.txt",
    label: "Customer Contract C-1002",
    kind: "Contract",
    answers: [
      "Meridian Health Group tranche obligations and the $310,000 total",
      "That tranche two remains undelivered",
    ],
  },
  {
    filename: "revenue-recognition-policy.txt",
    label: "Revenue Recognition Policy REV-POL-3",
    kind: "Policy",
    answers: [
      "The recognition timing rule, the undelivered-shipment prohibition",
      "The segregation-of-duties and second-reviewer approval rules",
    ],
  },
];

/** Contracts referenced by the ledger that have no contract document attached. */
export const SAMPLE_MISSING_CONTRACTS: readonly string[] = ["C-1003", "C-1004"];

export const SAMPLE_EXCEPTIONS: readonly SampleExceptionSpec[] = [
  {
    entryId: "JE-4401",
    contractRef: "C-1001",
    amountUsd: 1_420_000,
    controlIds: ["REV-REC-02", "REV-SOD-01", "REV-APV-01"],
    reason:
      "Recognised against milestone M2 while delivery_status is not_delivered, and A. Ruiz is both preparer and approver of a $1,420,000 entry.",
  },
  {
    entryId: "JE-4402",
    contractRef: "C-1002",
    amountUsd: 310_000,
    controlIds: ["REV-REC-02"],
    reason:
      "Recognised in full while delivery_status is partial and contract C-1002 tranche two is undelivered.",
  },
  {
    entryId: "JE-4403",
    contractRef: "C-1003",
    amountUsd: 95_000,
    controlIds: ["REV-SOD-01", "REV-DOC-01"],
    reason: "J. Cole is both preparer and approver, and contract C-1003 is not attached.",
  },
  {
    entryId: "JE-4404",
    contractRef: "C-1004",
    amountUsd: 88_000,
    controlIds: ["REV-REC-02", "REV-DOC-01"],
    reason: "Recognised while delivery_status is not_delivered, and contract C-1004 is not attached.",
  },
];

/**
 * The questions the sample corpus is expected to answer. Used by the workspace
 * starters and by the prompt regression test.
 */
export const SAMPLE_QUESTIONS: readonly string[] = [
  "Review the uploaded revenue evidence.",
  "Which contracts are present?",
  "Which contracts are missing evidence?",
  "Find revenue recognition exceptions.",
  "Explain the $1,420,000 exception.",
  "Why was this transaction flagged?",
  "Which control was violated?",
  "Summarize the current audit.",
];
