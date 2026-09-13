"use client";

import { useAuditExecutions } from "./WorkspaceProvider";
import { ExecutionLineage } from "./ExecutionLineage";
import { WorkspaceActions } from "./WorkspaceActions";

export function ExecutionBoard({ auditId }: { auditId: string }) {
  const { executions, extras } = useAuditExecutions(auditId);

  return (
    <>
      <WorkspaceActions auditId={auditId} />
      {extras.length > 0 ? (
        <p className="va-empty">
          {executions[0]?.status === "sealed"
            ? "The original sealed execution remains unchanged. A new execution was created and linked to it."
            : "A later execution was created under the same audit. Earlier work stays on the execution where it was recorded."}
        </p>
      ) : null}
      <section className="va-section">
        <h2>Executions</h2>
        {executions.length === 0 ? (
          <p className="va-empty">
            No executions yet. Create an execution to start recording work.
          </p>
        ) : (
          <ExecutionLineage auditId={auditId} executions={executions} />
        )}
      </section>
    </>
  );
}
