import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestFile } from "@/lib/ai/ingest";
import { corpusForPrompt, hasReadableEvidence, retrieveForPrompt } from "@/lib/ai/ground";
import { contextBlock } from "@/lib/ai/context";
import { analyzeExecution } from "@/lib/ai/analyze";
import { mockReplyFromEvidence } from "@/lib/ai/providers/mock";
import { remapChunkIds } from "@/lib/evidence/chunk";
import { sampleFilesFor } from "@/lib/evidence/samplePack";
import {
  SAMPLE_CONTROLS,
  SAMPLE_EVIDENCE,
  SAMPLE_EXCEPTIONS,
  SAMPLE_MISSING_CONTRACTS,
  SAMPLE_QUESTIONS,
} from "@/lib/product/sampleAudit";
import type { AiEvidenceContext } from "@/lib/ai/types";

function buildCorpus(): AiEvidenceContext[] {
  return sampleFilesFor("financial").map((file, index) => {
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), "public", file.path)));
    const parsed = ingestFile({ name: file.filename, type: "text/plain", bytes });
    const artifactId = `ART-LOCAL-${String(index + 1).padStart(3, "0")}`;
    return {
      evidenceId: artifactId,
      title: file.filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      kind: file.kind,
      filename: parsed.filename,
      extraction: parsed.extraction,
      textExcerpt: parsed.chunks.length ? null : parsed.textExcerpt,
      chunks: remapChunkIds(artifactId, parsed.chunks),
    };
  });
}

const corpus = buildCorpus();
const allText = corpus
  .flatMap((item) => (item.chunks ?? []).map((chunk) => chunk.text))
  .join("\n");

describe("sample financial corpus", () => {
  it("ships the ledger, both customer contracts, and the policy", () => {
    const filenames = sampleFilesFor("financial").map((item) => item.filename);
    expect(filenames).toEqual([
      "q3-general-ledger.csv",
      "customer-contract-c-1001.txt",
      "customer-contract-c-1002.txt",
      "revenue-recognition-policy.txt",
    ]);
    // Every file the mapping promises is actually in the pack.
    for (const spec of SAMPLE_EVIDENCE) {
      expect(filenames).toContain(spec.filename);
    }
  });

  it("covers the period the sample audit claims to test", () => {
    // A September audit must not ship a Q4 ledger.
    expect(allText).toMatch(/2026-09/);
    expect(allText).not.toMatch(/2026-Q4/);
  });

  it("contains the contracts and the exception the prompts ask about", () => {
    expect(allText).toMatch(/C-1001/);
    expect(allText).toMatch(/C-1002/);
    expect(allText).toMatch(/1,?420,?000/);
    expect(allText).toMatch(/not_delivered/);
    // The preparer and approver collide on the material entry.
    expect(allText).toMatch(/JE-4401.*A\. Ruiz,A\. Ruiz/);
  });

  it("references contracts that are deliberately not attached", () => {
    for (const missing of SAMPLE_MISSING_CONTRACTS) {
      expect(allText).toMatch(new RegExp(missing));
      const attached = corpus.some((item) => item.filename?.includes(missing.toLowerCase()));
      expect(attached).toBe(false);
    }
  });

  it("every declared exception names a control that exists", () => {
    const ids = new Set(SAMPLE_CONTROLS.map((item) => item.controlId));
    for (const exception of SAMPLE_EXCEPTIONS) {
      expect(allText).toMatch(new RegExp(exception.entryId));
      for (const controlId of exception.controlIds) {
        expect(ids.has(controlId)).toBe(true);
      }
    }
  });

  it("is readable, so the assistant is never told nothing is attached", () => {
    expect(hasReadableEvidence(corpus)).toBe(true);
    expect(corpusForPrompt(corpus).length).toBeGreaterThan(0);
  });
});

describe("sample prompt matrix", () => {
  it("gives the model real evidence for every supported question", () => {
    for (const prompt of SAMPLE_QUESTIONS) {
      const ranked = retrieveForPrompt(prompt, corpus);
      const used = ranked.length > 0 ? ranked : corpusForPrompt(corpus);
      // No supported question may reach the model with an empty corpus.
      expect(used.length, `no evidence for: ${prompt}`).toBeGreaterThan(0);
      expect(used.every((hit) => corpus.some((item) => item.evidenceId === hit.evidenceId))).toBe(true);
    }
  });

  it("retrieval finds the contracts and the exception directly", () => {
    const contracts = retrieveForPrompt("Which contracts are present?", corpus);
    expect(contracts.length).toBeGreaterThan(0);
    const contractFiles = new Set(contracts.map((hit) => hit.filename));
    expect([...contractFiles].some((name) => name?.includes("c-1001"))).toBe(true);

    const exception = retrieveForPrompt("Explain the $1,420,000 exception.", corpus);
    expect(exception.some((hit) => hit.text.includes("1420000") || hit.text.includes("1,420,000"))).toBe(true);
  });

  it("never answers a supported question with the no-evidence message", async () => {
    for (const prompt of SAMPLE_QUESTIONS) {
      const result = await analyzeExecution({ prompt, evidence: corpus });
      expect(result.work.reply, `refused: ${prompt}`).not.toMatch(/No readable evidence is attached/);
      expect(result.work.reply, `refused: ${prompt}`).not.toMatch(/couldn't find enough evidence/);
      expect(result.work.reply.length).toBeGreaterThan(0);
    }
  });

  it("answers each supported question from the attached corpus", () => {
    expect(mockReplyFromEvidence("Which contracts are present?", corpus)).toMatch(/C-1001/);
    expect(mockReplyFromEvidence("Which contracts are present?", corpus)).toMatch(/C-1002/);
    expect(mockReplyFromEvidence("Which contracts are missing evidence?", corpus)).toMatch(/C-1003/);
    expect(mockReplyFromEvidence("Which contracts are missing evidence?", corpus)).toMatch(/C-1004/);
    expect(mockReplyFromEvidence("Find revenue recognition exceptions.", corpus)).toMatch(/JE-4401/);
    expect(mockReplyFromEvidence("Explain the $1,420,000 exception.", corpus)).toMatch(/REV-REC-02/);
    expect(mockReplyFromEvidence("Why was this transaction flagged?", corpus)).toMatch(/JE-4401|C-1001/);
    expect(mockReplyFromEvidence("Which control was violated?", corpus)).toMatch(/REV-REC-02/);
    expect(mockReplyFromEvidence("Summarize the current audit.", corpus)).toMatch(/q3-general-ledger|C-1001/);
    expect(mockReplyFromEvidence("Review the uploaded revenue evidence.", corpus)).toMatch(/JE-4401|1,420,000|1420000/);
  });
});

describe("ai workspace context", () => {
  it("describes the audit, its controls, and every attached artifact", () => {
    const block = contextBlock(
      {
        auditId: "AUD-SAMPLE-FIN",
        auditTitle: "September Revenue Recognition Audit",
        domain: "Financial",
        period: "2026-09",
        objective: "Test September revenue recognition.",
        executionId: "EXEC-SAMPLE-FIN-001",
        executionLabel: "Execution 001",
        executionStatus: "open",
        controls: SAMPLE_CONTROLS.map((item) => ({
          controlId: item.controlId,
          title: item.title,
          requirement: item.requirement,
        })),
        findings: [
          { findingId: "F-LOCAL-001", title: "Revenue recognition exception", severity: "high", review: "pending" },
        ],
        recentEvents: ["09:00 Evidence added: q3 general ledger"],
      },
      corpus,
    );

    expect(block).toMatch(/September Revenue Recognition Audit/);
    expect(block).toMatch(/Execution 001/);
    expect(block).toMatch(/REV-SOD-01/);
    expect(block).toMatch(/CONTROLS IN SCOPE/);
    expect(block).toMatch(/EVIDENCE ATTACHED TO THIS EXECUTION/);
    expect(block).toMatch(/customer-contract-c-1001\.txt/);
    expect(block).toMatch(/F-LOCAL-001/);
    expect(block).toMatch(/human review=pending/);
  });

  it("states plainly when nothing is attached", () => {
    expect(contextBlock({ auditTitle: "Empty" }, [])).toMatch(/No evidence is attached/);
  });
});
