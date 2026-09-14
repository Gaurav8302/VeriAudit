import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pageMeta } from "@/lib/product/pageMeta";
import { TERMS } from "@/lib/product/terms";

function source(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("AI frontline product UX", () => {
  it("positions the home and create pages as AI-assisted audit work", () => {
    expect(pageMeta("/product").lede).toMatch(/AI-powered audit work/i);
    expect(pageMeta("/product/audits/new").lede).toMatch(/AI assistant/i);
    expect(pageMeta("/product/audits/AUD-FIN-2026-09/ai").chrome).toBe("Workspace");
    expect(TERMS.assistant).toMatch(/records those actions on the execution/i);
  });

  it("keeps the assistant on the workspace frontline without claiming sealing per action", () => {
    const workspace = source("components/product/AiWorkspace.tsx");
    const create = source("components/product/CreateAuditForm.tsx");
    const nav = source("components/product/WorkspaceNav.tsx");
    expect(workspace).toMatch(/AI audit assistant/);
    expect(workspace).toMatch(/Ask AI/);
    // The recorded-to copy names the execution, e.g. "Recorded to Execution 001".
    expect(workspace).toMatch(/Recorded to \{executionLabel\}/);
    expect(workspace).not.toMatch(/cryptographically sealed until/);
    expect(create).toMatch(/AI audit assistant/);
    expect(nav).toMatch(/Workspace/);
    expect(nav.indexOf("/evidence")).toBeLessThan(nav.indexOf("/trace"));
  });
});
