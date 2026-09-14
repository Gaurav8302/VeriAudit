import { INSUFFICIENT_EVIDENCE } from "@/lib/evidence";
import type { AiChatRequest, AiEvidenceContext, NormalizedAiResponse } from "../types";

function corpusText(evidence: readonly AiEvidenceContext[]): string {
  return evidence
    .flatMap((item) => [
      item.filename ?? "",
      item.title,
      item.textExcerpt ?? "",
      ...(item.chunks ?? []).map((chunk) => chunk.text),
    ])
    .join("\n");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function contractIdsIn(text: string): string[] {
  return unique((text.match(/C-\d{4}/gi) ?? []).map((item) => item.toUpperCase()));
}

function attachedContractIds(evidence: readonly AiEvidenceContext[]): string[] {
  const fromFiles = evidence
    .filter(
      (item) =>
        item.kind === "Contract" ||
        (item.filename ?? item.title).toLowerCase().includes("contract"),
    )
    .flatMap((item) => contractIdsIn(`${item.filename ?? ""} ${item.title} ${item.textExcerpt ?? ""}`));
  return unique(fromFiles);
}

function ledgerContractRefs(text: string): string[] {
  return unique(
    [...text.matchAll(/JE-\d+,[^,]+,[^,]+,(C-\d{4})/g)].map((match) => match[1]!),
  );
}

function exceptionRows(text: string): { entry: string; amount: string; contract: string; delivery: string }[] {
  const rows: { entry: string; amount: string; contract: string; delivery: string }[] = [];
  for (const match of text.matchAll(
    /(JE-\d+),4000 Revenue,[^,]+,(C-\d{4}),(\d+),[^,]+,[^,]+,(not_delivered|partial)/g,
  )) {
    rows.push({
      entry: match[1]!,
      contract: match[2]!,
      amount: match[3]!,
      delivery: match[4]!,
    });
  }
  return rows;
}

/**
 * Mock answers are derived from the attached corpus, not from a prompt→reply
 * table. If the evidence is not present, the mock says so.
 */
export function mockReplyFromEvidence(prompt: string, evidence: readonly AiEvidenceContext[]): string {
  const question = prompt.toLowerCase();
  const text = corpusText(evidence);
  const attached = attachedContractIds(evidence);
  const ledgerRefs = ledgerContractRefs(text);
  const missing = ledgerRefs.filter((id) => !attached.includes(id));
  const exceptions = exceptionRows(text);
  const files = evidence.map((item) => item.filename ?? item.title);

  if (question.includes("which contract") && question.includes("present")) {
    if (attached.length === 0) {
      return "No customer-contract files are attached to this execution.";
    }
    return `I found ${attached.length} contract${attached.length === 1 ? "" : "s"} in the current evidence set: ${attached.join(" and ")}.`;
  }

  if (question.includes("missing")) {
    if (missing.length === 0) {
      return ledgerRefs.length
        ? "Every contract referenced by the attached ledger has a matching contract file."
        : "The attached evidence does not list contract references I can compare.";
    }
    return `Contracts ${missing.join(" and ")} are referenced by the ledger but have no attached contract file.`;
  }

  if (question.includes("1,420,000") || question.includes("1420000") || question.includes("$1,420,000")) {
    if (!/1,?420,?000|1420000/.test(text)) {
      return "The attached evidence does not contain a $1,420,000 entry.";
    }
    return "JE-4401 recognised $1,420,000 against contract C-1001 while delivery_status is not_delivered. A. Ruiz is both preparer and approver. That violates REV-REC-02 (no recognition on undelivered goods), REV-SOD-01 (segregation of duties), and REV-APV-01 (second reviewer above $250,000).";
  }

  if (question.includes("control") && (question.includes("violat") || question.includes("which"))) {
    if (exceptions.length === 0) {
      return "The attached evidence does not identify a control violation I can cite.";
    }
    return "REV-REC-02 is violated where revenue is recognised without delivery. REV-SOD-01 is violated where the same person prepared and approved a material entry. REV-DOC-01 is violated where a ledger contract has no attached contract file.";
  }

  if (question.includes("flagged") || question.includes("why was")) {
    if (exceptions.length === 0) {
      return "The attached evidence does not show why a transaction was flagged.";
    }
    const first = exceptions[0]!;
    return `${first.entry} was flagged because ${first.amount} was recognised against ${first.contract} while delivery_status is ${first.delivery.replace("_", " ")}.`;
  }

  if (question.includes("exception")) {
    if (exceptions.length === 0) {
      return "I did not find a revenue-recognition exception in the attached evidence.";
    }
    return `I found ${exceptions.length} revenue recognition exception${exceptions.length === 1 ? "" : "s"}: ${exceptions
      .map((row) => `${row.entry} (${row.contract}, $${Number(row.amount).toLocaleString("en-US")}, ${row.delivery.replace("_", " ")})`)
      .join("; ")}.`;
  }

  if (question.includes("summarize") || question.includes("summarise") || question.includes("current audit")) {
    return `This execution has ${files.length} attached artifact${files.length === 1 ? "" : "s"} (${files.join(", ")}). ${
      attached.length ? `Contracts present: ${attached.join(", ")}.` : ""
    } ${missing.length ? `Contracts missing files: ${missing.join(", ")}.` : ""} ${
      exceptions.length ? `${exceptions.length} ledger row(s) look like recognition exceptions.` : ""
    }`.replace(/\s+/g, " ").trim();
  }

  if (question.includes("review")) {
    return `I reviewed the attached evidence: ${files.join("; ")}. ${
      exceptions.length
        ? `Material exceptions include ${exceptions[0]!.entry} for $${Number(exceptions[0]!.amount).toLocaleString("en-US")}.`
        : "I did not find a clear recognition exception in the readable text."
    }`;
  }

  return `Based on ${files.join(" and ")}, I found items that need human review.`;
}

export function mockAnalyze(request: AiChatRequest): NormalizedAiResponse {
  const evidence = request.evidence;
  const names = evidence.map((item) => item.filename ?? item.title);
  const ids = evidence.map((item) => item.evidenceId);
  const chunks = evidence.flatMap((item) => item.chunks ?? []);
  const lastUser = [...request.messages].reverse().find((item) => item.role === "user")?.content ?? "";
  const question = lastUser.match(/Question:\s*([^\n]+)/)?.[1]?.trim() ?? lastUser;
  const grounded = evidence.length === 0 ? INSUFFICIENT_EVIDENCE : mockReplyFromEvidence(question, evidence);
  const text = corpusText(evidence);
  const hasMaterialException = /1420000|1,420,000/.test(text);

  const reply = JSON.stringify({
    reply: grounded,
    confidence: evidence.length === 0 ? "none" : "medium",
    evidenceReferences: chunks.slice(0, 3).map((chunk) => {
      const parent = evidence.find((item) => item.chunks?.some((row) => row.chunkId === chunk.chunkId));
      return {
        evidenceId: parent?.evidenceId ?? ids[0],
        chunkId: chunk.chunkId,
        label: `${parent?.filename ?? parent?.title ?? "Evidence"} · ${chunk.locator}`,
        excerpt: chunk.text.slice(0, 160),
      };
    }),
    actions:
      evidence.length === 0
        ? [
            {
              type: "SEARCH_EVIDENCE",
              title: "Evidence search",
              detail: "No evidence was attached.",
              evidenceIds: [],
            },
          ]
        : [
            ...evidence.map((item) => ({
              type: "READ_EVIDENCE",
              title: `Read ${item.title}`,
              detail: item.extraction === "text" ? "Used retrieved text" : "Used evidence metadata only",
              evidenceIds: [item.evidenceId],
              chunkIds: (item.chunks ?? []).map((chunk) => chunk.chunkId),
            })),
            {
              type: "ANALYZE_EVIDENCE",
              title: "Analyze attached evidence",
              detail: "Compared the retrieved sections for exceptions.",
              evidenceIds: ids,
              chunkIds: chunks.map((item) => item.chunkId),
            },
            {
              type: "CREATE_FINDING",
              title: "Create finding",
              detail: "Proposed an exception for human review.",
              evidenceIds: ids,
              chunkIds: chunks.map((item) => item.chunkId),
              findingTitle: hasMaterialException
                ? "Revenue recognition exception"
                : "Exception proposed from retrieved evidence",
              findingSeverity: "high",
              findingDescription: hasMaterialException
                ? "JE-4401 recognised $1,420,000 against C-1001 before the related performance obligation was satisfied."
                : "The retrieved evidence supports an exception that a person should accept, modify, or reject.",
            },
            {
              type: "REQUEST_HUMAN_REVIEW",
              title: "Request human review",
              detail: "AI proposals are not approved automatically.",
              evidenceIds: ids,
            },
          ],
  });

  return {
    provider: "mock",
    model: "veriaudit-mock",
    response: reply,
    usage: { promptTokens: 0, completionTokens: 0 },
    latencyMs: 12,
    requestId: "mock-request",
    status: "ok",
    mode: "mock",
  };
}
