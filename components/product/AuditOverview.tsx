"use client";

import Link from "next/link";
import type { AuditWorkspaceData } from "@/lib/product/load";
import { isSampleAudit } from "@/lib/product/localWorkspace";
import { AiWorkspace } from "./AiWorkspace";
import { useWorkspace } from "./WorkspaceProvider";

export function AuditOverview({
  auditId,
  catalog,
}: {
  auditId: string;
  catalog: AuditWorkspaceData | null;
}) {
  const workspace = useWorkspace();
  const local = workspace.localAudit(auditId);

  if (isSampleAudit(auditId) && !local) {
    return <p className="va-empty">Opening sample audit…</p>;
  }

  if (!catalog && !local && workspace.ready) {
    return (
      <p className="va-empty">
        This audit is not in this workspace.{" "}
        <Link href="/product/audits">Return to audits</Link>.
      </p>
    );
  }

  return <AiWorkspace auditId={auditId} studio />;
}
