/**
 * Scenario-specific inquiry copy for the guided demo.
 *
 * Financial chips stay the default empty-search suggestions so existing
 * SEARCH_SPEC queries are unchanged. Other scenarios get their own chips
 * only after the judge has chosen that engagement.
 */
import type { Scenario } from "@/lib/audit/types";
import { APPROVED_CLAIMS, SUGGESTION_CHIPS } from "./copy";

export interface ScenarioInquiry {
  readonly bossQuestion: string;
  readonly bossQuery: string;
  readonly historyRole: string;
  readonly chips: readonly string[];
}

export const SCENARIO_INQUIRY: Record<Scenario, ScenarioInquiry> = {
  financial: {
    bossQuestion: APPROVED_CLAIMS.bossQuestion,
    bossQuery: APPROVED_CLAIMS.bossQuery,
    historyRole: "A question from the CFO",
    chips: SUGGESTION_CHIPS,
  },
  legal: {
    bossQuestion:
      "Why did we flag this processor agreement? Legal is being asked what the AI actually checked against GDPR obligations.",
    bossQuery: "why did we flag this processor agreement",
    historyRole: "A question from the General Counsel",
    chips: [
      "GDPR processor obligations",
      "retention period",
      "MSA-7741",
      "REG-MAP-01",
    ],
  },
  cyber: {
    bossQuestion:
      "Why did we flag this privileged account? Security needs to know what the AI actually saw in the access export.",
    bossQuery: "why did we flag this privileged account",
    historyRole: "A question from the CISO",
    chips: ["privileged access", "MFA exception", "terminated access", "ACC-MFA-01"],
  },
  procurement: {
    bossQuestion:
      "Why did we flag this vendor invoice? Procurement needs to know whether the order, receipt, and invoice actually matched.",
    bossQuery: "why did we flag this vendor invoice",
    historyRole: "A question from the Chief Procurement Officer",
    chips: [
      "three-way match",
      "vendor invoice variance",
      "unapproved vendor",
      "VEN-APPR-01",
    ],
  },
};

export function scenarioInquiry(scenarioId: Scenario | null): ScenarioInquiry {
  return SCENARIO_INQUIRY[scenarioId ?? "financial"];
}
