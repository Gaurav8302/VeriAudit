import Link from "next/link";
import { domainLabel, type WorkspaceAudit } from "@/lib/product/workspace";
import { WorkspaceNav } from "./WorkspaceNav";
import { WorkspaceStatus } from "./WorkspaceStatus";

export function WorkspaceFrame({
  audit,
  children,
}: {
  audit: WorkspaceAudit;
  children: React.ReactNode;
}) {
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
          </p>
        </div>
        <WorkspaceStatus auditId={audit.auditId} />
      </header>
      <WorkspaceNav auditId={audit.auditId} />
      {children}
    </div>
  );
}
