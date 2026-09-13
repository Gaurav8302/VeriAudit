import type { EvidenceChunk } from "./types";

const MAX_CHUNKS = 40;
const MAX_CHUNK_CHARS = 1_200;

function pad(value: number): string {
  return String(value).padStart(3, "0");
}

function stem(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (base.includes("POLICY") || base.includes("REV")) return "REV-POL";
  if (base.includes("LEDGER") || base.includes("JOURNAL")) return "LED";
  if (base.includes("CONTRACT") || base.includes("ADDENDUM") || base.includes("DPA")) return "LEG";
  if (base.includes("ACCESS") || base.includes("CONTROL") || base.includes("MFA")) return "CYB";
  if (base.includes("PURCHASE") || base.includes("PO-") || base.includes("VENDOR")) return "PRO";
  return base.slice(0, 8) || "DOC";
}

function chunkOf(
  prefix: string,
  index: number,
  text: string,
  locator: string,
  extra?: { section?: string | null; page?: number | null; row?: number | null },
): EvidenceChunk {
  return {
    chunkId: `${prefix}-${pad(index)}`,
    text: text.trim().slice(0, MAX_CHUNK_CHARS),
    locator,
    section: extra?.section ?? null,
    page: extra?.page ?? null,
    row: extra?.row ?? null,
  };
}

export function chunkText(filename: string, text: string, kind: "txt" | "csv" | "json" | "pdf"): EvidenceChunk[] {
  const prefix = stem(filename);
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];

  if (kind === "csv") return chunkCsv(prefix, trimmed);
  if (kind === "json") return chunkJson(prefix, trimmed);

  const sections = splitSections(trimmed);
  return sections.slice(0, MAX_CHUNKS).map((section, index) =>
    chunkOf(prefix, index + 1, section.body, section.locator, {
      section: section.heading,
      page: section.page,
    }),
  );
}

function splitSections(text: string): { heading: string | null; locator: string; body: string; page: number | null }[] {
  const pageSplit = text.split(/\n(?=Page\s+\d+)/i);
  if (pageSplit.length > 1) {
    return pageSplit.map((block) => {
      const pageMatch = block.match(/^Page\s+(\d+)/i);
      const page = pageMatch ? Number(pageMatch[1]) : null;
      const heading = headingOf(block);
      return {
        heading,
        page,
        locator: page ? `Page ${page}${heading ? ` · ${heading}` : ""}` : heading ?? "Section",
        body: block,
      };
    });
  }

  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    return [{ heading: headingOf(text), locator: headingOf(text) ?? "Document", body: text, page: null }];
  }
  return blocks.map((block) => {
    const heading = headingOf(block);
    return { heading, locator: heading ?? "Section", body: block, page: null };
  });
}

function headingOf(block: string): string | null {
  const line = block.split("\n")[0]?.trim() ?? "";
  if (/^(§|section|page|\d+\.|[A-Z][A-Z0-9 .:-]{3,})$/i.test(line) && line.length < 80) return line;
  return null;
}

function chunkCsv(prefix: string, text: string): EvidenceChunk[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const header = lines[0] ?? "";
  const rows = lines.slice(1);
  if (rows.length === 0) {
    return [chunkOf(prefix, 1, text, "Spreadsheet")];
  }
  return rows.slice(0, MAX_CHUNKS).map((row, index) => {
    const cells = row.split(",");
    const id = cells[0]?.trim() || `row ${index + 2}`;
    return chunkOf(prefix, index + 1, `${header}\n${row}`, `Row ${index + 2} · ${id}`, {
      section: id,
      row: index + 2,
    });
  });
}

function chunkJson(prefix: string, text: string): EvidenceChunk[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_CHUNKS).map((item, index) =>
        chunkOf(prefix, index + 1, JSON.stringify(item, null, 2), `Item ${index + 1}`, {
          section: `Item ${index + 1}`,
        }),
      );
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, unknown>)
        .slice(0, MAX_CHUNKS)
        .map(([key, value], index) =>
          chunkOf(prefix, index + 1, JSON.stringify({ [key]: value }, null, 2), key, { section: key }),
        );
    }
  } catch {
    // fall through
  }
  return [chunkOf(prefix, 1, text, "JSON")];
}

export function remapChunkIds(artifactId: string, chunks: readonly EvidenceChunk[]): EvidenceChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    chunkId: chunk.chunkId.includes(artifactId) ? chunk.chunkId : `${artifactId}:${chunk.chunkId}`,
  }));
}

export function fallbackChunks(
  artifactId: string,
  filename: string | null,
  excerpt: string | null,
): EvidenceChunk[] {
  if (!excerpt?.trim()) return [];
  const [first] = chunkText(filename ?? artifactId, excerpt, "txt");
  return first ? remapChunkIds(artifactId, [first]) : [];
}
