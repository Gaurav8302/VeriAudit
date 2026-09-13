/**
 * Procurement / Vendor scenario — 9 controls, 2 exceptions.
 *
 * Includes the one review decision the other scenarios do not: a REJECTED
 * finding, where the reviewer disagrees with the AI outright. The finding is
 * still recorded and still sealed — rejecting a finding is a decision that has
 * to be as auditable as accepting one.
 */
import { deterministicReasoner } from "../reasoner";
import type { Artifact, AuditScenario, Control } from "../types";

interface Vendor {
  readonly vendorId: string;
  readonly name: string;
  /** null = never formally approved. */
  readonly approvedOn: string | null;
  readonly sanctionsCheckedOn: string | null;
  readonly complianceAttestationOn: string | null;
}

interface PurchaseOrder {
  readonly poId: string;
  readonly vendorId: string;
  readonly amountUsd: number;
  readonly raisedOn: string;
  readonly raisedBy: string;
  readonly approvedBy: string;
  readonly contractId: string | null;
}

interface VendorInvoice {
  readonly invoiceId: string;
  readonly poId: string;
  readonly amountUsd: number;
  readonly receivedOn: string;
}

interface GoodsReceipt {
  readonly receiptId: string;
  readonly poId: string;
  readonly amountUsd: number;
  readonly receivedOn: string;
}

export interface ProcurementEvidence {
  readonly asOf: string;
  readonly attestationValidMonths: number;
  readonly vendors: readonly Vendor[];
  readonly purchaseOrders: readonly PurchaseOrder[];
  readonly invoices: readonly VendorInvoice[];
  readonly goodsReceipts: readonly GoodsReceipt[];
  readonly approvers: readonly {
    readonly userId: string;
    readonly name: string;
    readonly role: string;
    readonly authorityUsd: number;
  }[];
  readonly contracts: readonly { readonly contractId: string; readonly vendorId: string }[];
  /** Tolerance on the three-way match, in dollars. */
  readonly matchToleranceUsd: number;
}

const ART_VENDORS = "ART-PRC-001";
const ART_POS = "ART-PRC-002";
const ART_INVOICES = "ART-PRC-003";
const ART_RECEIPTS = "ART-PRC-004";

const VENDORS: Vendor[] = [
  { vendorId: "V-501", name: "Cobalt Industrial Supply", approvedOn: "2026-02-11", sanctionsCheckedOn: "2026-07-01", complianceAttestationOn: "2026-06-15" },
  { vendorId: "V-502", name: "Aster Facilities Ltd", approvedOn: "2026-03-30", sanctionsCheckedOn: "2026-07-01", complianceAttestationOn: "2026-05-20" },
  // Never approved, yet a purchase order was raised against it.
  { vendorId: "V-503", name: "Pinehurst Consulting", approvedOn: null, sanctionsCheckedOn: "2026-07-01", complianceAttestationOn: "2026-08-02" },
];

const PURCHASE_ORDERS: PurchaseOrder[] = [
  { poId: "PO-9001", vendorId: "V-501", amountUsd: 148_000, raisedOn: "2026-07-08", raisedBy: "b.ortiz", approvedBy: "h.lindqvist", contractId: "VC-301" },
  { poId: "PO-9002", vendorId: "V-502", amountUsd: 62_500, raisedOn: "2026-08-02", raisedBy: "b.ortiz", approvedBy: "g.tanaka", contractId: "VC-302" },
  { poId: "PO-9003", vendorId: "V-503", amountUsd: 91_000, raisedOn: "2026-08-21", raisedBy: "f.duarte", approvedBy: "h.lindqvist", contractId: "VC-303" },
  { poId: "PO-9004", vendorId: "V-501", amountUsd: 34_200, raisedOn: "2026-09-09", raisedBy: "f.duarte", approvedBy: "g.tanaka", contractId: "VC-301" },
];

const INVOICES: VendorInvoice[] = [
  { invoiceId: "VINV-4001", poId: "PO-9001", amountUsd: 148_000, receivedOn: "2026-07-29" },
  { invoiceId: "VINV-4002", poId: "PO-9002", amountUsd: 62_500, receivedOn: "2026-08-24" },
  // Invoiced above the purchase order and goods receipt — the three-way match exception.
  { invoiceId: "VINV-4003", poId: "PO-9003", amountUsd: 109_400, receivedOn: "2026-09-12" },
  { invoiceId: "VINV-4004", poId: "PO-9004", amountUsd: 34_200, receivedOn: "2026-09-26" },
];

const GOODS_RECEIPTS: GoodsReceipt[] = [
  { receiptId: "GR-7001", poId: "PO-9001", amountUsd: 148_000, receivedOn: "2026-07-22" },
  { receiptId: "GR-7002", poId: "PO-9002", amountUsd: 62_500, receivedOn: "2026-08-18" },
  { receiptId: "GR-7003", poId: "PO-9003", amountUsd: 91_000, receivedOn: "2026-09-04" },
  { receiptId: "GR-7004", poId: "PO-9004", amountUsd: 34_200, receivedOn: "2026-09-20" },
];

const EVIDENCE: ProcurementEvidence = {
  asOf: "2026-09-30",
  attestationValidMonths: 12,
  vendors: VENDORS,
  purchaseOrders: PURCHASE_ORDERS,
  invoices: INVOICES,
  goodsReceipts: GOODS_RECEIPTS,
  approvers: [
    { userId: "h.lindqvist", name: "H. Lindqvist", role: "Director of Procurement", authorityUsd: 250_000 },
    { userId: "g.tanaka", name: "G. Tanaka", role: "Procurement Manager", authorityUsd: 100_000 },
  ],
  contracts: [
    { contractId: "VC-301", vendorId: "V-501" },
    { contractId: "VC-302", vendorId: "V-502" },
    { contractId: "VC-303", vendorId: "V-503" },
  ],
  matchToleranceUsd: 0,
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

const monthsBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / (30.44 * 86_400_000));

const CONTROLS: Control<ProcurementEvidence>[] = [
  {
    controlId: "VEN-APPR-01",
    name: "Vendor approved before purchase",
    description: "Every purchase order is raised against a formally approved vendor.",
    category: "vendor onboarding",
    artifactIds: [ART_VENDORS, ART_POS],
    evaluate: ({ evidence }) => {
      const offending = evidence.purchaseOrders.flatMap((po) => {
        const vendor = evidence.vendors.find((v) => v.vendorId === po.vendorId);
        if (!vendor) return [];
        if (vendor.approvedOn !== null && vendor.approvedOn <= po.raisedOn) return [];
        return [{ po, vendor }];
      });

      if (offending.length === 0) {
        return {
          status: "pass",
          observed: { purchase_orders: evidence.purchaseOrders.length, unapproved_vendor_pos: 0 },
          rationale: "Every purchase order was raised against a vendor approved before the order date.",
        };
      }

      const first = offending[0]!;
      const total = offending.reduce((sum, o) => sum + o.po.amountUsd, 0);
      return {
        status: "exception",
        observed: {
          purchase_orders: evidence.purchaseOrders.length,
          unapproved_vendor_pos: offending.length,
          po_ids: offending.map((o) => o.po.poId),
          vendor_id: first.vendor.vendorId,
          vendor_approved_on: first.vendor.approvedOn,
          amount_usd: total,
        },
        rationale:
          `${first.po.poId} for ${money(first.po.amountUsd)} was raised on ${first.po.raisedOn} ` +
          `against ${first.vendor.name} (${first.vendor.vendorId}), which has no recorded vendor ` +
          "approval date. Commitment was made before onboarding completed.",
        finding: {
          severity: "high",
          title: "Purchase order raised against an unapproved vendor",
          description:
            `${money(total)} committed to ${first.vendor.name} (${first.vendor.vendorId}) with no ` +
            "vendor approval on record.",
          recommendedAction: "Complete vendor onboarding retrospectively or cancel the commitment.",
          amountUsd: total,
        },
      };
    },
  },
  {
    controlId: "PO-MATCH-02",
    name: "Three-way match",
    description: "Purchase order, goods receipt, and invoice amounts agree within tolerance.",
    category: "reconciliation",
    artifactIds: [ART_POS, ART_INVOICES, ART_RECEIPTS],
    evaluate: ({ evidence }) => {
      const mismatches = evidence.invoices.flatMap((invoice) => {
        const po = evidence.purchaseOrders.find((p) => p.poId === invoice.poId);
        const receipt = evidence.goodsReceipts.find((g) => g.poId === invoice.poId);
        if (!po || !receipt) return [];
        const invoiceVsPo = invoice.amountUsd - po.amountUsd;
        const invoiceVsReceipt = invoice.amountUsd - receipt.amountUsd;
        if (
          invoiceVsPo <= evidence.matchToleranceUsd &&
          invoiceVsReceipt <= evidence.matchToleranceUsd
        ) {
          return [];
        }
        return [{ invoice, po, receipt, invoiceVsPo, invoiceVsReceipt }];
      });

      if (mismatches.length === 0) {
        return {
          status: "pass",
          observed: {
            invoices: evidence.invoices.length,
            goods_receipts: evidence.goodsReceipts.length,
            mismatched: 0,
            tolerance_usd: evidence.matchToleranceUsd,
          },
          rationale: `All ${evidence.invoices.length} invoices match the purchase order and goods receipt within tolerance.`,
        };
      }

      const first = mismatches[0]!;
      return {
        status: "exception",
        observed: {
          invoices: evidence.invoices.length,
          goods_receipts: evidence.goodsReceipts.length,
          mismatched: mismatches.length,
          invoice_ids: mismatches.map((o) => o.invoice.invoiceId),
          po_amount_usd: first.po.amountUsd,
          receipt_amount_usd: first.receipt.amountUsd,
          invoice_amount_usd: first.invoice.amountUsd,
          variance_usd: first.invoiceVsPo,
        },
        rationale:
          `${first.invoice.invoiceId} bills ${money(first.invoice.amountUsd)} against ` +
          `${first.po.poId} (${money(first.po.amountUsd)}) and ${first.receipt.receiptId} ` +
          `(${money(first.receipt.amountUsd)}), a variance of ${money(first.invoiceVsPo)} ` +
          "with no approved change order.",
        finding: {
          severity: "medium",
          title: "Vendor invoice exceeds the purchase order and goods receipt",
          description:
            `${first.invoice.invoiceId} exceeds ${first.po.poId} and ${first.receipt.receiptId} ` +
            `by ${money(first.invoiceVsPo)} ` +
            `(${Math.round((first.invoiceVsPo / first.po.amountUsd) * 100)}%).`,
          recommendedAction: "Withhold payment of the variance pending an approved change order.",
          amountUsd: first.invoiceVsPo,
        },
      };
    },
  },
  {
    controlId: "VEN-SANC-03",
    name: "Sanctions screening",
    description: "Every vendor in use has been sanctions-screened.",
    category: "vendor compliance",
    artifactIds: [ART_VENDORS],
    evaluate: ({ evidence }) => {
      const unscreened = evidence.vendors.filter((v) => v.sanctionsCheckedOn === null);
      return {
        status: unscreened.length === 0 ? "pass" : "exception",
        observed: { vendors: evidence.vendors.length, unscreened: unscreened.length },
        rationale:
          unscreened.length === 0
            ? `All ${evidence.vendors.length} vendors have a recorded sanctions screening.`
            : `${unscreened.length} vendors have never been sanctions-screened.`,
        ...(unscreened.length === 0
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Vendors in use without sanctions screening",
                description: `${unscreened.length} vendors have no screening on record.`,
                recommendedAction: "Screen the vendors before the next payment run.",
              },
            }),
      };
    },
  },
  {
    controlId: "VEN-COMP-04",
    name: "Vendor compliance attestation current",
    description: "Every vendor's compliance attestation is inside its validity window.",
    category: "vendor compliance",
    artifactIds: [ART_VENDORS],
    evaluate: ({ evidence }) => {
      const expired = evidence.vendors.filter(
        (v) =>
          v.complianceAttestationOn === null ||
          monthsBetween(v.complianceAttestationOn, evidence.asOf) > evidence.attestationValidMonths,
      );
      return {
        status: expired.length === 0 ? "pass" : "exception",
        observed: {
          vendors: evidence.vendors.length,
          expired: expired.length,
          validity_months: evidence.attestationValidMonths,
        },
        rationale:
          expired.length === 0
            ? `All ${evidence.vendors.length} attestations are within the ${evidence.attestationValidMonths}-month validity window.`
            : `${expired.length} vendor attestations are missing or expired.`,
        ...(expired.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Vendor compliance attestations expired",
                description: `${expired.length} vendors have no current attestation.`,
                recommendedAction: "Request refreshed attestations.",
              },
            }),
      };
    },
  },
  {
    controlId: "PO-AUTH-05",
    name: "Purchase order authority",
    description: "Every purchase order was approved within the approver's delegated authority.",
    category: "authorisation",
    artifactIds: [ART_POS],
    evaluate: ({ evidence }) => {
      const exceeded = evidence.purchaseOrders.flatMap((po) => {
        const approver = evidence.approvers.find((a) => a.userId === po.approvedBy);
        if (!approver || po.amountUsd <= approver.authorityUsd) return [];
        return [{ po, approver }];
      });
      return {
        status: exceeded.length === 0 ? "pass" : "exception",
        observed: { purchase_orders: evidence.purchaseOrders.length, above_authority: exceeded.length },
        rationale:
          exceeded.length === 0
            ? "Every purchase order approval sits within the approver's delegated authority."
            : `${exceeded.length} purchase orders were approved above the approver's authority.`,
        ...(exceeded.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Purchase order approved above delegated authority",
                description: `${exceeded.length} orders breach the approval matrix.`,
                recommendedAction: "Obtain ratification at the correct level.",
              },
            }),
      };
    },
  },
  {
    controlId: "PO-CON-06",
    name: "Contract coverage",
    description: "Every purchase order is covered by a contract with the same vendor.",
    category: "contract",
    artifactIds: [ART_POS, ART_VENDORS],
    evaluate: ({ evidence }) => {
      const uncovered = evidence.purchaseOrders.filter((po) => {
        if (po.contractId === null) return true;
        const contract = evidence.contracts.find((c) => c.contractId === po.contractId);
        return contract === undefined || contract.vendorId !== po.vendorId;
      });
      return {
        status: uncovered.length === 0 ? "pass" : "exception",
        observed: { purchase_orders: evidence.purchaseOrders.length, uncovered: uncovered.length },
        rationale:
          uncovered.length === 0
            ? "Every purchase order cites a contract held with the same vendor."
            : `${uncovered.length} purchase orders have no matching vendor contract.`,
        ...(uncovered.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Purchase orders without contract coverage",
                description: `${uncovered.length} orders are not covered by a vendor contract.`,
                recommendedAction: "Execute a contract or cancel the orders.",
              },
            }),
      };
    },
  },
  {
    controlId: "DUP-INV-07",
    name: "Duplicate invoice detection",
    description: "No two invoices bill the same purchase order for the same amount.",
    category: "data integrity",
    artifactIds: [ART_INVOICES],
    evaluate: ({ evidence }) => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const invoice of evidence.invoices) {
        const key = `${invoice.poId}|${invoice.amountUsd}`;
        const prior = seen.get(key);
        if (prior) duplicates.push(`${prior}/${invoice.invoiceId}`);
        else seen.set(key, invoice.invoiceId);
      }
      return {
        status: duplicates.length === 0 ? "pass" : "exception",
        observed: { invoices: evidence.invoices.length, duplicate_pairs: duplicates.length },
        rationale:
          duplicates.length === 0
            ? "No duplicate vendor invoices detected."
            : `${duplicates.length} duplicate invoice pairs detected: ${duplicates.join(", ")}.`,
        ...(duplicates.length === 0
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Duplicate vendor invoices detected",
                description: `${duplicates.length} pairs of invoices appear to be duplicates.`,
                recommendedAction: "Block payment and recover any duplicate settlement.",
              },
            }),
      };
    },
  },
  {
    controlId: "SEG-PO-08",
    name: "Segregation of purchasing duties",
    description: "No purchase order is both raised and approved by the same person.",
    category: "segregation",
    artifactIds: [ART_POS],
    evaluate: ({ evidence }) => {
      const conflicts = evidence.purchaseOrders.filter((po) => po.raisedBy === po.approvedBy);
      return {
        status: conflicts.length === 0 ? "pass" : "exception",
        observed: { purchase_orders: evidence.purchaseOrders.length, self_approved: conflicts.length },
        rationale:
          conflicts.length === 0
            ? "Every purchase order was approved by someone other than the person who raised it."
            : `${conflicts.length} purchase orders were self-approved.`,
        ...(conflicts.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Self-approved purchase orders",
                description: `${conflicts.length} orders breach segregation of duties.`,
                recommendedAction: "Route for independent approval and restrict self-approval.",
              },
            }),
      };
    },
  },
  {
    controlId: "EVD-COMP-09",
    name: "Evidence completeness",
    description: "Every invoice and purchase order resolves to evidence held in scope.",
    category: "completeness",
    artifactIds: [ART_VENDORS, ART_POS, ART_INVOICES, ART_RECEIPTS],
    evaluate: ({ evidence }) => {
      const dangling = [
        ...evidence.invoices.filter((i) => !evidence.purchaseOrders.some((p) => p.poId === i.poId)),
        ...evidence.goodsReceipts.filter((g) => !evidence.purchaseOrders.some((p) => p.poId === g.poId)),
        ...evidence.purchaseOrders.filter((p) => !evidence.vendors.some((v) => v.vendorId === p.vendorId)),
      ];
      return {
        status: dangling.length === 0 ? "pass" : "exception",
        observed: {
          invoices: evidence.invoices.length,
          purchase_orders: evidence.purchaseOrders.length,
          dangling_references: dangling.length,
          artifacts_in_scope: 4,
        },
        rationale:
          dangling.length === 0
            ? "Every invoice traces to a purchase order and every order to a vendor held in scope."
            : `${dangling.length} records reference evidence that is not in scope.`,
        ...(dangling.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Procurement records reference evidence not held in scope",
                description: `${dangling.length} records cite missing evidence.`,
                recommendedAction: "Obtain the missing evidence before concluding.",
              },
            }),
      };
    },
  },
];

const ARTIFACTS: Artifact[] = [
  {
    artifactId: ART_VENDORS,
    kind: "vendor_file",
    title: "Approved Vendor Master File",
    mimeType: "text/plain",
    rows: VENDORS.length,
    content: [
      "APPROVED VENDOR MASTER FILE",
      `as_of: ${EVIDENCE.asOf}`,
      "",
      "vendor_id  approved_on   sanctions_checked  attestation  name",
      ...VENDORS.map(
        (v) =>
          `${v.vendorId.padEnd(10)} ${(v.approvedOn ?? "NOT APPROVED").padEnd(13)} ` +
          `${(v.sanctionsCheckedOn ?? "NONE").padEnd(18)} ${(v.complianceAttestationOn ?? "NONE").padEnd(12)} ${v.name}`,
      ),
    ].join("\n"),
    parsed: {
      vendors: VENDORS.length,
      unapproved: VENDORS.filter((v) => v.approvedOn === null).map((v) => v.vendorId),
    },
  },
  {
    artifactId: ART_POS,
    kind: "register",
    title: "Purchase Order Register",
    mimeType: "text/plain",
    rows: PURCHASE_ORDERS.length,
    content: [
      "PURCHASE ORDER REGISTER",
      "",
      "po_id     vendor  amount_usd  raised_on   raised_by   approved_by   contract",
      ...PURCHASE_ORDERS.map(
        (p) =>
          `${p.poId.padEnd(9)} ${p.vendorId.padEnd(7)} ${String(p.amountUsd).padStart(10)}  ` +
          `${p.raisedOn}  ${p.raisedBy.padEnd(11)} ${p.approvedBy.padEnd(13)} ${p.contractId ?? "NONE"}`,
      ),
    ].join("\n"),
    parsed: {
      purchase_orders: PURCHASE_ORDERS.length,
      total_usd: PURCHASE_ORDERS.reduce((s, p) => s + p.amountUsd, 0),
    },
  },
  {
    artifactId: ART_INVOICES,
    kind: "register",
    title: "Vendor Invoice Register",
    mimeType: "text/plain",
    rows: INVOICES.length,
    content: [
      "VENDOR INVOICE REGISTER",
      "",
      "invoice_id   po_id     amount_usd  received_on",
      ...INVOICES.map(
        (i) => `${i.invoiceId.padEnd(12)} ${i.poId.padEnd(9)} ${String(i.amountUsd).padStart(10)}  ${i.receivedOn}`,
      ),
    ].join("\n"),
    parsed: {
      invoices: INVOICES.length,
      total_usd: INVOICES.reduce((s, i) => s + i.amountUsd, 0),
    },
  },
  {
    artifactId: ART_RECEIPTS,
    kind: "goods_receipt",
    title: "Goods Receipt Register",
    mimeType: "text/plain",
    rows: GOODS_RECEIPTS.length,
    content: [
      "GOODS RECEIPT REGISTER",
      "",
      "receipt_id  po_id     amount_usd  received_on",
      ...GOODS_RECEIPTS.map(
        (g) => `${g.receiptId.padEnd(12)} ${g.poId.padEnd(9)} ${String(g.amountUsd).padStart(10)}  ${g.receivedOn}`,
      ),
    ].join("\n"),
    parsed: {
      goods_receipts: GOODS_RECEIPTS.length,
      total_usd: GOODS_RECEIPTS.reduce((s, g) => s + g.amountUsd, 0),
      unmatched_invoice: "VINV-4003 vs GR-7003",
    },
  },
];

export const procurementScenario: AuditScenario<ProcurementEvidence> = {
  scenarioId: "procurement",
  displayName: "Procurement / Vendor Audit",
  description:
    "Checks whether what the company ordered, received, and paid for actually matches — " +
    "vendor approval, purchase orders, goods receipts, and invoices.",
  isHero: false,

  auditId: "AUD-PRC-2026-09",
  executionId: "EXEC-PRC-2026-09-001",
  eventCode: "PRC-2609",
  title: "Vendor Onboarding and Three-Way Match Review",
  period: "2026-Q3",
  openedAt: "2026-09-29T11:15:00.000Z",
  stepMinutes: 6,

  artifacts: ARTIFACTS,
  evidence: EVIDENCE,
  controls: CONTROLS,

  retrieval: {
    query: "vendor approval purchase order invoice goods receipt three-way match variance",
    artifactIds: [ART_VENDORS, ART_POS, ART_INVOICES, ART_RECEIPTS],
    passages: [
      "Vendor master: V-503 Pinehurst Consulting — approved_on: NOT APPROVED.",
      "Purchase order PO-9003 — V-503 — 91,000 — raised 2026-08-21.",
      "Goods receipt GR-7003 — PO-9003 — 91,000 — received 2026-09-04.",
      "Vendor invoice VINV-4003 — PO-9003 — 109,400 — received 2026-09-12. Invoice variance.",
      "Approval matrix: h.lindqvist authority 250,000; g.tanaka authority 100,000.",
    ],
  },

  reasoner: deterministicReasoner({
    name: "veriaudit-reasoner",
    version: "0.1.0",
    assess: (input) => ({
      assessment:
        `Vendor and purchase evidence reviewed across ${input.passages.length} retrieved passages. ` +
        "One purchase order was raised against a vendor with no approval on record, and one invoice " +
        "bills above both its purchase order and goods receipt with no change order evidenced.",
      observations: [
        "PO-9003 was raised against V-503, which has no vendor approval date.",
        "VINV-4003 bills 109,400 against a 91,000 purchase order and a 91,000 goods receipt.",
      ],
    }),
  }),

  reviewPolicy: {
    reviewer: { name: "S. Varga", role: "Procurement Compliance Lead" },
    requiresReview: ({ severity }) => severity === "high" || severity === "medium",
    decisions: {
      "VEN-APPR-01": {
        decision: "accepted",
        note: "Confirmed. V-503 was engaged under an emergency exception that was never ratified; onboarding now in progress.",
      },
      "PO-MATCH-02": {
        // The reviewer overrules the AI. Recorded and sealed like any other
        // decision, because a rejection is a decision.
        decision: "rejected",
        note:
          "Rejected. An approved change order for the 18,400 variance exists outside the evidence " +
          "set provided to the engine (CO-88 approved 2026-09-05). The invoice is correct.",
      },
    },
  },

  expected: { controlsTested: 9, controlsPassed: 7, exceptions: 2, findings: 2 },

  searchTags: [
    "vendor approval",
    "three-way match",
    "purchase order variance",
    "vendor invoice variance",
    "goods receipt",
    "unapproved vendor",
    "procurement exception",
    "VEN-APPR-01",
    "PO-9003",
    "VINV-4003",
  ],
};
