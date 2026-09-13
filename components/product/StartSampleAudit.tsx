"use client";

import { useRouter } from "next/navigation";
import { SAMPLE_AUDIT_ID } from "@/lib/product/localWorkspace";
import { useWorkspace } from "./WorkspaceProvider";

export function StartSampleAudit({
  label = "Start sample audit",
  primary = true,
}: {
  label?: string;
  primary?: boolean;
}) {
  const workspace = useWorkspace();
  const router = useRouter();

  return (
    <button
      type="button"
      className={primary ? "va-btn va-btn-primary" : "va-btn"}
      data-testid="start-sample-audit"
      onClick={() => {
        workspace.resetSample();
        router.push(`/product/audits/${SAMPLE_AUDIT_ID}`);
      }}
    >
      {label}
    </button>
  );
}
