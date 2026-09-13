/**
 * HERO SCENARIO — September Revenue Recognition Audit.
 *
 * The headline result (12 tested / 9 passed / 3 exceptions) is **computed**, not
 * asserted. The evidence below is authored so that twelve genuinely different
 * rules produce exactly three exceptions, and `expected` in the scenario block
 * makes the engine throw if that ever stops being true.
 *
 * Each exception traces to exactly one control, deliberately: an entry that
 * tripped three rules at once would make "which control caused this finding?"
 * ambiguous, and that question is the whole demo.
 *
 *   E-1001  revenue recognised before delivery      → REV-REC-01   high
 *   E-1004  approved above the approver's authority → APR-CHAIN-06 medium
 *   E-1005  posted and approved by the same person  → SEG-DUT-10   medium → low
 */
import { deterministicReasoner } from "../reasoner";
import type { Artifact, AuditScenario, Control, JsonValue } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Evidence
// ─────────────────────────────────────────────────────────────────────────────

interface Milestone {
  readonly milestoneId: string;
  readonly description: string;
  readonly dueOn: string;
  /** null = the performance obligation has NOT been satisfied. */
  readonly deliveredOn: string | null;
  readonly valueUsd: number;
}

interface Contract {
  readonly contractId: string;
  readonly customer: string;
  readonly totalUsd: number;
  readonly signedOn: string;
  readonly milestones: readonly Milestone[];
}

interface LedgerEntry {
  readonly entryId: string;
  readonly postedOn: string;
  readonly contractId: string;
  readonly milestoneId: string;
  readonly customer: string;
  readonly amountUsd: number;
  readonly description: string;
  readonly invoiceId: string;
  readonly approvalId: string;
  readonly postedBy: string;
}

interface Approval {
  readonly approvalId: string;
  readonly entryId: string;
  readonly approvedBy: string;
  readonly approvedOn: string;
}

interface Invoice {
  readonly invoiceId: string;
  readonly entryId: string;
  readonly amountUsd: number;
  readonly issuedOn: string;
}

interface Approver {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  /** The maximum single entry this role may approve. */
  readonly authorityUsd: number;
}

export interface FinancialEvidence {
  readonly period: { readonly start: string; readonly end: string };
  /** The full ledger is 412 rows; these are the material items selected for testing. */
  readonly ledgerRowsTotal: number;
  readonly materialityUsd: number;
  readonly entries: readonly LedgerEntry[];
  /** The ledger's own stated total for the material items, for reconciliation. */
  readonly statedMaterialTotalUsd: number;
  readonly contracts: readonly Contract[];
  readonly invoices: readonly Invoice[];
  readonly approvals: readonly Approval[];
  readonly approvers: readonly Approver[];
  readonly policy: {
    readonly policyId: string;
    readonly rule: string;
    readonly segregationRequired: boolean;
  };
  readonly priorExceptions: readonly {
    readonly exceptionId: string;
    readonly period: string;
    readonly remediation: string | null;
  }[];
}

const APPROVERS: Approver[] = [
  { userId: "r.silva", name: "R. Silva", role: "Chief Financial Officer", authorityUsd: 2_000_000 },
  { userId: "t.nguyen", name: "T. Nguyen", role: "Finance Manager", authorityUsd: 250_000 },
  { userId: "a.mehta", name: "A. Mehta", role: "Revenue Accountant", authorityUsd: 100_000 },
  { userId: "k.owusu", name: "K. Owusu", role: "Revenue Accountant", authorityUsd: 100_000 },
];

const CONTRACTS: Contract[] = [
  {
    contractId: "C-1001",
    customer: "Northwind Logistics",
    totalUsd: 2_400_000,
    signedOn: "2026-06-12",
    milestones: [
      {
        milestoneId: "M1",
        description: "Platform provisioning and onboarding",
        dueOn: "2026-08-31",
        deliveredOn: "2026-08-30",
        valueUsd: 400_000,
      },
      {
        milestoneId: "M2",
        description: "Regional rollout, phase 2 (12 depots)",
        dueOn: "2026-11-15",
        // The crux of the hero finding: not delivered, yet revenue was booked.
        deliveredOn: null,
        valueUsd: 1_420_000,
      },
      {
        milestoneId: "M3",
        description: "Integration with customer WMS",
        dueOn: "2026-09-30",
        deliveredOn: "2026-09-05",
        valueUsd: 300_000,
      },
    ],
  },
  {
    contractId: "C-1002",
    customer: "Meridian Health Group",
    totalUsd: 1_500_000,
    signedOn: "2026-05-03",
    milestones: [
      {
        milestoneId: "N1",
        description: "Clinical data migration",
        dueOn: "2026-08-15",
        deliveredOn: "2026-08-01",
        valueUsd: 900_000,
      },
      {
        milestoneId: "N2",
        description: "Reporting module enablement",
        dueOn: "2026-09-15",
        deliveredOn: "2026-09-01",
        valueUsd: 300_000,
      },
      {
        milestoneId: "N3",
        description: "Staff training programme",
        dueOn: "2026-07-31",
        deliveredOn: "2026-07-15",
        valueUsd: 120_000,
      },
    ],
  },
];

const ENTRIES: LedgerEntry[] = [
  {
    entryId: "E-1001",
    postedOn: "2026-09-28",
    contractId: "C-1001",
    milestoneId: "M2",
    customer: "Northwind Logistics",
    amountUsd: 1_420_000,
    description: "Regional rollout phase 2 — revenue recognised",
    invoiceId: "INV-2001",
    approvalId: "APR-3001",
    postedBy: "a.mehta",
  },
  {
    entryId: "E-1002",
    postedOn: "2026-08-14",
    contractId: "C-1002",
    milestoneId: "N1",
    customer: "Meridian Health Group",
    amountUsd: 860_000,
    description: "Clinical data migration — revenue recognised",
    invoiceId: "INV-2002",
    approvalId: "APR-3002",
    postedBy: "a.mehta",
  },
  {
    entryId: "E-1003",
    postedOn: "2026-09-05",
    contractId: "C-1002",
    milestoneId: "N2",
    customer: "Meridian Health Group",
    amountUsd: 240_000,
    description: "Reporting module enablement — revenue recognised",
    invoiceId: "INV-2003",
    approvalId: "APR-3003",
    postedBy: "k.owusu",
  },
  {
    entryId: "E-1004",
    postedOn: "2026-09-19",
    contractId: "C-1001",
    milestoneId: "M1",
    customer: "Northwind Logistics",
    amountUsd: 310_000,
    description: "Platform provisioning — residual revenue recognised",
    invoiceId: "INV-2004",
    // Approved by a Finance Manager whose authority stops at $250,000.
    approvalId: "APR-3004",
    postedBy: "a.mehta",
  },
  {
    entryId: "E-1005",
    postedOn: "2026-07-22",
    contractId: "C-1002",
    milestoneId: "N3",
    customer: "Meridian Health Group",
    amountUsd: 95_000,
    description: "Staff training programme — revenue recognised",
    invoiceId: "INV-2005",
    // Approved by the same person who posted it.
    approvalId: "APR-3005",
    postedBy: "a.mehta",
  },
  {
    entryId: "E-1006",
    postedOn: "2026-09-11",
    contractId: "C-1001",
    milestoneId: "M3",
    customer: "Northwind Logistics",
    amountUsd: 180_000,
    description: "WMS integration — revenue recognised",
    invoiceId: "INV-2006",
    approvalId: "APR-3006",
    postedBy: "k.owusu",
  },
];

const INVOICES: Invoice[] = [
  { invoiceId: "INV-2001", entryId: "E-1001", amountUsd: 1_420_000, issuedOn: "2026-09-28" },
  { invoiceId: "INV-2002", entryId: "E-1002", amountUsd: 860_000, issuedOn: "2026-08-14" },
  { invoiceId: "INV-2003", entryId: "E-1003", amountUsd: 240_000, issuedOn: "2026-09-05" },
  { invoiceId: "INV-2004", entryId: "E-1004", amountUsd: 310_000, issuedOn: "2026-09-19" },
  { invoiceId: "INV-2005", entryId: "E-1005", amountUsd: 95_000, issuedOn: "2026-07-22" },
  { invoiceId: "INV-2006", entryId: "E-1006", amountUsd: 180_000, issuedOn: "2026-09-11" },
];

const APPROVALS: Approval[] = [
  { approvalId: "APR-3001", entryId: "E-1001", approvedBy: "r.silva", approvedOn: "2026-09-28" },
  { approvalId: "APR-3002", entryId: "E-1002", approvedBy: "r.silva", approvedOn: "2026-08-14" },
  { approvalId: "APR-3003", entryId: "E-1003", approvedBy: "t.nguyen", approvedOn: "2026-09-05" },
  { approvalId: "APR-3004", entryId: "E-1004", approvedBy: "t.nguyen", approvedOn: "2026-09-19" },
  { approvalId: "APR-3005", entryId: "E-1005", approvedBy: "a.mehta", approvedOn: "2026-07-22" },
  { approvalId: "APR-3006", entryId: "E-1006", approvedBy: "r.silva", approvedOn: "2026-09-11" },
];

const EVIDENCE: FinancialEvidence = {
  period: { start: "2026-07-01", end: "2026-09-30" },
  ledgerRowsTotal: 412,
  materialityUsd: 90_000,
  entries: ENTRIES,
  statedMaterialTotalUsd: 3_105_000,
  contracts: CONTRACTS,
  invoices: INVOICES,
  approvals: APPROVALS,
  approvers: APPROVERS,
  policy: {
    policyId: "REV-POL-3",
    rule:
      "Revenue may be recognised only once the related performance obligation " +
      "has been satisfied, evidenced by a recorded delivery date.",
    segregationRequired: true,
  },
  priorExceptions: [
    {
      exceptionId: "EXC-2026-Q2-01",
      period: "2026-Q2",
      remediation: "Approval matrix updated 2026-07-02; re-tested and closed.",
    },
    {
      exceptionId: "EXC-2026-Q2-02",
      period: "2026-Q2",
      remediation: "Duplicate-entry check automated in the ledger import 2026-07-10.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers shared by the rules
// ─────────────────────────────────────────────────────────────────────────────

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

function approverOf(e: FinancialEvidence, entry: LedgerEntry): Approver | undefined {
  const approval = e.approvals.find((a) => a.approvalId === entry.approvalId);
  return approval ? e.approvers.find((p) => p.userId === approval.approvedBy) : undefined;
}

function milestoneOf(e: FinancialEvidence, entry: LedgerEntry): Milestone | undefined {
  return e.contracts
    .find((c) => c.contractId === entry.contractId)
    ?.milestones.find((m) => m.milestoneId === entry.milestoneId);
}

// ─────────────────────────────────────────────────────────────────────────────
// The twelve controls
// ─────────────────────────────────────────────────────────────────────────────

const ART_LEDGER = "ART-FIN-001";
const ART_C1001 = "ART-FIN-002";
const ART_C1002 = "ART-FIN-003";
const ART_POLICY = "ART-FIN-004";

const CONTROLS: Control<FinancialEvidence>[] = [
  {
    controlId: "TXN-AUTH-01",
    name: "Transaction authorisation",
    description: "Every material revenue entry carries a recorded approval.",
    category: "authorisation",
    artifactIds: [ART_LEDGER],
    evaluate: ({ evidence }) => {
      const missing = evidence.entries.filter(
        (entry) => !evidence.approvals.some((a) => a.approvalId === entry.approvalId),
      );
      return {
        status: missing.length === 0 ? "pass" : "exception",
        observed: { entries_tested: evidence.entries.length, without_approval: missing.length },
        rationale:
          missing.length === 0
            ? `All ${evidence.entries.length} material entries carry a recorded approval.`
            : `${missing.length} entries have no approval record: ${missing.map((m) => m.entryId).join(", ")}.`,
        ...(missing.length === 0
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Revenue entries recorded without authorisation",
                description: `${missing.length} material entries lack an approval record.`,
                recommendedAction: "Obtain retrospective approval or reverse the entries.",
              },
            }),
      };
    },
  },
  {
    controlId: "DOC-SUP-02",
    name: "Supporting documentation",
    description: "Every material revenue entry is supported by an issued invoice.",
    category: "documentation",
    artifactIds: [ART_LEDGER],
    evaluate: ({ evidence }) => {
      const missing = evidence.entries.filter(
        (entry) => !evidence.invoices.some((i) => i.invoiceId === entry.invoiceId),
      );
      return {
        status: missing.length === 0 ? "pass" : "exception",
        observed: { entries_tested: evidence.entries.length, without_invoice: missing.length },
        rationale:
          missing.length === 0
            ? `All ${evidence.entries.length} material entries trace to an issued invoice.`
            : `${missing.length} entries have no supporting invoice.`,
        ...(missing.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Revenue entries lacking supporting documentation",
                description: `${missing.length} entries have no invoice on file.`,
                recommendedAction: "Attach the supporting invoices or reverse the entries.",
              },
            }),
      };
    },
  },
  {
    controlId: "INV-MATCH-03",
    name: "Invoice matching",
    description: "Invoice amounts agree with the posted revenue amounts.",
    category: "reconciliation",
    artifactIds: [ART_LEDGER],
    evaluate: ({ evidence }) => {
      const mismatched = evidence.entries.filter((entry) => {
        const invoice = evidence.invoices.find((i) => i.invoiceId === entry.invoiceId);
        return invoice !== undefined && invoice.amountUsd !== entry.amountUsd;
      });
      return {
        status: mismatched.length === 0 ? "pass" : "exception",
        observed: { entries_tested: evidence.entries.length, mismatched: mismatched.length },
        rationale:
          mismatched.length === 0
            ? "Every invoice amount agrees with the posted revenue amount to the dollar."
            : `${mismatched.length} entries disagree with their invoice: ${mismatched.map((m) => m.entryId).join(", ")}.`,
        ...(mismatched.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Invoice and ledger amounts disagree",
                description: `${mismatched.length} entries do not match their invoice amount.`,
                recommendedAction: "Reconcile the difference and correct the ledger.",
              },
            }),
      };
    },
  },
  {
    controlId: "CON-CONS-04",
    name: "Contract consistency",
    description: "Revenue recognised per contract does not exceed the contract value.",
    category: "contract",
    artifactIds: [ART_C1001, ART_C1002],
    evaluate: ({ evidence }) => {
      const overruns = evidence.contracts
        .map((contract) => {
          const recognised = evidence.entries
            .filter((e) => e.contractId === contract.contractId)
            .reduce((sum, e) => sum + e.amountUsd, 0);
          return { contractId: contract.contractId, recognised, totalUsd: contract.totalUsd };
        })
        .filter((c) => c.recognised > c.totalUsd);
      const perContract: Record<string, JsonValue> = {};
      for (const contract of evidence.contracts) {
        perContract[contract.contractId] = evidence.entries
          .filter((e) => e.contractId === contract.contractId)
          .reduce((sum, e) => sum + e.amountUsd, 0);
      }
      return {
        status: overruns.length === 0 ? "pass" : "exception",
        observed: { recognised_per_contract: perContract, overruns: overruns.length },
        rationale:
          overruns.length === 0
            ? "Recognised revenue stays within the contracted value for both contracts."
            : `${overruns.length} contracts have revenue recognised above their contracted value.`,
        ...(overruns.length === 0
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Revenue recognised in excess of contract value",
                description: `${overruns.length} contracts are over-recognised.`,
                recommendedAction: "Reverse the excess or obtain a signed contract amendment.",
              },
            }),
      };
    },
  },
  {
    // ── THE HERO CONTROL ──────────────────────────────────────────────────────
    controlId: "REV-REC-01",
    name: "Revenue recognition timing",
    description:
      "Revenue is recognised only after the related performance obligation is satisfied, " +
      "per policy REV-POL-3.",
    category: "revenue recognition",
    artifactIds: [ART_LEDGER, ART_C1001, ART_POLICY],
    evaluate: ({ evidence }) => {
      const premature = evidence.entries.filter((entry) => {
        const milestone = milestoneOf(evidence, entry);
        if (!milestone) return false;
        // Not delivered at all, or delivered after the revenue was booked.
        return milestone.deliveredOn === null || milestone.deliveredOn > entry.postedOn;
      });

      if (premature.length === 0) {
        return {
          status: "pass",
          observed: { entries_tested: evidence.entries.length, premature: 0 },
          rationale:
            "Every recognised amount is supported by a delivery date on or before the posting date.",
        };
      }

      const worst = [...premature].sort((a, b) => b.amountUsd - a.amountUsd)[0]!;
      const milestone = milestoneOf(evidence, worst)!;
      const total = premature.reduce((sum, e) => sum + e.amountUsd, 0);

      return {
        status: "exception",
        observed: {
          entries_tested: evidence.entries.length,
          premature: premature.length,
          premature_entry_ids: premature.map((e) => e.entryId),
          amount_usd: total,
          contract: worst.contractId,
          milestone: milestone.milestoneId,
          milestone_due_on: milestone.dueOn,
          milestone_delivered_on: milestone.deliveredOn,
          posted_on: worst.postedOn,
          policy: evidence.policy.policyId,
        },
        rationale:
          `Entry ${worst.entryId} recognises ${money(worst.amountUsd)} against contract ` +
          `${worst.contractId} milestone ${milestone.milestoneId} ("${milestone.description}"), ` +
          `posted ${worst.postedOn}. That milestone has no recorded delivery date and is not due ` +
          `until ${milestone.dueOn}, so the performance obligation was not satisfied when the ` +
          `revenue was booked. Policy ${evidence.policy.policyId} requires delivery first.`,
        finding: {
          severity: "high",
          title: "Revenue recognised before performance obligation satisfied",
          description:
            `${money(total)} of revenue on contract ${worst.contractId} was recognised in ` +
            `${worst.postedOn.slice(0, 7)} against milestone ${milestone.milestoneId}, which has ` +
            `no recorded delivery and is not due until ${milestone.dueOn}.`,
          recommendedAction:
            `Reverse ${money(total)} from the period and re-recognise it once milestone ` +
            `${milestone.milestoneId} delivery is evidenced.`,
          amountUsd: total,
        },
      };
    },
  },
  {
    controlId: "APR-CHAIN-06",
    name: "Approval chain authority",
    description: "Each entry was approved by someone whose authority covers the amount.",
    category: "authorisation",
    artifactIds: [ART_LEDGER],
    evaluate: ({ evidence }) => {
      const exceeded = evidence.entries.flatMap((entry) => {
        const approver = approverOf(evidence, entry);
        if (!approver || entry.amountUsd <= approver.authorityUsd) return [];
        return [{ entry, approver }];
      });

      if (exceeded.length === 0) {
        return {
          status: "pass",
          observed: { entries_tested: evidence.entries.length, above_authority: 0 },
          rationale: "Every approval sits within the approver's delegated authority.",
        };
      }

      const first = exceeded[0]!;
      return {
        status: "exception",
        observed: {
          entries_tested: evidence.entries.length,
          above_authority: exceeded.length,
          entry_ids: exceeded.map((x) => x.entry.entryId),
          approver: first.approver.name,
          approver_role: first.approver.role,
          authority_usd: first.approver.authorityUsd,
          amount_usd: first.entry.amountUsd,
        },
        rationale:
          `Entry ${first.entry.entryId} for ${money(first.entry.amountUsd)} was approved by ` +
          `${first.approver.name} (${first.approver.role}), whose delegated authority is ` +
          `${money(first.approver.authorityUsd)}. The amount exceeds that limit by ` +
          `${money(first.entry.amountUsd - first.approver.authorityUsd)}.`,
        finding: {
          severity: "medium",
          title: "Revenue entry approved above delegated authority",
          description:
            `${exceeded.length} entry approved outside the approval matrix: ` +
            `${first.entry.entryId} (${money(first.entry.amountUsd)}) signed off by a ` +
            `${first.approver.role} limited to ${money(first.approver.authorityUsd)}.`,
          recommendedAction:
            "Obtain CFO ratification for the entry and re-test the approval matrix configuration.",
          amountUsd: first.entry.amountUsd,
        },
      };
    },
  },
  {
    controlId: "DUP-DET-07",
    name: "Duplicate transaction detection",
    description: "No two entries share the same contract, amount, and posting date.",
    category: "data integrity",
    artifactIds: [ART_LEDGER],
    evaluate: ({ evidence }) => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const entry of evidence.entries) {
        const key = `${entry.contractId}|${entry.amountUsd}|${entry.postedOn}`;
        const prior = seen.get(key);
        if (prior) duplicates.push(`${prior}/${entry.entryId}`);
        else seen.set(key, entry.entryId);
      }
      return {
        status: duplicates.length === 0 ? "pass" : "exception",
        observed: { entries_tested: evidence.entries.length, duplicate_pairs: duplicates.length },
        rationale:
          duplicates.length === 0
            ? "No duplicate revenue entries detected across contract, amount, and date."
            : `${duplicates.length} duplicate pairs detected: ${duplicates.join(", ")}.`,
        ...(duplicates.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Duplicate revenue entries detected",
                description: `${duplicates.length} pairs of entries appear to be duplicates.`,
                recommendedAction: "Reverse the duplicate entries and enable the import-time check.",
              },
            }),
      };
    },
  },
  {
    controlId: "PER-CLS-08",
    name: "Period classification",
    description: "Every entry is posted inside the audit period.",
    category: "cut-off",
    artifactIds: [ART_LEDGER],
    evaluate: ({ evidence }) => {
      const outside = evidence.entries.filter(
        (e) => e.postedOn < evidence.period.start || e.postedOn > evidence.period.end,
      );
      return {
        status: outside.length === 0 ? "pass" : "exception",
        observed: {
          entries_tested: evidence.entries.length,
          period_start: evidence.period.start,
          period_end: evidence.period.end,
          outside_period: outside.length,
        },
        rationale:
          outside.length === 0
            ? `All ${evidence.entries.length} entries fall within ${evidence.period.start} to ${evidence.period.end}.`
            : `${outside.length} entries are posted outside the audit period.`,
        ...(outside.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Revenue posted outside the audit period",
                description: `${outside.length} entries are misclassified by period.`,
                recommendedAction: "Reclassify the entries into the correct period.",
              },
            }),
      };
    },
  },
  {
    controlId: "AMT-REC-09",
    name: "Amount reconciliation",
    description: "The sum of tested entries agrees with the ledger's stated material total.",
    category: "reconciliation",
    artifactIds: [ART_LEDGER],
    evaluate: ({ evidence }) => {
      const computed = evidence.entries.reduce((sum, e) => sum + e.amountUsd, 0);
      const difference = computed - evidence.statedMaterialTotalUsd;
      return {
        status: difference === 0 ? "pass" : "exception",
        observed: {
          computed_total_usd: computed,
          stated_total_usd: evidence.statedMaterialTotalUsd,
          difference_usd: difference,
        },
        rationale:
          difference === 0
            ? `Tested entries total ${money(computed)}, agreeing exactly with the ledger's stated material total.`
            : `Tested entries total ${money(computed)} against a stated ${money(evidence.statedMaterialTotalUsd)}, a difference of ${money(difference)}.`,
        ...(difference === 0
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Ledger does not reconcile",
                description: `The tested entries differ from the stated total by ${money(difference)}.`,
                recommendedAction: "Investigate the unreconciled difference before sign-off.",
                amountUsd: Math.abs(difference),
              },
            }),
      };
    },
  },
  {
    controlId: "SEG-DUT-10",
    name: "Segregation of duties",
    description: "No entry is both posted and approved by the same person.",
    category: "segregation",
    artifactIds: [ART_LEDGER, ART_POLICY],
    evaluate: ({ evidence }) => {
      if (!evidence.policy.segregationRequired) {
        return {
          status: "pass",
          observed: { segregation_required: false },
          rationale: "Policy does not require segregation for this entity.",
        };
      }

      const conflicts = evidence.entries.flatMap((entry) => {
        const approval = evidence.approvals.find((a) => a.approvalId === entry.approvalId);
        if (!approval || approval.approvedBy !== entry.postedBy) return [];
        return [{ entry, user: approval.approvedBy }];
      });

      if (conflicts.length === 0) {
        return {
          status: "pass",
          observed: { entries_tested: evidence.entries.length, self_approved: 0 },
          rationale: "Every entry was approved by someone other than the person who posted it.",
        };
      }

      const first = conflicts[0]!;
      const person = evidence.approvers.find((p) => p.userId === first.user);
      return {
        status: "exception",
        observed: {
          entries_tested: evidence.entries.length,
          self_approved: conflicts.length,
          entry_ids: conflicts.map((c) => c.entry.entryId),
          user: person?.name ?? first.user,
          role: person?.role ?? "unknown",
          amount_usd: first.entry.amountUsd,
        },
        rationale:
          `Entry ${first.entry.entryId} for ${money(first.entry.amountUsd)} was both posted and ` +
          `approved by ${person?.name ?? first.user} (${person?.role ?? "unknown role"}), which ` +
          `policy ${evidence.policy.policyId} prohibits.`,
        finding: {
          severity: "medium",
          title: "Revenue entry posted and approved by the same person",
          description:
            `${conflicts.length} entry breaches segregation of duties: ${first.entry.entryId} ` +
            `(${money(first.entry.amountUsd)}) was self-approved by ${person?.name ?? first.user}.`,
          recommendedAction:
            "Route the entry for independent approval and restrict self-approval in the ledger.",
          amountUsd: first.entry.amountUsd,
        },
      };
    },
  },
  {
    controlId: "EXC-HND-11",
    name: "Exception handling",
    description: "Prior-period exceptions each carry a documented remediation.",
    category: "follow-up",
    artifactIds: [ART_POLICY],
    evaluate: ({ evidence }) => {
      const unremediated = evidence.priorExceptions.filter((e) => e.remediation === null);
      return {
        status: unremediated.length === 0 ? "pass" : "exception",
        observed: {
          prior_exceptions: evidence.priorExceptions.length,
          unremediated: unremediated.length,
        },
        rationale:
          unremediated.length === 0
            ? `All ${evidence.priorExceptions.length} prior-period exceptions have a documented remediation.`
            : `${unremediated.length} prior exceptions have no documented remediation.`,
        ...(unremediated.length === 0
          ? {}
          : {
              finding: {
                severity: "low" as const,
                title: "Prior exceptions without documented remediation",
                description: `${unremediated.length} prior exceptions remain unremediated.`,
                recommendedAction: "Document the remediation or carry the exception forward.",
              },
            }),
      };
    },
  },
  {
    controlId: "EVD-COMP-12",
    name: "Evidence completeness",
    description: "Every reference in the ledger resolves to evidence held in scope.",
    category: "completeness",
    artifactIds: [ART_LEDGER, ART_C1001, ART_C1002, ART_POLICY],
    evaluate: ({ evidence }) => {
      const dangling = evidence.entries.filter(
        (entry) =>
          !evidence.contracts.some((c) => c.contractId === entry.contractId) ||
          milestoneOf(evidence, entry) === undefined ||
          !evidence.invoices.some((i) => i.invoiceId === entry.invoiceId) ||
          !evidence.approvals.some((a) => a.approvalId === entry.approvalId),
      );
      return {
        status: dangling.length === 0 ? "pass" : "exception",
        observed: {
          entries_tested: evidence.entries.length,
          dangling_references: dangling.length,
          artifacts_in_scope: 4,
        },
        rationale:
          dangling.length === 0
            ? "Every contract, milestone, invoice, and approval referenced by the ledger is present in scope."
            : `${dangling.length} entries reference evidence that is not in scope.`,
        ...(dangling.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Ledger references evidence not held in scope",
                description: `${dangling.length} entries cite missing evidence.`,
                recommendedAction: "Obtain the missing evidence before concluding.",
              },
            }),
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Artifacts
// ─────────────────────────────────────────────────────────────────────────────

function ledgerText(): string {
  const rows = ENTRIES.map(
    (e) =>
      `${e.entryId}  ${e.postedOn}  ${e.contractId}/${e.milestoneId}  ` +
      `${String(e.amountUsd).padStart(9)}  ${e.invoiceId}  ${e.approvalId}  posted_by=${e.postedBy}`,
  ).join("\n");
  return [
    "Q3 REVENUE LEDGER EXTRACT — material items",
    `period: ${EVIDENCE.period.start} to ${EVIDENCE.period.end}`,
    `rows in full ledger: ${EVIDENCE.ledgerRowsTotal}`,
    `materiality threshold: ${money(EVIDENCE.materialityUsd)}`,
    `stated material total: ${money(EVIDENCE.statedMaterialTotalUsd)}`,
    "",
    "entry      posted_on   contract  amount_usd  invoice    approval   posted_by",
    rows,
  ].join("\n");
}

function contractText(contract: Contract): string {
  return [
    `CUSTOMER CONTRACT ${contract.contractId} — ${contract.customer}`,
    `signed: ${contract.signedOn}   total: ${money(contract.totalUsd)}`,
    "",
    "milestone  value_usd   due_on      delivered_on  description",
    ...contract.milestones.map(
      (m) =>
        `${m.milestoneId.padEnd(9)}  ${String(m.valueUsd).padStart(9)}  ${m.dueOn}  ` +
        `${(m.deliveredOn ?? "NOT DELIVERED").padEnd(13)} ${m.description}`,
    ),
  ].join("\n");
}

const ARTIFACTS: Artifact[] = [
  {
    artifactId: ART_LEDGER,
    kind: "revenue_ledger",
    title: "Q3 Revenue Ledger Extract",
    mimeType: "text/plain",
    rows: EVIDENCE.ledgerRowsTotal,
    content: ledgerText(),
    parsed: {
      rows_total: EVIDENCE.ledgerRowsTotal,
      material_entries: ENTRIES.length,
      materiality_usd: EVIDENCE.materialityUsd,
      material_total_usd: EVIDENCE.statedMaterialTotalUsd,
      contracts_referenced: [...new Set(ENTRIES.map((e) => e.contractId))].sort(),
    },
  },
  {
    artifactId: ART_C1001,
    kind: "contract",
    title: "Customer Contract C-1001 — Northwind Logistics",
    mimeType: "text/plain",
    rows: null,
    content: contractText(CONTRACTS[0]!),
    parsed: {
      contract_id: "C-1001",
      total_usd: 2_400_000,
      milestones: 3,
      undelivered_milestones: ["M2"],
    },
  },
  {
    artifactId: ART_C1002,
    kind: "contract",
    title: "Customer Contract C-1002 — Meridian Health Group",
    mimeType: "text/plain",
    rows: null,
    content: contractText(CONTRACTS[1]!),
    parsed: {
      contract_id: "C-1002",
      total_usd: 1_500_000,
      milestones: 3,
      undelivered_milestones: [],
    },
  },
  {
    artifactId: ART_POLICY,
    kind: "policy",
    title: "Revenue Recognition Policy REV-POL-3",
    mimeType: "text/plain",
    rows: null,
    content: [
      "REVENUE RECOGNITION POLICY REV-POL-3",
      "",
      "3.1 " + EVIDENCE.policy.rule,
      "3.2 Delivery is evidenced by a recorded delivery date against the contract milestone.",
      "3.3 Approval authority is delegated by the approval matrix and may not be exceeded.",
      "3.4 The person posting a revenue entry may not also approve it.",
    ].join("\n"),
    parsed: {
      policy_id: EVIDENCE.policy.policyId,
      clauses: 4,
      segregation_required: EVIDENCE.policy.segregationRequired,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Scenario
// ─────────────────────────────────────────────────────────────────────────────

export const financialScenario: AuditScenario<FinancialEvidence> = {
  scenarioId: "financial",
  displayName: "Financial Audit",
  description:
    "Revenue recognition testing over a quarter of material ledger entries, their " +
    "contracts, invoices, and approvals.",
  isHero: true,

  auditId: "AUD-FIN-2026-09",
  executionId: "EXEC-FIN-2026-09-001",
  eventCode: "FIN-2609",
  title: "September Revenue Recognition Audit",
  period: "2026-Q3",
  openedAt: "2026-09-15T09:00:00.000Z",
  stepMinutes: 7,

  artifacts: ARTIFACTS,
  evidence: EVIDENCE,
  controls: CONTROLS,

  retrieval: {
    query: "revenue recognition performance obligation delivery evidence",
    artifactIds: [ART_LEDGER, ART_C1001, ART_POLICY],
    passages: [
      "REV-POL-3 §3.1: revenue may be recognised only once the related performance obligation has been satisfied.",
      "REV-POL-3 §3.2: delivery is evidenced by a recorded delivery date against the contract milestone.",
      "C-1001 milestone M2 — Regional rollout, phase 2 (12 depots) — due 2026-11-15, delivered: NOT DELIVERED.",
      "C-1001 milestone M1 — Platform provisioning and onboarding — delivered 2026-08-30.",
      "Ledger E-1001 — 2026-09-28 — C-1001/M2 — 1,420,000 — Regional rollout phase 2 revenue recognised.",
      "REV-POL-3 §3.3: approval authority is delegated by the approval matrix and may not be exceeded.",
      "REV-POL-3 §3.4: the person posting a revenue entry may not also approve it.",
    ],
  },

  reasoner: deterministicReasoner({
    name: "veriaudit-reasoner",
    version: "0.1.0",
    assess: (input) => ({
      assessment:
        "Revenue recognition timing assessed against policy REV-POL-3 using " +
        `${input.passages.length} retrieved passages. The largest material entry recognises ` +
        "revenue against a contract milestone with no recorded delivery date, which the policy " +
        "does not permit. Authorisation and segregation evidence also warrant testing.",
      observations: [
        "C-1001 milestone M2 carries no delivery date but has revenue recognised against it.",
        "One entry was approved by a role whose delegated authority is below the amount.",
        "One entry shows the same user as both poster and approver.",
      ],
    }),
  }),

  reviewPolicy: {
    reviewer: { name: "J. Okafor", role: "Senior Manager, Assurance" },
    // Everything reportable goes to a person in the hero audit. `low` would not
    // — it is here to show the policy is a rule, not a rubber stamp.
    requiresReview: ({ severity }) => severity === "high" || severity === "medium",
    decisions: {
      "REV-REC-01": {
        decision: "accepted",
        note:
          "Agreed. Milestone M2 has no delivery evidence and the amount is material. " +
          "Reversal proposed to the CFO for the Q3 close.",
      },
      "APR-CHAIN-06": {
        decision: "accepted",
        note:
          "Confirmed against the approval matrix effective 2026-07-02. CFO ratification requested.",
      },
      "SEG-DUT-10": {
        decision: "modified",
        // Demonstrates a reviewer disagreeing with the AI's severity, which is
        // the point of recording human intervention separately.
        modifiedSeverity: "low",
        note:
          "Breach confirmed, but the amount is just above materiality and a compensating " +
          "month-end review covered it. Severity reduced from medium to low.",
      },
    },
  },

  expected: { controlsTested: 12, controlsPassed: 9, exceptions: 3, findings: 3 },

  searchTags: [
    "revenue recognition",
    "revenue recognition exception",
    "september revenue audit",
    "performance obligation",
    "approval missing",
    "segregation of duties",
    "REV-REC-01",
    "C-1001",
    "Northwind Logistics",
    "2026-Q3",
  ],
};
