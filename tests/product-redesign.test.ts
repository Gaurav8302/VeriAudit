import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isAuditWorkspace, isStudioWorkspace, pageMeta } from "@/lib/product/pageMeta";

function source(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("product redesign information architecture", () => {
  it("simplifies global navigation to primary, investigation, and secondary", () => {
    const shell = source("components/product/AppShell.tsx");
    expect(shell.indexOf("Home")).toBeLessThan(shell.indexOf("Audits"));
    expect(shell.indexOf("Audits")).toBeLessThan(shell.indexOf("Create Audit"));
    expect(shell).toMatch(/Investigation/);
    expect(shell).toMatch(/Activity/);
    expect(shell).not.toMatch(/href: "\/product\/traces"/);
  });

  it("keeps the audit workspace as the primary destination instead of an AI tab", () => {
    const nav = source("components/product/WorkspaceNav.tsx");
    expect(nav).toMatch(/Workspace/);
    expect(nav).toMatch(/Evidence/);
    expect(nav).toMatch(/Findings/);
    expect(nav).toMatch(/Activity/);
    expect(nav).not.toMatch(/AI Assistant/);
    expect(nav.indexOf("/evidence")).toBeLessThan(nav.indexOf("/trace"));
  });

  it("embeds the audit copilot and live ledger in the workspace", () => {
    const overview = source("components/product/AuditOverview.tsx");
    const host = source("components/product/WorkspaceHost.tsx");
    const assistant = source("components/product/AiWorkspace.tsx");
    const css = source("components/product/app.css");
    expect(overview).toMatch(/AiWorkspace/);
    expect(host).toMatch(/LiveExecutionLedger/);
    expect(host).toMatch(/va-studio/);
    expect(css).toMatch(/va-studio/);
    // The trace rail is widened so live activity stays visible beside the chat.
    expect(css).toMatch(/minmax\(0, 1fr\) 22rem/);
    expect(assistant).toMatch(/AI audit assistant/);
    expect(assistant).toMatch(/Ask VeriAudit/);
    // The recorded-to copy names the execution, e.g. "Recorded to Execution 001".
    expect(assistant).toMatch(/Recorded to \{executionLabel\}/);
    expect(assistant).toMatch(/Ask AI/);
    expect(assistant).toMatch(/\+ Add evidence/);
  });

  it("exposes first-class seal and verify actions that call the real APIs", () => {
    const command = source("components/product/WorkspaceCommand.tsx");
    const ledger = source("components/product/LiveExecutionLedger.tsx");
    const panel = source("components/product/SealPanel.tsx");
    expect(ledger).toMatch(/Live activity/);
    expect(ledger).toMatch(/Execution history/);
    expect(ledger).toMatch(/SealPanel/);
    const hook = source("components/product/useExecutionTrust.ts");
    expect(command).toMatch(/Seal execution/);
    expect(panel).toMatch(/Pre-seal checks/);
    expect(hook).toMatch(/\/api\/product\/executions\/seal/);
    expect(hook).toMatch(/\/api\/product\/executions\/verify/);
    expect(hook).toMatch(/verification\?\.status === "verified"/);
    expect(hook).not.toMatch(/verdict\.ok/);
  });

  it("keeps product page titles distinct from workspace chrome", () => {
    expect(pageMeta("/product").lede).toMatch(/AI-powered audit work/i);
    expect(pageMeta("/product/audits").title).toBe("Audits");
    expect(pageMeta("/product/executions").lede).toMatch(/not the same as an audit/i);
    expect(pageMeta("/product/audits/AUD-FIN-2026-09/executions/EXEC-FIN-2026-09-001").chrome).toBe("Execution");
    expect(isAuditWorkspace("/product/audits/AUD-FIN-2026-09")).toBe(true);
    expect(isStudioWorkspace("/product/audits/AUD-FIN-2026-09")).toBe(true);
    expect(isStudioWorkspace("/product/audits/AUD-FIN-2026-09/ai")).toBe(true);
    expect(isStudioWorkspace("/product/audits/AUD-FIN-2026-09/evidence")).toBe(false);
  });
});
