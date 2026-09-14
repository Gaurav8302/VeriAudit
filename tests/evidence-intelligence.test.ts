import { describe, expect, it } from "vitest";
import { analyzeExecution } from "@/lib/ai/analyze";
import { fingerprintBytes, ingestFile } from "@/lib/ai/ingest";
import { parseAiWork } from "@/lib/ai/parseActions";
import { NO_EVIDENCE_ATTACHED, validateReferences } from "@/lib/ai/ground";
import { fallbackChunks } from "@/lib/evidence/chunk";
import { ProviderError } from "@/lib/ai/errors";
import { runGateway } from "@/lib/ai/gateway";
import { chunkText } from "@/lib/evidence/chunk";
import { extractPdfText } from "@/lib/evidence/parse";
import { retrieveChunks } from "@/lib/evidence/retrieve";
import { INSUFFICIENT_EVIDENCE } from "@/lib/evidence/types";
import {
  addEvidence,
  applyAiTurn,
  createAudit,
  EMPTY_WORKSPACE,
  findingsFor,
  actionsFor,
} from "@/lib/product/localWorkspace";

function pdfWithText(text: string): Uint8Array {
  const body = `BT (${text}) Tj ET`;
  return new TextEncoder().encode(`%PDF-1.4\n${body}`);
}

describe("evidence intelligence", () => {
  it("fingerprints and parses text, csv, and json", () => {
    const bytes = new TextEncoder().encode("entry_id,amount\nREV-1042,1420000");
    const csv = ingestFile({
      name: "q4-general-ledger.csv",
      type: "text/csv",
      bytes,
    });
    expect(csv.fingerprint).toBe(fingerprintBytes(bytes));
    expect(csv.processingStatus).toBe("ready");
    expect(csv.kind).toBe("Ledger");
    expect(csv.chunks.some((item) => item.text.includes("REV-1042"))).toBe(true);

    const contract = ingestFile({
      name: "customer-contract-c-1001.txt",
      type: "text/plain",
      bytes: new TextEncoder().encode("Contract C-1001 milestone M2."),
    });
    expect(contract.kind).toBe("Contract");

    const json = ingestFile({
      name: "controls.json",
      type: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify({ mfa: "missing", account: "svc-backup" })),
    });
    expect(json.extraction).toBe("text");
    expect(json.chunks.length).toBeGreaterThan(0);
  });

  it("does not invent PDF text when none can be extracted", () => {
    const empty = ingestFile({
      name: "policy.pdf",
      type: "application/pdf",
      bytes: new Uint8Array([37, 80, 68, 70, 45, 49]),
    });
    expect(empty.extraction).toBe("unavailable");
    expect(empty.textExcerpt).toBeNull();
    expect(extractPdfText(empty.filename ? new Uint8Array([37, 80, 68, 70, 45, 49]) : new Uint8Array())).toBeNull();

    const readable = ingestFile({
      name: "policy.pdf",
      type: "application/pdf",
      bytes: pdfWithText("Revenue is recognised only after recorded delivery confirmation."),
    });
    expect(readable.extraction).toBe("text");
    expect(readable.chunks[0]?.text).toMatch(/Revenue is recognised/);
  });

  it("creates addressable chunks for policy sections and ledger rows", () => {
    const policy = chunkText(
      "revenue-recognition-policy.txt",
      "Page 7\nSection 4.2 Recognition Criteria\nDo not recognise undelivered shipments.",
      "txt",
    );
    expect(policy[0]?.chunkId).toMatch(/REV-POL-/);
    expect(policy[0]?.locator).toMatch(/Page 7/);
    const ledger = chunkText(
      "q4-general-ledger.csv",
      "entry_id,amount\nREV-1042,1420000\nJE-4403,95000",
      "csv",
    );
    expect(ledger).toHaveLength(2);
    expect(ledger[0]?.row).toBe(2);
    expect(ledger[0]?.section).toBe("REV-1042");
  });

  it("ranks relevant chunks deterministically", () => {
    const docs = [
      {
        evidenceId: "ART-1",
        title: "Revenue Recognition Policy",
        filename: "revenue-recognition-policy.txt",
        chunks: chunkText(
          "revenue-recognition-policy.txt",
          "Page 7\nSection 4.2 Recognition Criteria\nMilestone M2 is satisfied only after recorded delivery.",
          "txt",
        ),
      },
      {
        evidenceId: "ART-2",
        title: "Q4 General Ledger",
        filename: "q4-general-ledger.csv",
        chunks: chunkText(
          "q4-general-ledger.csv",
          "entry_id,delivery_status\nREV-1042,not_delivered\nJE-4403,delivered",
          "csv",
        ),
      },
    ];
    const first = retrieveChunks("Why was transaction REV-1042 flagged?", docs);
    expect(first[0]?.section).toBe("REV-1042");
    const second = retrieveChunks("Why was transaction REV-1042 flagged?", docs);
    expect(second.map((item) => item.chunkId)).toEqual(first.map((item) => item.chunkId));
    const policyHits = retrieveChunks("Check these revenue transactions against the recognition policy.", docs);
    expect(policyHits.some((item) => item.evidenceId === "ART-1")).toBe(true);
    expect(policyHits.some((item) => item.evidenceId === "ART-2")).toBe(true);
  });

  it("says nothing is attached only when no readable evidence exists", async () => {
    const empty = await analyzeExecution({
      prompt: "Does this contract contain the required approval clause?",
      evidence: [],
    });
    expect(empty.work.reply).toBe(NO_EVIDENCE_ATTACHED);
    expect(empty.work.grounding).toBe("insufficient");
    expect(empty.work.evidenceReferences).toEqual([]);

    const unreadable = await analyzeExecution({
      prompt: "Does this contract contain the required approval clause?",
      evidence: [
        {
          evidenceId: "ART-XLSX",
          title: "Workbook",
          kind: "Ledger",
          filename: "ledger.xlsx",
          extraction: "unavailable",
          textExcerpt: null,
          chunks: [],
        },
      ],
    });
    expect(unreadable.work.reply).toBe(NO_EVIDENCE_ATTACHED);
    expect(unreadable.work.grounding).toBe("insufficient");
  });

  it("still consults the model when evidence is attached but no passage scores a hit", async () => {
    // A retrieval miss must not become a refusal: the corpus is real and small,
    // so the model receives it and answers from what is actually attached.
    const result = await analyzeExecution({
      prompt: "Summarize the current audit.",
      evidence: [
        {
          evidenceId: "ART-LEDGER",
          title: "Empty note",
          kind: "Other",
          filename: "note.txt",
          extraction: "text",
          textExcerpt: "Office lunch roster for September.",
        },
      ],
    });
    expect(retrieveChunks("Summarize the current audit.", [
      { evidenceId: "ART-LEDGER", title: "Empty note", filename: "note.txt", chunks: fallbackChunks("ART-LEDGER", "note.txt", "Office lunch roster for September.") },
    ])).toHaveLength(0);
    expect(result.work.reply).not.toBe(INSUFFICIENT_EVIDENCE);
    expect(result.work.reply).not.toBe(NO_EVIDENCE_ATTACHED);
    expect(result.work.reply.length).toBeGreaterThan(0);
  });

  it("normalizes a model reply and drops invented evidence references", () => {
    const parsed = parseAiWork(
      JSON.stringify({
        reply: "Invented citation",
        evidenceReferences: [
          { evidenceId: "ART-FAKE", chunkId: "FAKE-1", label: "nope", excerpt: "nope" },
          { evidenceId: "ART-1", chunkId: "ART-1:REV-POL-001", label: "ok", excerpt: "delivery" },
        ],
      }),
    );
    const hits = [
      {
        evidenceId: "ART-1",
        chunkId: "ART-1:REV-POL-001",
        text: "delivery required",
        locator: "Page 7",
        section: "4.2",
        page: 7,
        row: null,
        filename: "policy.txt",
        title: "Policy",
        score: 4,
      },
    ];
    const refs = validateReferences(parsed.evidenceReferences ?? [], hits);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.chunkId).toBe("ART-1:REV-POL-001");
    expect(refs.some((item) => item.evidenceId === "ART-FAKE")).toBe(false);
  });

  it("records retrieval, analysis, and a human-reviewed finding linked to evidence", async () => {
    const created = createAudit(EMPTY_WORKSPACE, {
      title: "Revenue check",
      domain: "financial",
      description: "Sample",
    });
    const policy = ingestFile({
      name: "revenue-recognition-policy.txt",
      type: "text/plain",
      bytes: new TextEncoder().encode(
        "Page 7\nSection 4.2 Recognition Criteria\nDo not recognise revenue for undelivered shipments. REV-1042 requires delivery.",
      ),
    });
    const ledger = ingestFile({
      name: "q4-general-ledger.csv",
      type: "text/csv",
      bytes: new TextEncoder().encode("entry_id,delivery_status,approver,preparer\nREV-1042,not_delivered,A. Ruiz,A. Ruiz"),
    });
    const withPolicy = addEvidence(created.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      title: "Revenue Recognition Policy",
      kind: "Policy",
      source: "Upload",
      description: policy.note,
      filename: policy.filename,
      fingerprint: policy.fingerprint,
      extraction: policy.extraction,
      textExcerpt: policy.textExcerpt,
      chunks: policy.chunks,
      sample: false,
    });
    const withLedger = addEvidence(withPolicy.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      title: "Q4 General Ledger",
      kind: "Ledger",
      source: "Upload",
      description: ledger.note,
      filename: ledger.filename,
      fingerprint: ledger.fingerprint,
      extraction: ledger.extraction,
      textExcerpt: ledger.textExcerpt,
      chunks: ledger.chunks,
      sample: false,
    });
    const analyzed = await analyzeExecution({
      prompt: "Check these revenue transactions against the recognition policy.",
      evidence: [withPolicy.evidence, withLedger.evidence].map((item) => ({
        evidenceId: item.artifactId,
        title: item.title,
        kind: item.kind,
        filename: item.filename,
        extraction: item.extraction,
        textExcerpt: null,
        chunks: item.chunks,
      })),
    });
    expect(analyzed.work.grounding).toBe("evidence-backed");
    expect(analyzed.work.evidenceReferences?.every((item) =>
      [withPolicy.evidence.artifactId, withLedger.evidence.artifactId].includes(item.evidenceId),
    )).toBe(true);
    const applied = applyAiTurn(withLedger.state, {
      auditId: created.audit.auditId,
      executionId: created.execution.executionId,
      prompt: "Check these revenue transactions against the recognition policy.",
      reply: analyzed.work.reply,
      actions: analyzed.work.actions,
      provider: analyzed.response.provider,
      model: analyzed.response.model,
      requestId: analyzed.response.requestId,
      mode: analyzed.response.mode,
      status: "ok",
      grounding: analyzed.work.grounding,
      references: analyzed.work.evidenceReferences,
    });
    const actions = actionsFor(applied.state, created.audit.auditId, created.execution.executionId);
    const finding = findingsFor(applied.state, created.audit.auditId, created.execution.executionId)[0];
    expect(actions.some((item) => item.type === "SEARCH_EVIDENCE")).toBe(true);
    expect(actions.some((item) => item.type === "ANALYZE_EVIDENCE")).toBe(true);
    expect(finding?.review).toBe("pending");
    expect(finding?.evidenceIds.length).toBeGreaterThan(0);
    expect(finding?.originatingActionId).toMatch(/^ACTN-LOCAL-/);
  });

  it("keeps provider fallback returning one response", async () => {
    const result = await runGateway(
      { messages: [{ role: "user", content: "Check" }], evidence: [] },
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
