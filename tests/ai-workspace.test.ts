import { describe, expect, it } from "vitest";
import { parseAiWork } from "@/lib/ai/parseActions";
import { mockAnalyze } from "@/lib/ai/providers/mock";
import {
  actionsFor,
  addEvidence,
  applyAiTurn,
  createAudit,
  createExecution,
  EMPTY_WORKSPACE,
  findingsFor,
  heroOriginalUnchanged,
  messagesFor,
  reviewFinding,
} from "@/lib/product/localWorkspace";
import { HERO_AUDIT_ID, HERO_EXECUTION_ID } from "@/lib/product/workspace";
import { HERO_ORIGINAL_EVENT_COUNT, HERO_ORIGINAL_SNAPSHOT, catalogExecutions, snapshotExecution } from "@/lib/product/lineage";
import { loadAuditWorkspace } from "@/lib/product/load";

describe("AI workspace records", () => {
  it("keeps conversation and actions on one execution", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Revenue check",
      domain: "financial",
      description: "Sample",
    });
    const withEvidence = addEvidence(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      title: "Q3 General Ledger",
      kind: "Ledger",
      source: "Upload",
      description: "Sample",
      filename: "q3-general-ledger.csv",
      fingerprint: "abc",
      extraction: "text",
      textExcerpt: "JE-4401",
      sample: false,
    });
    const parsed = parseAiWork(mockAnalyze({
      messages: [{ role: "user", content: "Check the revenue transactions against the policy." }],
      evidence: [
        {
          evidenceId: withEvidence.evidence.artifactId,
          title: withEvidence.evidence.title,
          kind: "Ledger",
          filename: "q3-general-ledger.csv",
          extraction: "text",
          textExcerpt: "JE-4401",
        },
      ],
    }).response);
    const applied = applyAiTurn(withEvidence.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      prompt: "Check the revenue transactions against the policy.",
      reply: parsed.reply,
      actions: parsed.actions,
      provider: "mock",
      model: "veriaudit-mock",
      requestId: "mock-request",
      mode: "mock",
      status: "ok",
    });
    const messages = messagesFor(applied.state, created.audit.auditId, created.execution.executionId);
    const actions = actionsFor(applied.state, created.audit.auditId, created.execution.executionId);
    const findings = findingsFor(applied.state, created.audit.auditId, created.execution.executionId);
    expect(messages.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(actions.every((item) => item.executionId === created.execution.executionId)).toBe(true);
    expect(actions.every((item) => item.status === "completed")).toBe(true);
    expect(findings[0]?.origin).toBe("ai");
    expect(findings[0]?.review).toBe("pending");
    expect(findings[0]?.status).toBe("under_review");
    expect(findings[0]?.evidenceIds).toContain(withEvidence.evidence.artifactId);
    expect(findings[0]?.originatingActionId).toMatch(/^ACTN-LOCAL-/);
    expect(findings[0]?.executionId).toBe(created.execution.executionId);
  });

  it("does not let AI work cross into another execution", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Split",
      domain: "financial",
      description: "Sample",
    });
    const second = createExecution(created.state, created.audit.auditId);
    const applied = applyAiTurn(second.state, {
      auditId: created.audit.auditId,
      executionId: second.execution.executionId,
      prompt: "Summarize",
      reply: "Done",
      actions: [{ type: "SUMMARIZE", title: "Summarize", detail: "ok", evidenceIds: [] }],
      provider: "mock",
      model: "veriaudit-mock",
      requestId: null,
      mode: "mock",
      status: "ok",
    });
    expect(messagesFor(applied.state, created.audit.auditId, created.execution.executionId)).toEqual([]);
    expect(actionsFor(applied.state, created.audit.auditId, created.execution.executionId)).toEqual([]);
    expect(messagesFor(applied.state, created.audit.auditId, second.execution.executionId)).toHaveLength(2);
  });

  it("refuses the sealed hero original", () => {
    expect(() =>
      applyAiTurn(EMPTY_WORKSPACE, {
        auditId: HERO_AUDIT_ID,
        executionId: HERO_EXECUTION_ID,
        prompt: "x",
        reply: "x",
        actions: [],
        provider: "mock",
        model: "veriaudit-mock",
        requestId: null,
        mode: "mock",
        status: "ok",
      }),
    ).toThrow(/sealed original/i);
  });

  it("records failed analysis without creating a finding", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Down",
      domain: "legal",
      description: "Sample",
    });
    const applied = applyAiTurn(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      prompt: "Check",
      reply: "AI analysis is temporarily unavailable. Your audit workspace and existing records are safe.",
      actions: [],
      provider: "mock",
      model: "none",
      requestId: null,
      mode: "live",
      status: "unavailable",
    });
    expect(findingsFor(applied.state, created.audit.auditId, created.execution.executionId)).toEqual([]);
    expect(actionsFor(applied.state, created.audit.auditId, created.execution.executionId)[0]?.status).toBe("failed");
  });

  it("keeps AI findings unsealed and reviewable", () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Review",
      domain: "financial",
      description: "Sample",
    });
    const applied = applyAiTurn(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      prompt: "Check",
      reply: "Found one",
      actions: [
        {
          type: "CREATE_FINDING",
          title: "Create finding",
          detail: "exception",
          evidenceIds: [],
          findingTitle: "Revenue recognition exception",
          findingSeverity: "high",
          findingDescription: "Needs review",
        },
      ],
      provider: "mock",
      model: "veriaudit-mock",
      requestId: null,
      mode: "mock",
      status: "ok",
    });
    const finding = findingsFor(applied.state, created.audit.auditId)[0]!;
    const reviewed = reviewFinding(applied.state, finding.findingId, "accepted");
    expect(reviewed.finding.review).toBe("accepted");
    expect(applied.state.actions.every((item) => item.status !== "sealed" as string)).toBe(true);
  });

  it("leaves the hero reconstruction unchanged after AI work on a later execution", async () => {
    const before = await loadAuditWorkspace(HERO_AUDIT_ID);
    const reopened = createExecution(EMPTY_WORKSPACE, HERO_AUDIT_ID);
    const afterWork = applyAiTurn(reopened.state, {
      auditId: HERO_AUDIT_ID,
      executionId: reopened.execution.executionId,
      prompt: "Check",
      reply: "Local",
      actions: [{ type: "SUMMARIZE", title: "Note", detail: "ok", evidenceIds: [] }],
      provider: "mock",
      model: "veriaudit-mock",
      requestId: null,
      mode: "mock",
      status: "ok",
    });
    const after = await loadAuditWorkspace(HERO_AUDIT_ID);
    expect(after?.eventCount).toBe(HERO_ORIGINAL_EVENT_COUNT);
    expect(after?.events.map((event) => event.eventId)).toEqual(before?.events.map((event) => event.eventId));
    expect(snapshotExecution(catalogExecutions(HERO_AUDIT_ID)[0]!)).toEqual(HERO_ORIGINAL_SNAPSHOT);
    expect(heroOriginalUnchanged(afterWork.state)).toBe(true);
  });
});
