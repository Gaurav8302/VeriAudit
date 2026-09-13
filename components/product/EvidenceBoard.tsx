"use client";

import Link from "next/link";
import { EvidenceUpload } from "./EvidenceUpload";
import { DemoMark } from "./LifeBadge";
import { isWritableExecution } from "@/lib/product/localWorkspace";
import { useWorkspace } from "./WorkspaceProvider";
import type { WorkspaceArtifact } from "@/lib/product/workspace";

export function EvidenceBoard({
  auditId,
  catalog,
}: {
  auditId: string;
  catalog: readonly WorkspaceArtifact[];
}) {
  const workspace = useWorkspace();
  const executions = workspace.executions(auditId);
  const selected = workspace.selectedId(auditId);
  const originalId = executions[0]?.executionId;
  const showCatalog = Boolean(catalog.length && selected && selected === originalId);
  const local = selected ? workspace.evidence(auditId, selected) : workspace.evidence(auditId);
  const current = executions.find((item) => item.executionId === selected);

  return (
    <>
      <p className="va-lede">Evidence available to AI on this execution. Raw document contents are not written to CooL.</p>
      {current && isWritableExecution(current) ? (
        <EvidenceUpload auditId={auditId} executionId={current.executionId} />
      ) : null}
      {current && isWritableExecution(current) ? (
        <p className="va-inline-row">
          <a href={`/product/audits/${auditId}#ai-assistant`}>Ask AI to review</a>
        </p>
      ) : null}
      {current ? <p className="va-empty">Showing evidence for {current.label}.</p> : null}
      {!showCatalog && local.length === 0 ? (
        <p className="va-empty">No evidence uploaded yet. Add a file or try the sample pack.</p>
      ) : (
        <div className="va-evidence-cards">
          {showCatalog
            ? catalog.map((item) => (
                <article key={item.artifactId} className="va-evidence-card">
                  <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>{item.title}</Link>
                  <p>
                    {item.kind.replace("_", " ")} · {item.artifactId} <DemoMark />
                  </p>
                </article>
              ))
            : null}
          {local.map((item) => (
            <article key={item.artifactId} className="va-evidence-card">
              <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                {item.filename ?? item.title}
              </Link>
              <p>
                {item.kind} · {item.source || "Upload"}
                {item.fingerprint ? ` · ${item.fingerprint.slice(0, 12)}` : ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
