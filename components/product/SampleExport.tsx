"use client";

import { useWorkspace } from "./WorkspaceProvider";

export function SampleExport({ label = "Download sample dataset" }: { label?: string }) {
  const workspace = useWorkspace();

  function download() {
    const payload = workspace.exportSample();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "veriaudit-sample-workspace.json";
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <button type="button" className="va-btn" onClick={download}>
      {label}
    </button>
  );
}
