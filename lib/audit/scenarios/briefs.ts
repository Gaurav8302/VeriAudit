/**
 * Judge-facing briefing for each live scenario.
 *
 * Lives next to the engine data so the catalogue, the demo cards, and the
 * product copy cannot drift into four different stories.
 */
import type { Scenario } from "../types";

export interface ScenarioBriefing {
  readonly domain: string;
  readonly oneLine: string;
  readonly what: string;
  readonly checking: string;
  readonly humanCares: string;
  readonly context: string;
}

export const SCENARIO_BRIEFINGS: Record<Scenario, ScenarioBriefing> = {
  financial: {
    domain: "Financial",
    oneLine: "Did the company recognise revenue only after it actually delivered the work?",
    what: "A quarter of material revenue entries, the contracts behind them, and the policy that says when revenue may be booked.",
    checking:
      "The AI is checking whether booked revenue matches delivered milestones, approvals, and the revenue policy.",
    humanCares:
      "A human auditor cares that revenue was not booked early, that approvals stayed inside authority, and that the same person did not post and approve an entry.",
    context: "Recommended reference path. 12 controls over ledger, contracts, and policy.",
  },
  legal: {
    domain: "Legal / compliance",
    oneLine: "When personal data is sent to a processor, are the agreed obligations actually in place?",
    what: "A processor agreement, the register of subprocessors, and the retention / breach policy that should implement it.",
    checking:
      "The AI is checking whether the contract covers the obligations the company accepted, and whether retention and disclosure match that contract.",
    humanCares:
      "A human auditor cares that missing clauses, short retention, or undisclosed subprocessors are visible before the next processing cycle.",
    context: "8 controls over processor obligations, subprocessors, and retention.",
  },
  cyber: {
    domain: "Cybersecurity",
    oneLine: "Do people with powerful system access actually have the access they should have?",
    what: "A privileged-account export, the MFA and logging baseline, and the latest access review.",
    checking:
      "The AI is checking privileged accounts, multi-factor authentication, joiner-mover-leaver revocation, and configuration policy.",
    humanCares:
      "A human auditor cares that unused or leftover privileged access, missing MFA, and overdue reviews cannot hide in the export.",
    context: "10 controls over privileged access, MFA, and configuration.",
  },
  procurement: {
    domain: "Procurement",
    oneLine: "Did what the company ordered, received, and paid for actually match?",
    what: "Vendor approvals, purchase orders, goods receipts, and vendor invoices for the same period.",
    checking:
      "The AI is checking vendor onboarding, authorisation, and the three-way match between order, receipt, and invoice.",
    humanCares:
      "A human auditor cares that money was not committed to an unapproved vendor and that invoice amounts did not silently exceed what was ordered and received.",
    context: "9 controls over vendor onboarding and three-way match.",
  },
};

export function scenarioBriefing(scenarioId: Scenario): ScenarioBriefing {
  return SCENARIO_BRIEFINGS[scenarioId];
}
