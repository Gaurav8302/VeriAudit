import { describe, expect, it } from "vitest";
import { runGateway } from "@/lib/ai/gateway";
import { ProviderError } from "@/lib/ai/errors";
import { canonicalEventsFor } from "@/lib/product/canonicalEvents";
import {
  addEvidence,
  applyAiTurn,
  closeExecution,
  createAudit,
  createExecution,
  EMPTY_WORKSPACE,
  findingsFor,
  findingReviewLabel,
  hydrateWorkspaceExecutions,
  isWritableExecution,
  reviewFinding,
} from "@/lib/product/localWorkspace";
import { snapshotExecution, HERO_ORIGINAL_SNAPSHOT, catalogExecutions } from "@/lib/product/lineage";
import { HERO_AUDIT_ID, HERO_EXECUTION_ID } from "@/lib/product/workspace";

describe("product execution lifecycle", () => {
  it("creates an audit with a period and one active execution", () => {
    const { audit, execution } = createAudit(EMPTY_WORKSPACE, {
      title: "Q4 Revenue Recognition Review",
      domain: "financial",
      description: "Review revenue transactions for policy compliance.",
      period: "2026-Q4",
    });
    expect(audit.period).toBe("2026-Q4");
    expect(execution.status).toBe("open");
    expect(isWritableExecution(execution)).toBe(true);
  });

  it("closes an execution so historical work cannot be edited", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Close me",
      domain: "financial",
      description: "Sample",
    });
    const closed = closeExecution(
      created.state,
      created.audit.auditId,
      created.execution.executionId,
      "2026-12-18T12:00:00.000Z",
    );
    expect(closed.execution.status).toBe("closed");
    expect(closed.execution.immutable).toBe(true);
    expect(closed.execution.closedAt).toBe("2026-12-18T12:00:00.000Z");
    expect(isWritableExecution(closed.execution)).toBe(false);
    expect(() =>
      addEvidence(closed.state, {
        auditId: created.audit.auditId,
        executionId: created.execution.executionId,
        title: "Late file",
        kind: "Ledger",
        source: "Upload",
        description: "Should fail",
      }),
    ).toThrow(/later execution/i);
  });

  it("reopens a closed execution as a new child without mutating the old one", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Reopen me",
      domain: "financial",
      description: "Sample",
    });
    const withEvidence = addEvidence(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      title: "Q4 General Ledger",
      kind: "Ledger",
      source: "Upload",
      description: "Sample",
      filename: "ledger.csv",
      fingerprint: "abc",
      extraction: "text",
    });
    const first = withEvidence.state.extras[created.audit.auditId]![0]!;
    const closed = closeExecution(withEvidence.state, created.audit.auditId, first.executionId);
    const before = snapshotExecution(closed.state.extras[created.audit.auditId]![0]!);
    const reopened = createExecution(closed.state, created.audit.auditId, "2026-12-20T09:00:00.000Z");
    const original = reopened.state.extras[created.audit.auditId]!.find(
      (item) => item.executionId === first.executionId,
    )!;
    expect(reopened.execution.executionId).toBe("EXEC-LOCAL-001-002");
    expect(reopened.execution.parentExecutionId).toBe(first.executionId);
    expect(original.status).toBe("closed");
    expect(snapshotExecution(original)).toEqual(before);
    expect(withEvidence.evidence.executionId).toBe(first.executionId);
  });

  it("records AI actions, findings, evidence, and human review notes", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Review path",
      domain: "financial",
      description: "Sample",
    });
    const withEvidence = addEvidence(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      title: "Policy",
      kind: "Policy",
      source: "Upload",
      description: "Sample",
      filename: "policy.txt",
      fingerprint: "def",
      extraction: "text",
    });
    const applied = applyAiTurn(withEvidence.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      prompt: "Check the policy",
      reply: "One exception needs review.",
      actions: [
        {
          type: "READ_EVIDENCE",
          title: "Read Policy",
          detail: "Used extracted text",
          evidenceIds: [withEvidence.evidence.artifactId],
        },
        {
          type: "CREATE_FINDING",
          title: "Create finding",
          detail: "exception",
          evidenceIds: [withEvidence.evidence.artifactId],
          findingTitle: "Revenue exception",
          findingSeverity: "high",
          findingDescription: "Needs review",
        },
      ],
      provider: "mock",
      model: "veriaudit-mock",
      requestId: "r1",
      mode: "mock",
      status: "ok",
    });
    const finding = findingsFor(applied.state, created.audit.auditId)[0]!;
    expect(finding.review).toBe("pending");
    expect(findingReviewLabel(finding.review)).toBe("Open");
    expect(finding.evidenceIds).toContain(withEvidence.evidence.artifactId);
    expect(finding.originatingActionId).toMatch(/^ACTN-LOCAL-/);
    const hydrated = hydrateWorkspaceExecutions(
      applied.state,
      applied.state.extras[created.audit.auditId]!,
    )[0]!;
    expect(hydrated.eventCount).toBeGreaterThan(0);
    expect(hydrated.findingCount).toBe(1);
    expect(
      applied.state.actions.some((item) => item.type === "READ_EVIDENCE" && item.status === "completed"),
    ).toBe(true);
    const reviewed = reviewFinding(applied.state, finding.findingId, "modified", "Legitimate contract amendment.");
    expect(reviewed.finding.review).toBe("modified");
    expect(reviewed.finding.reviewNote).toBe("Legitimate contract amendment.");
    expect(() => reviewFinding(applied.state, finding.findingId, "modified")).toThrow(/note/i);
    const events = canonicalEventsFor(reviewed.state, created.execution.executionId);
    expect(events.some((item) => item.type === "finding.reviewed")).toBe(true);
    expect(events.every((item) => item.sealed === false)).toBe(true);
  });

  it("leaves the hero original snapshot unchanged after close and reopen work", () => {
    const reopened = createExecution(EMPTY_WORKSPACE, HERO_AUDIT_ID);
    const closed = closeExecution(reopened.state, HERO_AUDIT_ID, reopened.execution.executionId);
    expect(snapshotExecution(catalogExecutions(HERO_AUDIT_ID)[0]!)).toEqual(HERO_ORIGINAL_SNAPSHOT);
    expect(closed.state.extras[HERO_AUDIT_ID]?.some((item) => item.executionId === HERO_EXECUTION_ID)).toBe(false);
  });

  it("keeps provider fallback returning one response", async () => {
    const result = await runGateway(
      {
        messages: [{ role: "user", content: "Check" }],
        evidence: [],
      },
      {
        mode: "live",
        chain: [
          { name: "openrouter", apiKey: "x", model: "m1", url: "https://example.test/a" },
          { name: "groq", apiKey: "x", model: "m2", url: "https://example.test/b" },
        ],
        invoke: async (config) => {
          if (config.name === "openrouter") {
            throw new ProviderError({
              provider: "openrouter",
              model: "m1",
              reason: "unavailable",
              message: "down",
            });
          }
          return {
            provider: config.name,
            model: config.model,
            response: '{"reply":"ok","actions":[]}',
            usage: null,
            latencyMs: 2,
            requestId: "g1",
            status: "ok",
            mode: "live",
          };
        },
      },
    );
    expect(result.response.provider).toBe("groq");
    expect(result.failures).toHaveLength(1);
  });
});
