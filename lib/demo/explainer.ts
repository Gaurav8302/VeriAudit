import type { Scenario } from "@/lib/audit/types";
import { SCENARIO_BRIEFINGS } from "@/lib/audit/scenarios/briefs";

export interface ExplainerCopy {
  readonly title: string;
  readonly body: string;
}

export type ExplainerTopic =
  | "welcome"
  | "scenario_select"
  | "running"
  | "result"
  | "simulate_ready"
  | "simulating"
  | "history"
  | "investigation"
  | "search_results"
  | "reconstruction"
  | "trail"
  | "trail-evidence"
  | "trail-finding"
  | "trail-review"
  | "trail-conclusion"
  | "verification"
  | "rework"
  | "tamper"
  | "tamper-failed"
  | "complete";

const COPY: Record<ExplainerTopic, ExplainerCopy> = {
  welcome: {
    title: "What is VeriAudit?",
    body:
      "VeriAudit records important AI-assisted work so that months later you can find out what happened, why a decision was made, and whether the historical record still matches what was originally recorded.",
  },
  scenario_select: {
    title: "Why are we starting with an audit?",
    body:
      "This example shows AI helping with a financial audit. The same idea can apply anywhere AI makes decisions that people may later need to explain.",
  },
  running: {
    title: "What is happening?",
    body:
      "The AI is checking the audit data, retrieving relevant information, testing controls, identifying exceptions, and producing a result for a human to review.",
  },
  result: {
    title: "What does this result mean?",
    body:
      "The AI checked the available information and found items that need attention. The important part is that the work behind this result is also recorded.",
  },
  simulate_ready: {
    title: "Why did we jump forward?",
    body:
      "In a real organization, hundreds of AI conversations and tasks can happen after an audit. The original work can quickly become difficult to find.",
  },
  simulating: {
    title: "Why did we jump forward?",
    body:
      "In a real organization, hundreds of AI conversations and tasks can happen after an audit. The original work can quickly become difficult to find.",
  },
  history: {
    title: "What is the problem?",
    body:
      "The audit we care about happened months ago and is now buried among many other activities. Someone still needs to be able to find the exact work that produced the original decision.",
  },
  investigation: {
    title: "What is VeriAudit finding?",
    body:
      "You may not remember the exact name of an old AI conversation. You can search for what you remember about the work and find the original execution.",
  },
  search_results: {
    title: "What is VeriAudit finding?",
    body:
      "You may not remember the exact name of an old AI conversation. You can search for what you remember about the work and find the original execution.",
  },
  reconstruction: {
    title: "What does reconstruction mean?",
    body:
      "We found the original execution and are rebuilding the story of what happened: what information was used, what the AI did, what it found, and what the human decided.",
  },
  trail: {
    title: "What is this trail?",
    body:
      "Think of this as a flight recorder for AI work. This is a simplified view of the recorded execution. Thirty events were recorded. The nine stages shown here form the main causal spine so you can understand how the final decision was reached. The purpose is to answer “why?” months later.",
  },
  "trail-evidence": {
    title: "What is evidence?",
    body:
      "These are the documents or data items involved in the AI’s analysis. The trail shows how they relate to the work that produced the finding.",
  },
  "trail-finding": {
    title: "What is a finding?",
    body:
      "A finding is something discovered during the audit that requires attention or review.",
  },
  "trail-review": {
    title: "Why is a human involved?",
    body:
      "The AI performs analysis, but a person remains responsible for reviewing the result. VeriAudit records that human decision as part of the execution history.",
  },
  "trail-conclusion": {
    title: "What is the conclusion?",
    body:
      "This is the recorded outcome after the AI analysis and human review.",
  },
  verification: {
    title: "What is being verified?",
    body:
      "We are checking the integrity of the recorded execution evidence, not whether the AI's decision was objectively correct. CooL provides the cryptographic evidence used to perform this check.",
  },
  rework: {
    title: "Is new work allowed?",
    body:
      "Real work may happen again after an audit is closed. VeriAudit does not rewrite the old execution. A new investigation becomes a new execution linked to the earlier one.",
  },
  tamper: {
    title: "Why would a historical record change?",
    body:
      "We are not changing the company's financial data. We are changing the historical representation of what the original execution claims happened. Not every change is a hacker attack — software bugs, administrator actions, compromised accounts, accidental edits, or deliberate manipulation can all affect a record. The question is whether you can detect that it no longer matches what was originally sealed.",
  },
  "tamper-failed": {
    title: "What failed?",
    body:
      "The signing identity can still be recognized. What failed is integrity: the current historical record no longer matches the evidence that was sealed. Rework is allowed. Rewriting history is detectable.",
  },
  complete: {
    title: "What should I take away?",
    body:
      "VeriAudit makes consequential AI work searchable, reconstructable, and cryptographically verifiable. Legitimate rework creates a new record. Changing the old record is detectable.",
  },
};

const SCENARIO_SELECT: Record<Scenario, ExplainerCopy> = {
  financial: {
    title: "What is this audit?",
    body:
      "This checks whether revenue was booked only after the work was delivered. A human auditor cares about early recognition, approval authority, and whether the same person posted and approved an entry.",
  },
  legal: {
    title: "What is this audit?",
    body: SCENARIO_BRIEFINGS.legal.what + " " + SCENARIO_BRIEFINGS.legal.checking,
  },
  cyber: {
    title: "What is this audit?",
    body: SCENARIO_BRIEFINGS.cyber.what + " " + SCENARIO_BRIEFINGS.cyber.checking,
  },
  procurement: {
    title: "What is this audit?",
    body: SCENARIO_BRIEFINGS.procurement.what + " " + SCENARIO_BRIEFINGS.procurement.checking,
  },
};

export function explainerCopy(topic: ExplainerTopic, scenarioId?: Scenario | null): ExplainerCopy {
  if (topic === "scenario_select") {
    return scenarioId
      ? SCENARIO_SELECT[scenarioId]
      : {
          title: "Why are we starting with an audit?",
          body:
            "Each card is a complete live audit. Financial is the recommended reference path. Legal, cybersecurity, and procurement use the same engine with their own evidence, findings, and trail.",
        };
  }
  if (topic === "tamper") {
    return {
      title: COPY.tamper.title,
      body:
        "We are not changing the company's underlying business records. We are changing the historical representation of what the original execution claims happened. Not every change is a hacker attack — software bugs, administrator actions, compromised accounts, accidental edits, or deliberate manipulation can all affect a record. The question is whether you can detect that it no longer matches what was originally sealed.",
    };
  }
  return COPY[topic];
}

export function topicFromTrailType(type: string | null): ExplainerTopic {
  if (type === "artifact.ingested" || type === "artifact.parsed") return "trail-evidence";
  if (type === "finding.created") return "trail-finding";
  if (type === "human.review.completed") return "trail-review";
  if (type === "conclusion.created") return "trail-conclusion";
  return "trail";
}
