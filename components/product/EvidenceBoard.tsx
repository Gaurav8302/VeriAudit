"use client";

import Link from "next/link";
import { Term } from "./Term";
import { WorkspaceActions } from "./WorkspaceActions";
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
      <p className="va-lede">
        <Term name="evidence">Evidence</Term> is what AI and reviewers work
        against. Uploaded files stay on this execution. Catalog files are sample
        records.
      </p>
      <WorkspaceActions auditId={auditId} />
      {current ? (
        <p className="va-empty">
          Showing evidence for {current.label}. Switch executions to inspect
          another run.
        </p>
      ) : null}
      {!showCatalog && local.length === 0 ? (
        <p className="va-empty">
          No evidence added yet. Add sample evidence to begin building this
          audit.
        </p>
      ) : (
        <section className="va-section">
          <h2>Evidence</h2>
          <table className="va-table">
            <thead>
              <tr>
                <th>Evidence</th>
                <th>Type</th>
                <th>Fingerprint</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {showCatalog &&
                catalog.map((item) => (
                  <tr key={item.artifactId}>
                    <td>
                      <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                        {item.title}
                      </Link>
                      <span className="meta">{item.artifactId}</span>
                    </td>
                    <td>{item.kind.replace("_", " ")}</td>
                    <td>—</td>
                    <td>
                      <span className="va-badge sample">Sample</span>
                    </td>
                  </tr>
                ))}
              {local.map((item) => (
                <tr key={item.artifactId}>
                  <td>
                    <Link href={`/product/audits/${auditId}/evidence/${item.artifactId}`}>
                      {item.title}
                    </Link>
                    <span className="meta">{item.artifactId}</span>
                  </td>
                  <td>{item.kind}</td>
                  <td>{item.fingerprint ? `${item.fingerprint.slice(0, 8)}…` : "—"}</td>
                  <td>
                    <span className={item.sample ? "va-badge sample" : "va-badge open"}>
                      {item.extraction === "text"
                        ? "Ready"
                        : item.extraction === "unavailable"
                          ? "Fingerprint only"
                          : item.sample
                            ? "Sample"
                            : "Ready"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
