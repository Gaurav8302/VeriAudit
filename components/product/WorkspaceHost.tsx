"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { asWorkspaceAudit } from "@/lib/product/localWorkspace";
import { isStudioWorkspace } from "@/lib/product/pageMeta";
import { domainLabel, type WorkspaceAudit } from "@/lib/product/workspace";
import { ExecutionSwitcher } from "./ExecutionSwitcher";
import { LiveExecutionLedger } from "./LiveExecutionLedger";
import { WorkspaceCommand } from "./WorkspaceCommand";
import { WorkspaceNav } from "./WorkspaceNav";
import { WorkspaceStatus } from "./WorkspaceStatus";
import { useAuditPhase } from "./useAuditPhase";
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
  const pathname = usePathname();
  const studio = isStudioWorkspace(pathname);
  const workspace = useWorkspace();
  const { execution } = useAuditPhase(auditId);
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

  if (studio) {
    return (
      <div className="va-studio">
        <div className="va-studio-center">{children}</div>
        <LiveExecutionLedger auditId={audit.auditId} title={audit.title} domain={domainLabel(audit.domain)} />
      </div>
    );
  }

  return (
    <div className="va-workspace">
      <p className="va-crumb">
        <Link href={`/product/audits/${audit.auditId}`}>← Workspace</Link>
      </p>
      <header className="va-workspace-head">
        <div>
          <h2>{audit.title}</h2>
          <p>
            {domainLabel(audit.domain)} · {audit.auditId}
            {execution ? ` · ${execution.label}` : ""}
          </p>
        </div>
        <WorkspaceStatus auditId={audit.auditId} />
      </header>
      <WorkspaceCommand auditId={audit.auditId} />
      <WorkspaceNav auditId={audit.auditId} />
      <ExecutionSwitcher auditId={audit.auditId} />
      {children}
    </div>
  );
}
