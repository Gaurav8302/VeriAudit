/**
 * Workspace context handed to the model on every request.
 *
 * The server keeps no audit state, so the client sends the current audit,
 * execution, control set, evidence inventory and findings alongside the
 * question. Without this the model could only see retrieved passages and had no
 * way to answer questions about the audit itself.
 */
import type { AiEvidenceContext } from "./types";

export interface AiContextControl {
  readonly controlId: string;
  readonly title: string;
  readonly requirement: string;
}

export interface AiContextFinding {
  readonly findingId: string;
  readonly title: string;
  readonly severity: string;
  readonly review: string;
}

export interface AiWorkspaceContext {
  readonly auditId?: string;
  readonly auditTitle?: string;
  readonly domain?: string;
  readonly period?: string | null;
  readonly objective?: string | null;
  readonly executionId?: string;
  readonly executionLabel?: string;
  readonly executionStatus?: string;
  readonly controls?: readonly AiContextControl[];
  readonly findings?: readonly AiContextFinding[];
  readonly recentEvents?: readonly string[];
}

function line(label: string, value: string | null | undefined): string | null {
  return value ? `${label}: ${value}` : null;
}

/** Inventory of what is attached, so the model can answer "what do I have?". */
export function evidenceInventory(evidence: readonly AiEvidenceContext[]): string {
  if (evidence.length === 0) return "No evidence is attached to this execution.";
  return evidence
    .map((item) => {
      const chunks = item.chunks ?? [];
      const locators = chunks.map((chunk) => chunk.locator).filter(Boolean);
      const readable =
        item.extraction === "text"
          ? `${chunks.length} readable section${chunks.length === 1 ? "" : "s"}`
          : "fingerprinted only, no readable text";
      const where = locators.length ? ` [${locators.slice(0, 12).join("; ")}]` : "";
      return `- ${item.evidenceId} | ${item.filename ?? item.title} | ${item.kind} | ${readable}${where}`;
    })
    .join("\n");
}

export function contextBlock(
  context: AiWorkspaceContext | undefined,
  evidence: readonly AiEvidenceContext[],
): string {
  const parts: (string | null)[] = [
    "AUDIT CONTEXT",
    line("Audit", context?.auditTitle ?? context?.auditId),
    line("Audit id", context?.auditId),
    line("Domain", context?.domain),
    line("Period", context?.period ?? null),
    line("Objective", context?.objective ?? null),
    line(
      "Execution",
      context?.executionLabel
        ? `${context.executionLabel} (${context.executionId ?? "?"}) status=${context.executionStatus ?? "open"}`
        : context?.executionId,
    ),
  ];

  const controls = context?.controls ?? [];
  if (controls.length > 0) {
    parts.push(
      "",
      "CONTROLS IN SCOPE",
      ...controls.map((item) => `- ${item.controlId} ${item.title}: ${item.requirement}`),
    );
  }

  parts.push("", "EVIDENCE ATTACHED TO THIS EXECUTION", evidenceInventory(evidence));

  const findings = context?.findings ?? [];
  if (findings.length > 0) {
    parts.push(
      "",
      "FINDINGS ALREADY ON THIS EXECUTION",
      ...findings.map(
        (item) => `- ${item.findingId} ${item.title} (severity=${item.severity}, human review=${item.review})`,
      ),
    );
  }

  const events = context?.recentEvents ?? [];
  if (events.length > 0) {
    parts.push("", "RECENT RECORDED EVENTS", ...events.slice(0, 10).map((item) => `- ${item}`));
  }

  return parts.filter((item) => item !== null).join("\n");
}
