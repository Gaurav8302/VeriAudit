"use client";

import { LocalFindingDetail } from "./LocalRecordDetail";
import { useWorkspace } from "./WorkspaceProvider";

export function FindingDetailGate({
  auditId,
  findingId,
  children,
}: {
  auditId: string;
  findingId: string;
  children: React.ReactNode;
}) {
  const workspace = useWorkspace();
  const local = workspace.findings(auditId).some((item) => item.findingId === findingId);
  if (local) return <LocalFindingDetail auditId={auditId} findingId={findingId} />;
  return children;
}
