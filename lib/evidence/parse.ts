function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "").trim();
}

export function extractPdfText(bytes: Uint8Array): string | null {
  const source = Buffer.from(bytes).toString("latin1");
  if (!source.startsWith("%PDF")) return null;
  const parts: string[] = [];
  const literal = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(source))) {
    const raw = match[0].slice(1, -1);
    const text = raw
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\t/g, " ")
      .replace(/\\(.)/g, "$1")
      .replace(/[^\S\n]+/g, " ")
      .trim();
    if (text.length >= 4 && /[A-Za-z]/.test(text)) parts.push(text);
  }
  const joined = parts.join("\n").trim();
  const letters = (joined.match(/[A-Za-z]/g) ?? []).length;
  return letters >= 40 ? joined : null;
}

export function parseDocumentText(filename: string, mimeType: string, bytes: Uint8Array): {
  kind: "txt" | "csv" | "json" | "pdf" | "xlsx";
  text: string | null;
} {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json" || mimeType === "application/json") {
    const text = decodeText(bytes);
    JSON.parse(text);
    return { kind: "json", text };
  }
  if (ext === "csv" || mimeType === "text/csv") {
    return { kind: "csv", text: decodeText(bytes) };
  }
  if (ext === "txt" || mimeType === "text/plain") {
    return { kind: "txt", text: decodeText(bytes) };
  }
  if (ext === "pdf" || mimeType === "application/pdf") {
    return { kind: "pdf", text: extractPdfText(bytes) };
  }
  return { kind: "xlsx", text: null };
}
