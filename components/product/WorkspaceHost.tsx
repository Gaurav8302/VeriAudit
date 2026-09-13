"use client";

import Link from "next/link";
import { asWorkspaceAudit } from "@/lib/product/localWorkspace";
import { domainLabel, type WorkspaceAudit } from "@/lib/product/workspace";
import { ExecutionSwitcher } from "./ExecutionSwitcher";
import { WorkspaceNav } from "./WorkspaceNav";
import { WorkspaceStatus } from "./WorkspaceStatus";
import { useWorkspace } from "./WorkspaceProvider";

export function WorkspaceHost({
  auditId,
  catalogAudit,
  children,
}: {
  auditId: string;
  catalogAudit: WorkspaceAudit | null;
  children: React.ReactNode;
}) {
  const workspace = useWorkspace();
  const local = workspace.localAudit(auditId);
  const audit = catalogAudit ?? (local ? asWorkspaceAudit(local, workspace.state) : null);

  if (!workspace.ready && !catalogAudit) {
    return <p className="va-empty">Loading workspace…</p>;
  }

  if (!audit) {
    return (
      <p className="va-empty">
        This audit is not in this workspace.{" "}
        <Link href="/product/audits">Return to audits</Link>.
      </p>
    );
  }

  return (
    <div className="va-workspace">
      <p className="va-crumb">
        <Link href="/product/audits">← Audits</Link>
      </p>
      <header className="va-workspace-head">
        <div>
          <h2>{audit.title}</h2>
          <p>
            {domainLabel(audit.domain)} · {audit.auditId}
            {audit.origin === "local" ? " · Local workspace" : ""}
          </p>
        </div>
        <WorkspaceStatus auditId={audit.auditId} />
      </header>
      <WorkspaceNav auditId={audit.auditId} />
      <ExecutionSwitcher auditId={audit.auditId} />
      {children}
    </div>
  );
}
