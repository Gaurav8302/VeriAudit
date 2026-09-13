/**
 * Cybersecurity / IT scenario — 10 controls, 3 exceptions.
 *
 * This is the scenario that exercises the PENDING review state: the
 * privileged-account finding has no decision in the review policy, so it stays
 * `open` and the conclusion reports human verification as incomplete. The
 * engine must be able to say "a person has not looked at this yet" — an audit
 * tool that silently auto-approves its own findings is the thing VeriAudit
 * exists to argue against.
 */
import { deterministicReasoner } from "../reasoner";
import type { Artifact, AuditScenario, Control } from "../types";

interface Account {
  readonly userId: string;
  readonly name: string;
  readonly privileged: boolean;
  readonly mfaEnabled: boolean;
  readonly status: "active" | "disabled";
  readonly lastReviewedOn: string;
}

interface Termination {
  readonly userId: string;
  readonly terminatedOn: string;
  /** null = access was never revoked. */
  readonly accessRevokedOn: string | null;
}

export interface CyberEvidence {
  readonly asOf: string;
  readonly accounts: readonly Account[];
  readonly terminations: readonly Termination[];
  readonly privilegedAccountCap: number;
  readonly accessReviewIntervalDays: number;
  readonly lastAccessReviewOn: string;
  readonly config: {
    readonly passwordMinLength: number;
    readonly passwordMinRequired: number;
    readonly sessionTimeoutMinutes: number;
    readonly sessionTimeoutMaxMinutes: number;
    readonly auditLoggingEnabled: boolean;
    readonly encryptionAtRestEnabled: boolean;
  };
}

const ART_ACCESS = "ART-CYB-001";
const ART_CONFIG = "ART-CYB-002";
const ART_REVIEW = "ART-CYB-003";

const ACCOUNTS: Account[] = [
  { userId: "svc-deploy", name: "Deployment Service Account", privileged: true, mfaEnabled: true, status: "active", lastReviewedOn: "2026-09-01" },
  { userId: "p.adeyemi", name: "P. Adeyemi", privileged: true, mfaEnabled: true, status: "active", lastReviewedOn: "2026-09-01" },
  // Privileged without MFA — the high-severity exception.
  { userId: "l.moreau", name: "L. Moreau", privileged: true, mfaEnabled: false, status: "active", lastReviewedOn: "2026-09-01" },
  { userId: "s.kaur", name: "S. Kaur", privileged: true, mfaEnabled: true, status: "active", lastReviewedOn: "2026-09-01" },
  { userId: "m.brandt", name: "M. Brandt", privileged: true, mfaEnabled: true, status: "active", lastReviewedOn: "2026-09-01" },
  { userId: "j.ferreira", name: "J. Ferreira", privileged: false, mfaEnabled: true, status: "active", lastReviewedOn: "2026-09-01" },
  { userId: "a.novak", name: "A. Novak", privileged: false, mfaEnabled: true, status: "active", lastReviewedOn: "2026-09-01" },
  // Terminated but still active — the second high-severity exception.
  { userId: "r.dlamini", name: "R. Dlamini", privileged: false, mfaEnabled: true, status: "active", lastReviewedOn: "2026-09-01" },
];

const TERMINATIONS: Termination[] = [
  { userId: "c.ibarra", terminatedOn: "2026-08-04", accessRevokedOn: "2026-08-04" },
  { userId: "r.dlamini", terminatedOn: "2026-08-29", accessRevokedOn: null },
];

const EVIDENCE: CyberEvidence = {
  asOf: "2026-09-30",
  accounts: ACCOUNTS,
  terminations: TERMINATIONS,
  // Five privileged accounts against a cap of four.
  privilegedAccountCap: 4,
  accessReviewIntervalDays: 90,
  lastAccessReviewOn: "2026-09-01",
  config: {
    passwordMinLength: 14,
    passwordMinRequired: 12,
    sessionTimeoutMinutes: 20,
    sessionTimeoutMaxMinutes: 30,
    auditLoggingEnabled: true,
    encryptionAtRestEnabled: true,
  },
};

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

const CONTROLS: Control<CyberEvidence>[] = [
  {
    controlId: "ACC-MFA-01",
    name: "MFA on privileged accounts",
    description: "Every active privileged account has multi-factor authentication enabled.",
    category: "access control",
    artifactIds: [ART_ACCESS],
    evaluate: ({ evidence }) => {
      const privileged = evidence.accounts.filter((a) => a.privileged && a.status === "active");
      const without = privileged.filter((a) => !a.mfaEnabled);
      if (without.length === 0) {
        return {
          status: "pass",
          observed: { privileged_accounts: privileged.length, without_mfa: 0 },
          rationale: `All ${privileged.length} active privileged accounts have MFA enabled.`,
        };
      }
      const first = without[0]!;
      return {
        status: "exception",
        observed: {
          privileged_accounts: privileged.length,
          without_mfa: without.length,
          user_ids: without.map((a) => a.userId),
        },
        rationale:
          `${without.length} active privileged account has no MFA: ${first.name} (${first.userId}). ` +
          "A privileged account without a second factor is a single-credential path to administrative access.",
        finding: {
          severity: "high",
          title: "Privileged account without multi-factor authentication",
          description: `${first.name} (${first.userId}) holds privileged access with MFA disabled.`,
          recommendedAction: "Enforce MFA on the account immediately or suspend its privileged role.",
        },
      };
    },
  },
  {
    controlId: "ACC-TERM-02",
    name: "Terminated access revocation",
    description: "Access is revoked for every terminated user.",
    category: "access control",
    artifactIds: [ART_ACCESS],
    evaluate: ({ evidence }) => {
      const unrevoked = evidence.terminations.filter((t) => t.accessRevokedOn === null);
      if (unrevoked.length === 0) {
        return {
          status: "pass",
          observed: { terminations: evidence.terminations.length, unrevoked: 0 },
          rationale: `Access was revoked for all ${evidence.terminations.length} terminations in the period.`,
        };
      }
      const first = unrevoked[0]!;
      const account = evidence.accounts.find((a) => a.userId === first.userId);
      const days = daysBetween(first.terminatedOn, evidence.asOf);
      return {
        status: "exception",
        observed: {
          terminations: evidence.terminations.length,
          unrevoked: unrevoked.length,
          user_ids: unrevoked.map((t) => t.userId),
          terminated_on: first.terminatedOn,
          days_outstanding: days,
          account_status: account?.status ?? "unknown",
        },
        rationale:
          `${first.userId} was terminated on ${first.terminatedOn} but access has not been revoked ` +
          `and the account is still ${account?.status ?? "unknown"} ${days} days later.`,
        finding: {
          severity: "high",
          title: "Access not revoked for a terminated user",
          description: `${first.userId} retains an active account ${days} days after termination.`,
          recommendedAction: "Disable the account and review activity since the termination date.",
        },
      };
    },
  },
  {
    controlId: "ACC-REV-03",
    name: "Periodic access review",
    description: "An access review was performed within the required interval.",
    category: "governance",
    artifactIds: [ART_REVIEW],
    evaluate: ({ evidence }) => {
      const elapsed = daysBetween(evidence.lastAccessReviewOn, evidence.asOf);
      const ok = elapsed <= evidence.accessReviewIntervalDays;
      return {
        status: ok ? "pass" : "exception",
        observed: {
          last_review_on: evidence.lastAccessReviewOn,
          days_since_review: elapsed,
          interval_days: evidence.accessReviewIntervalDays,
        },
        rationale: ok
          ? `Last access review was ${elapsed} days ago, inside the ${evidence.accessReviewIntervalDays}-day interval.`
          : `Last access review was ${elapsed} days ago, beyond the ${evidence.accessReviewIntervalDays}-day interval.`,
        ...(ok
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Access review overdue",
                description: `The last access review was ${elapsed} days ago.`,
                recommendedAction: "Perform the access review and reset the schedule.",
              },
            }),
      };
    },
  },
  {
    controlId: "CFG-PWD-04",
    name: "Password length policy",
    description: "Minimum password length meets the standard.",
    category: "configuration",
    artifactIds: [ART_CONFIG],
    evaluate: ({ evidence }) => {
      const ok = evidence.config.passwordMinLength >= evidence.config.passwordMinRequired;
      return {
        status: ok ? "pass" : "exception",
        observed: {
          configured: evidence.config.passwordMinLength,
          required: evidence.config.passwordMinRequired,
        },
        rationale: ok
          ? `Minimum password length is ${evidence.config.passwordMinLength}, meeting the required ${evidence.config.passwordMinRequired}.`
          : `Minimum password length is ${evidence.config.passwordMinLength}, below the required ${evidence.config.passwordMinRequired}.`,
        ...(ok
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Password length below standard",
                description: "The configured minimum password length is non-compliant.",
                recommendedAction: `Raise the minimum to ${evidence.config.passwordMinRequired} characters.`,
              },
            }),
      };
    },
  },
  {
    controlId: "CFG-SES-05",
    name: "Session timeout",
    description: "Idle session timeout is within the maximum.",
    category: "configuration",
    artifactIds: [ART_CONFIG],
    evaluate: ({ evidence }) => {
      const ok = evidence.config.sessionTimeoutMinutes <= evidence.config.sessionTimeoutMaxMinutes;
      return {
        status: ok ? "pass" : "exception",
        observed: {
          configured_minutes: evidence.config.sessionTimeoutMinutes,
          max_minutes: evidence.config.sessionTimeoutMaxMinutes,
        },
        rationale: ok
          ? `Idle timeout is ${evidence.config.sessionTimeoutMinutes} minutes, within the ${evidence.config.sessionTimeoutMaxMinutes}-minute maximum.`
          : `Idle timeout is ${evidence.config.sessionTimeoutMinutes} minutes, beyond the maximum.`,
        ...(ok
          ? {}
          : {
              finding: {
                severity: "low" as const,
                title: "Session timeout exceeds the maximum",
                description: "Sessions remain valid longer than policy allows.",
                recommendedAction: "Reduce the idle timeout.",
              },
            }),
      };
    },
  },
  {
    controlId: "CFG-LOG-06",
    name: "Audit logging enabled",
    description: "Audit logging is enabled on the in-scope system.",
    category: "configuration",
    artifactIds: [ART_CONFIG],
    evaluate: ({ evidence }) => ({
      status: evidence.config.auditLoggingEnabled ? "pass" : "exception",
      observed: { audit_logging_enabled: evidence.config.auditLoggingEnabled },
      rationale: evidence.config.auditLoggingEnabled
        ? "Audit logging is enabled."
        : "Audit logging is disabled, so privileged activity is not recorded.",
      ...(evidence.config.auditLoggingEnabled
        ? {}
        : {
            finding: {
              severity: "high" as const,
              title: "Audit logging disabled",
              description: "Privileged activity is not being recorded.",
              recommendedAction: "Enable audit logging and forward to the SIEM.",
            },
          }),
    }),
  },
  {
    controlId: "CFG-ENC-07",
    name: "Encryption at rest",
    description: "Data at rest is encrypted.",
    category: "configuration",
    artifactIds: [ART_CONFIG],
    evaluate: ({ evidence }) => ({
      status: evidence.config.encryptionAtRestEnabled ? "pass" : "exception",
      observed: { encryption_at_rest_enabled: evidence.config.encryptionAtRestEnabled },
      rationale: evidence.config.encryptionAtRestEnabled
        ? "Encryption at rest is enabled on the in-scope stores."
        : "Data at rest is unencrypted.",
      ...(evidence.config.encryptionAtRestEnabled
        ? {}
        : {
            finding: {
              severity: "high" as const,
              title: "Data at rest is not encrypted",
              description: "In-scope stores hold unencrypted data.",
              recommendedAction: "Enable encryption at rest and re-key existing volumes.",
            },
          }),
    }),
  },
  {
    controlId: "PRV-MIN-08",
    name: "Privileged account minimisation",
    description: "The number of privileged accounts is within the approved cap.",
    category: "access control",
    artifactIds: [ART_ACCESS, ART_REVIEW],
    evaluate: ({ evidence }) => {
      const privileged = evidence.accounts.filter((a) => a.privileged && a.status === "active");
      const excess = privileged.length - evidence.privilegedAccountCap;
      if (excess <= 0) {
        return {
          status: "pass",
          observed: { privileged_accounts: privileged.length, cap: evidence.privilegedAccountCap },
          rationale: `${privileged.length} privileged accounts against a cap of ${evidence.privilegedAccountCap}.`,
        };
      }
      return {
        status: "exception",
        observed: {
          privileged_accounts: privileged.length,
          cap: evidence.privilegedAccountCap,
          excess,
          user_ids: privileged.map((a) => a.userId),
        },
        rationale:
          `${privileged.length} active privileged accounts exist against an approved cap of ` +
          `${evidence.privilegedAccountCap}, ${excess} above the limit.`,
        finding: {
          severity: "medium",
          title: "Privileged account count above the approved cap",
          description: `${privileged.length} privileged accounts are active against a cap of ${evidence.privilegedAccountCap}.`,
          recommendedAction: "Re-justify or remove the excess privileged roles.",
        },
      };
    },
  },
  {
    controlId: "ACC-ORPH-09",
    name: "Orphaned account detection",
    description: "No active account belongs to a user with no owner record.",
    category: "access control",
    artifactIds: [ART_ACCESS],
    evaluate: ({ evidence }) => {
      const orphaned = evidence.accounts.filter((a) => a.status === "active" && a.name.trim() === "");
      return {
        status: orphaned.length === 0 ? "pass" : "exception",
        observed: {
          active_accounts: evidence.accounts.filter((a) => a.status === "active").length,
          orphaned: orphaned.length,
        },
        rationale:
          orphaned.length === 0
            ? "Every active account has a named owner."
            : `${orphaned.length} active accounts have no named owner.`,
        ...(orphaned.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Orphaned active accounts",
                description: `${orphaned.length} active accounts have no owner.`,
                recommendedAction: "Assign an owner or disable the accounts.",
              },
            }),
      };
    },
  },
  {
    controlId: "EVD-COMP-10",
    name: "Evidence completeness",
    description: "Every terminated user in the register resolves to an account record.",
    category: "completeness",
    artifactIds: [ART_ACCESS, ART_REVIEW],
    evaluate: ({ evidence }) => {
      // A termination with no account is acceptable (the account may already be
      // deleted); one that was never revoked AND has no record is not, because
      // then revocation cannot be evidenced either way.
      const unverifiable = evidence.terminations.filter(
        (t) => t.accessRevokedOn === null && !evidence.accounts.some((a) => a.userId === t.userId),
      );
      return {
        status: unverifiable.length === 0 ? "pass" : "exception",
        observed: {
          terminations: evidence.terminations.length,
          unverifiable: unverifiable.length,
          artifacts_in_scope: 3,
        },
        rationale:
          unverifiable.length === 0
            ? "Every unrevoked termination has a matching account record, so revocation status is verifiable."
            : `${unverifiable.length} terminations cannot be verified against any account record.`,
        ...(unverifiable.length === 0
          ? {}
          : {
              finding: {
                severity: "medium" as const,
                title: "Termination records cannot be verified",
                description: `${unverifiable.length} terminations have no corresponding account evidence.`,
                recommendedAction: "Obtain the directory export covering these users.",
              },
            }),
      };
    },
  },
];

const ARTIFACTS: Artifact[] = [
  {
    artifactId: ART_ACCESS,
    kind: "access_export",
    title: "Identity Provider Access Export",
    mimeType: "text/plain",
    rows: ACCOUNTS.length,
    content: [
      "IDENTITY PROVIDER ACCESS EXPORT",
      `as_of: ${EVIDENCE.asOf}`,
      "",
      "user_id       privileged  mfa    status    last_reviewed  name",
      ...ACCOUNTS.map(
        (a) =>
          `${a.userId.padEnd(13)} ${String(a.privileged).padEnd(11)} ${String(a.mfaEnabled).padEnd(6)} ` +
          `${a.status.padEnd(9)} ${a.lastReviewedOn}     ${a.name}`,
      ),
      "",
      "TERMINATIONS",
      "user_id       terminated_on  access_revoked_on",
      ...TERMINATIONS.map(
        (t) => `${t.userId.padEnd(13)} ${t.terminatedOn}     ${t.accessRevokedOn ?? "NOT REVOKED"}`,
      ),
    ].join("\n"),
    parsed: {
      accounts: ACCOUNTS.length,
      privileged: ACCOUNTS.filter((a) => a.privileged).length,
      without_mfa: ACCOUNTS.filter((a) => !a.mfaEnabled).map((a) => a.userId),
      unrevoked_terminations: TERMINATIONS.filter((t) => t.accessRevokedOn === null).map((t) => t.userId),
    },
  },
  {
    artifactId: ART_CONFIG,
    kind: "register",
    title: "Security Configuration Baseline",
    mimeType: "text/plain",
    rows: null,
    content: [
      "SECURITY CONFIGURATION BASELINE",
      `password_min_length: ${EVIDENCE.config.passwordMinLength} (required ${EVIDENCE.config.passwordMinRequired})`,
      `session_timeout_minutes: ${EVIDENCE.config.sessionTimeoutMinutes} (max ${EVIDENCE.config.sessionTimeoutMaxMinutes})`,
      `audit_logging_enabled: ${EVIDENCE.config.auditLoggingEnabled}`,
      `encryption_at_rest_enabled: ${EVIDENCE.config.encryptionAtRestEnabled}`,
    ].join("\n"),
    parsed: { ...EVIDENCE.config },
  },
  {
    artifactId: ART_REVIEW,
    kind: "register",
    title: "Access Review Register",
    mimeType: "text/plain",
    rows: null,
    content: [
      "ACCESS REVIEW REGISTER",
      `last_review_on: ${EVIDENCE.lastAccessReviewOn}`,
      `review_interval_days: ${EVIDENCE.accessReviewIntervalDays}`,
      `privileged_account_cap: ${EVIDENCE.privilegedAccountCap}`,
      `privileged_accounts_active: ${ACCOUNTS.filter((a) => a.privileged && a.status === "active").length}`,
    ].join("\n"),
    parsed: {
      last_review_on: EVIDENCE.lastAccessReviewOn,
      privileged_account_cap: EVIDENCE.privilegedAccountCap,
      privileged_accounts_active: ACCOUNTS.filter((a) => a.privileged && a.status === "active").length,
    },
  },
];

export const cyberScenario: AuditScenario<CyberEvidence> = {
  scenarioId: "cyber",
  displayName: "Cybersecurity / IT Audit",
  description:
    "Tests privileged access, joiner-mover-leaver revocation, and the security configuration " +
    "baseline against an identity provider export.",
  isHero: false,

  auditId: "AUD-CYB-2026-09",
  executionId: "EXEC-CYB-2026-09-001",
  eventCode: "CYB-2609",
  title: "Privileged Access and Configuration Review",
  period: "2026-Q3",
  openedAt: "2026-09-24T08:30:00.000Z",
  stepMinutes: 5,

  artifacts: ARTIFACTS,
  evidence: EVIDENCE,
  controls: CONTROLS,

  retrieval: {
    query: "privileged access mfa termination revocation configuration baseline",
    artifactIds: [ART_ACCESS, ART_CONFIG, ART_REVIEW],
    passages: [
      "Access export: l.moreau — privileged=true, mfa=false, status=active.",
      "Access export: r.dlamini — terminated 2026-08-29, access_revoked_on: NOT REVOKED, status=active.",
      "Access review register: privileged_account_cap=4, privileged_accounts_active=5.",
      "Configuration baseline: audit_logging_enabled=true, encryption_at_rest_enabled=true.",
    ],
  },

  reasoner: deterministicReasoner({
    name: "veriaudit-reasoner",
    version: "0.1.0",
    assess: (input) => ({
      assessment:
        `Privileged access and configuration evidence reviewed across ${input.passages.length} ` +
        "retrieved passages. One privileged account lacks MFA and one terminated user retains an " +
        "active account; the configuration baseline itself is compliant.",
      observations: [
        "One active privileged account has MFA disabled.",
        "One terminated user's access was never revoked.",
        "Active privileged accounts exceed the approved cap by one.",
      ],
    }),
  }),

  reviewPolicy: {
    reviewer: { name: "N. Farrell", role: "Head of Information Security" },
    requiresReview: ({ severity }) => severity === "high" || severity === "medium",
    // PRV-MIN-08 is deliberately absent: that finding stays PENDING, so the
    // conclusion reports human verification as incomplete.
    decisions: {
      "ACC-MFA-01": {
        decision: "accepted",
        note: "Confirmed. MFA enforced on the account the same day and privileged role re-attested.",
      },
      "ACC-TERM-02": {
        decision: "accepted",
        note: "Confirmed. Account disabled and 31 days of activity pulled for review.",
      },
    },
  },

  expected: { controlsTested: 10, controlsPassed: 7, exceptions: 3, findings: 3 },

  searchTags: [
    "privileged access",
    "mfa",
    "access review",
    "terminated access",
    "access exception",
    "ACC-MFA-01",
    "configuration baseline",
  ],
};
