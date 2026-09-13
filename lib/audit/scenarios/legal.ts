/**
 * Legal / Compliance scenario — 8 controls, 2 exceptions.
 *
 * Same engine as the financial hero. Only the evidence, the rules, and the
 * domain labels differ.
 */
import { deterministicReasoner } from "../reasoner";
import type { Artifact, AuditScenario, Control } from "../types";

interface Clause {
  readonly clauseId: string;
  readonly contractId: string;
  readonly topic: string;
  readonly text: string;
}

interface Requirement {
  readonly requirementId: string;
  readonly regulation: string;
  readonly description: string;
  readonly mandatory: boolean;
  /** The contract clause that satisfies it, or null if unmapped. */
  readonly satisfiedBy: string | null;
}

export interface LegalEvidence {
  readonly framework: string;
  readonly clauses: readonly Clause[];
  readonly requirements: readonly Requirement[];
  readonly requiredClauseTopics: readonly string[];
  readonly dpa: { readonly executed: boolean; readonly executedOn: string | null };
  readonly retention: { readonly requiredMonths: number; readonly configuredMonths: number };
  readonly subprocessors: readonly { readonly name: string; readonly disclosed: boolean }[];
  readonly breachNotification: { readonly regulatoryMaxHours: number; readonly policyHours: number };
  readonly training: readonly { readonly team: string; readonly completed: boolean }[];
}

const ART_REGISTER = "ART-LEG-001";
const ART_CONTRACT = "ART-LEG-002";
const ART_POLICY = "ART-LEG-003";

const CLAUSES: Clause[] = [
  { clauseId: "CL-01", contractId: "MSA-7741", topic: "data_processing", text: "Processor acts only on documented instructions." },
  { clauseId: "CL-02", contractId: "MSA-7741", topic: "confidentiality", text: "Both parties maintain confidentiality for 5 years." },
  { clauseId: "CL-03", contractId: "MSA-7741", topic: "audit_rights", text: "Customer may audit annually on 30 days' notice." },
  { clauseId: "CL-04", contractId: "MSA-7741", topic: "breach_notification", text: "Processor notifies within 48 hours of becoming aware." },
  { clauseId: "CL-05", contractId: "MSA-7741", topic: "subprocessors", text: "Subprocessors listed in Annex B; changes notified." },
];

const REQUIREMENTS: Requirement[] = [
  { requirementId: "REQ-01", regulation: "GDPR Art.28", description: "Processor acts on documented instructions", mandatory: true, satisfiedBy: "CL-01" },
  { requirementId: "REQ-02", regulation: "GDPR Art.28", description: "Confidentiality obligations on personnel", mandatory: true, satisfiedBy: "CL-02" },
  { requirementId: "REQ-03", regulation: "GDPR Art.28", description: "Customer audit rights", mandatory: true, satisfiedBy: "CL-03" },
  { requirementId: "REQ-04", regulation: "GDPR Art.33", description: "Breach notification without undue delay", mandatory: true, satisfiedBy: "CL-04" },
  { requirementId: "REQ-05", regulation: "GDPR Art.28(2)", description: "Subprocessor authorisation", mandatory: true, satisfiedBy: "CL-05" },
  {
    requirementId: "REQ-06",
    regulation: "GDPR Art.32",
    description: "Documented technical and organisational security measures",
    mandatory: true,
    // Unmapped — no clause in the MSA covers it.
    satisfiedBy: null,
  },
  { requirementId: "REQ-07", regulation: "GDPR Art.30", description: "Records of processing activities", mandatory: false, satisfiedBy: null },
];

const EVIDENCE: LegalEvidence = {
  framework: "GDPR + internal policy LEG-POL-2",
  clauses: CLAUSES,
  requirements: REQUIREMENTS,
  requiredClauseTopics: ["data_processing", "confidentiality", "audit_rights", "breach_notification", "subprocessors"],
  dpa: { executed: true, executedOn: "2026-04-18" },
  // Configured retention is short of the regulatory requirement.
  retention: { requiredMonths: 72, configuredMonths: 48 },
  subprocessors: [
    { name: "Helios Hosting", disclosed: true },
    { name: "Larkspur Analytics", disclosed: true },
  ],
  breachNotification: { regulatoryMaxHours: 72, policyHours: 48 },
  training: [
    { team: "Engineering", completed: true },
    { team: "Support", completed: true },
    { team: "Sales", completed: true },
  ],
};

const CONTROLS: Control<LegalEvidence>[] = [
  {
    controlId: "REG-MAP-01",
    name: "Regulatory requirement mapping",
    description: "Every mandatory regulatory requirement maps to a contract clause.",
    category: "regulatory mapping",
    artifactIds: [ART_REGISTER, ART_CONTRACT],
    evaluate: ({ evidence }) => {
      const unmapped = evidence.requirements.filter((r) => r.mandatory && r.satisfiedBy === null);
      if (unmapped.length === 0) {
        return {
          status: "pass",
          observed: { mandatory_requirements: evidence.requirements.filter((r) => r.mandatory).length, unmapped: 0 },
          rationale: "Every mandatory requirement is mapped to a clause in the executed contract.",
        };
      }
      const first = unmapped[0]!;
      return {
        status: "exception",
        observed: {
          mandatory_requirements: evidence.requirements.filter((r) => r.mandatory).length,
          unmapped: unmapped.length,
          requirement_ids: unmapped.map((r) => r.requirementId),
          regulation: first.regulation,
        },
        rationale:
          `${unmapped.length} mandatory requirement is unmapped: ${first.requirementId} ` +
          `(${first.regulation} — ${first.description}). No clause in MSA-7741 addresses it.`,
        finding: {
          severity: "high",
          title: "Mandatory regulatory requirement not covered by any contract clause",
          description:
            `${first.requirementId} (${first.regulation}) requires "${first.description}" and no ` +
            "executed clause satisfies it.",
          recommendedAction: "Add a security-measures clause by amendment before the next processing cycle.",
        },
      };
    },
  },
  {
    controlId: "CLS-PRES-02",
    name: "Required clause presence",
    description: "All required clause topics appear in the executed contract.",
    category: "contract",
    artifactIds: [ART_CONTRACT],
    evaluate: ({ evidence }) => {
      const present = new Set(evidence.clauses.map((c) => c.topic));
      const missing = evidence.requiredClauseTopics.filter((t) => !present.has(t));
      return {
        status: missing.length === 0 ? "pass" : "exception",
        observed: { required_topics: evidence.requiredClauseTopics.length, missing: missing.length },
        rationale:
          missing.length === 0
            ? `All ${evidence.requiredClauseTopics.length} required clause topics are present.`
            : `Missing clause topics: ${missing.join(", ")}.`,
        ...(missing.length === 0
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Required contract clauses missing",
                description: `${missing.length} required clause topics are absent.`,
                recommendedAction: "Amend the contract to add the missing clauses.",
              },
            }),
      };
    },
  },
  {
    controlId: "DPA-EXEC-03",
    name: "Data processing agreement executed",
    description: "A signed DPA is on file.",
    category: "contract",
    artifactIds: [ART_CONTRACT],
    evaluate: ({ evidence }) => ({
      status: evidence.dpa.executed ? "pass" : "exception",
      observed: { executed: evidence.dpa.executed, executed_on: evidence.dpa.executedOn },
      rationale: evidence.dpa.executed
        ? `DPA executed ${evidence.dpa.executedOn}.`
        : "No executed DPA on file.",
      ...(evidence.dpa.executed
        ? {}
        : {
            finding: {
              severity: "high" as const,
              title: "No executed data processing agreement",
              description: "Processing is taking place without a signed DPA.",
              recommendedAction: "Execute the DPA before processing continues.",
            },
          }),
    }),
  },
  {
    controlId: "RET-PER-04",
    name: "Retention period compliance",
    description: "Configured retention meets or exceeds the regulatory minimum.",
    category: "data lifecycle",
    artifactIds: [ART_POLICY],
    evaluate: ({ evidence }) => {
      const shortfall = evidence.retention.requiredMonths - evidence.retention.configuredMonths;
      if (shortfall <= 0) {
        return {
          status: "pass",
          observed: { required_months: evidence.retention.requiredMonths, configured_months: evidence.retention.configuredMonths },
          rationale: `Configured retention of ${evidence.retention.configuredMonths} months meets the ${evidence.retention.requiredMonths}-month requirement.`,
        };
      }
      return {
        status: "exception",
        observed: {
          required_months: evidence.retention.requiredMonths,
          configured_months: evidence.retention.configuredMonths,
          shortfall_months: shortfall,
        },
        rationale:
          `Retention is configured for ${evidence.retention.configuredMonths} months against a ` +
          `${evidence.retention.requiredMonths}-month regulatory minimum, a shortfall of ${shortfall} months.`,
        finding: {
          severity: "medium",
          title: "Record retention configured below the regulatory minimum",
          description: `Retention is ${shortfall} months short of the ${evidence.retention.requiredMonths}-month requirement.`,
          recommendedAction: `Extend the retention configuration to ${evidence.retention.requiredMonths} months.`,
        },
      };
    },
  },
  {
    controlId: "SUB-DISC-05",
    name: "Subprocessor disclosure",
    description: "Every subprocessor in use is disclosed to the customer.",
    category: "transparency",
    artifactIds: [ART_REGISTER],
    evaluate: ({ evidence }) => {
      const undisclosed = evidence.subprocessors.filter((s) => !s.disclosed);
      return {
        status: undisclosed.length === 0 ? "pass" : "exception",
        observed: { subprocessors: evidence.subprocessors.length, undisclosed: undisclosed.length },
        rationale:
          undisclosed.length === 0
            ? `All ${evidence.subprocessors.length} subprocessors are disclosed in Annex B.`
            : `${undisclosed.length} subprocessors are undisclosed.`,
        ...(undisclosed.length === 0
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Undisclosed subprocessors in use",
                description: `${undisclosed.length} subprocessors are not disclosed.`,
                recommendedAction: "Disclose the subprocessors and obtain authorisation.",
              },
            }),
      };
    },
  },
  {
    controlId: "BRE-NOT-06",
    name: "Breach notification window",
    description: "The policy notification window is inside the regulatory maximum.",
    category: "incident response",
    artifactIds: [ART_POLICY, ART_CONTRACT],
    evaluate: ({ evidence }) => {
      const ok = evidence.breachNotification.policyHours <= evidence.breachNotification.regulatoryMaxHours;
      return {
        status: ok ? "pass" : "exception",
        observed: {
          policy_hours: evidence.breachNotification.policyHours,
          regulatory_max_hours: evidence.breachNotification.regulatoryMaxHours,
        },
        rationale: ok
          ? `Policy commits to ${evidence.breachNotification.policyHours} hours, inside the ${evidence.breachNotification.regulatoryMaxHours}-hour regulatory maximum.`
          : `Policy allows ${evidence.breachNotification.policyHours} hours, beyond the ${evidence.breachNotification.regulatoryMaxHours}-hour maximum.`,
        ...(ok
          ? {}
          : {
              finding: {
                severity: "high" as const,
                title: "Breach notification window exceeds the regulatory maximum",
                description: "The documented notification window is non-compliant.",
                recommendedAction: "Shorten the policy window and retrain the incident team.",
              },
            }),
      };
    },
  },
  {
    controlId: "TRN-REC-07",
    name: "Training records complete",
    description: "Every in-scope team has completed compliance training.",
    category: "training",
    artifactIds: [ART_REGISTER],
    evaluate: ({ evidence }) => {
      const outstanding = evidence.training.filter((t) => !t.completed);
      return {
        status: outstanding.length === 0 ? "pass" : "exception",
        observed: { teams: evidence.training.length, outstanding: outstanding.length },
        rationale:
          outstanding.length === 0
            ? `All ${evidence.training.length} in-scope teams have completed training.`
            : `${outstanding.length} teams have outstanding training.`,
        ...(outstanding.length === 0
          ? {}
          : {
              finding: {
                severity: "low" as const,
                title: "Compliance training outstanding",
                description: `${outstanding.length} teams have not completed training.`,
                recommendedAction: "Schedule the outstanding sessions.",
              },
            }),
      };
    },
  },
  {
    controlId: "EVD-COMP-08",
    name: "Evidence completeness",
    description: "Every clause referenced by the requirement register exists in the contract.",
    category: "completeness",
    artifactIds: [ART_REGISTER, ART_CONTRACT],
    evaluate: ({ evidence }) => {
      const dangling = evidence.requirements.filter(
        (r) => r.satisfiedBy !== null && !evidence.clauses.some((c) => c.clauseId === r.satisfiedBy),
      );
      return {
        status: dangling.length === 0 ? "pass" : "exception",
        observed: { requirements: evidence.requirements.length, dangling_references: dangling.length },
        rationale:
          dangling.length === 0
            ? "Every clause cited by the requirement register is present in the executed contract."
            : `${dangling.length} requirements cite clauses that do not exist.`,
        ...(dangling.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Requirement register cites non-existent clauses",
                description: `${dangling.length} citations do not resolve.`,
                recommendedAction: "Correct the requirement register mapping.",
              },
            }),
      };
    },
  },
];

const ARTIFACTS: Artifact[] = [
  {
    artifactId: ART_REGISTER,
    kind: "register",
    title: "Compliance Requirement Register",
    mimeType: "text/plain",
    rows: REQUIREMENTS.length,
    content: [
      "COMPLIANCE REQUIREMENT REGISTER",
      `framework: ${EVIDENCE.framework}`,
      "",
      "requirement  regulation        mandatory  satisfied_by  description",
      ...REQUIREMENTS.map(
        (r) =>
          `${r.requirementId.padEnd(12)} ${r.regulation.padEnd(17)} ${String(r.mandatory).padEnd(10)} ` +
          `${(r.satisfiedBy ?? "UNMAPPED").padEnd(13)} ${r.description}`,
      ),
      "",
      `subprocessors: ${EVIDENCE.subprocessors.map((s) => `${s.name} (disclosed=${s.disclosed})`).join(", ")}`,
      `training: ${EVIDENCE.training.map((t) => `${t.team}=${t.completed}`).join(", ")}`,
    ].join("\n"),
    parsed: {
      requirements: REQUIREMENTS.length,
      mandatory: REQUIREMENTS.filter((r) => r.mandatory).length,
      unmapped_mandatory: ["REQ-06"],
    },
  },
  {
    artifactId: ART_CONTRACT,
    kind: "contract",
    title: "Master Services Agreement MSA-7741",
    mimeType: "text/plain",
    rows: null,
    content: [
      "MASTER SERVICES AGREEMENT MSA-7741",
      `data processing agreement executed: ${EVIDENCE.dpa.executedOn}`,
      "",
      ...CLAUSES.map((c) => `${c.clauseId}  [${c.topic}]  ${c.text}`),
    ].join("\n"),
    parsed: { contract_id: "MSA-7741", clauses: CLAUSES.length, topics: CLAUSES.map((c) => c.topic).sort() },
  },
  {
    artifactId: ART_POLICY,
    kind: "policy",
    title: "Internal Compliance Policy LEG-POL-2",
    mimeType: "text/plain",
    rows: null,
    content: [
      "INTERNAL COMPLIANCE POLICY LEG-POL-2",
      "",
      `2.1 Records are retained for ${EVIDENCE.retention.configuredMonths} months.`,
      `2.2 Regulatory minimum retention is ${EVIDENCE.retention.requiredMonths} months.`,
      `2.3 Breaches are notified within ${EVIDENCE.breachNotification.policyHours} hours.`,
      `2.4 The regulatory maximum notification window is ${EVIDENCE.breachNotification.regulatoryMaxHours} hours.`,
    ].join("\n"),
    parsed: {
      policy_id: "LEG-POL-2",
      configured_retention_months: EVIDENCE.retention.configuredMonths,
      required_retention_months: EVIDENCE.retention.requiredMonths,
    },
  },
];

export const legalScenario: AuditScenario<LegalEvidence> = {
  scenarioId: "legal",
  displayName: "Legal / Compliance Audit",
  description:
    "Maps mandatory regulatory requirements to executed contract clauses and tests the " +
    "supporting compliance policy.",
  isHero: false,

  auditId: "AUD-LEG-2026-08",
  executionId: "EXEC-LEG-2026-08-001",
  eventCode: "LEG-2608",
  title: "GDPR Processor Obligations Review",
  period: "2026-Q3",
  openedAt: "2026-08-20T10:00:00.000Z",
  stepMinutes: 6,

  artifacts: ARTIFACTS,
  evidence: EVIDENCE,
  controls: CONTROLS,

  retrieval: {
    query: "processor obligations security measures retention clause mapping",
    artifactIds: [ART_REGISTER, ART_CONTRACT, ART_POLICY],
    passages: [
      "REQ-06 (GDPR Art.32): documented technical and organisational security measures — satisfied_by: UNMAPPED.",
      "MSA-7741 clause topics present: data_processing, confidentiality, audit_rights, breach_notification, subprocessors.",
      "LEG-POL-2 §2.1: records are retained for 48 months.",
      "LEG-POL-2 §2.2: regulatory minimum retention is 72 months.",
      "MSA-7741 CL-04: processor notifies within 48 hours of becoming aware.",
    ],
  },

  reasoner: deterministicReasoner({
    name: "veriaudit-reasoner",
    version: "0.1.0",
    assess: (input) => ({
      assessment:
        `Requirement-to-clause mapping reviewed across ${input.passages.length} retrieved passages. ` +
        "One mandatory security-measures requirement has no corresponding clause, and the " +
        "configured retention period falls short of the regulatory minimum.",
      observations: [
        "GDPR Art.32 security-measures requirement is unmapped in MSA-7741.",
        "Configured retention is 48 months against a 72-month minimum.",
      ],
    }),
  }),

  reviewPolicy: {
    reviewer: { name: "D. Haruna", role: "Head of Legal Operations" },
    requiresReview: ({ severity }) => severity === "high" || severity === "medium",
    decisions: {
      "REG-MAP-01": {
        decision: "accepted",
        note: "Confirmed. Amendment drafted to add an Art.32 security-measures clause.",
      },
      "RET-PER-04": {
        decision: "accepted",
        note: "Confirmed against the retention schedule. Configuration change raised with platform engineering.",
      },
    },
  },

  expected: { controlsTested: 8, controlsPassed: 6, exceptions: 2, findings: 2 },

  searchTags: [
    "gdpr",
    "processor obligations",
    "clause mapping",
    "retention period",
    "compliance exception",
    "REG-MAP-01",
    "MSA-7741",
  ],
};
