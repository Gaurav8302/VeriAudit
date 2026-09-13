"use client";

import { formatDay } from "@/lib/product/workspace";
import { parentOf } from "@/lib/product/lineage";
import { useWorkspace } from "./WorkspaceProvider";
import { LifeBadge } from "./LifeBadge";

export function ExecutionSwitcher({ auditId }: { auditId: string }) {
  const workspace = useWorkspace();
  const executions = workspace.executions(auditId);
  const selected = workspace.selectedId(auditId);
  if (executions.length < 2) return null;

  return (
    <nav className="va-switcher" aria-label="Executions">
      <p>Which execution are you working in? New work is added to the selected run.</p>
      <div>
        {executions.map((execution) => {
          const parent = parentOf(execution, executions);
          const active = execution.executionId === selected;
          return (
            <button
              key={execution.executionId}
              type="button"
              className={active ? "is-active" : undefined}
              onClick={() => workspace.select(auditId, execution.executionId)}
            >
              <strong>
                {active ? "●" : "○"} {execution.label}
              </strong>
              <span>
                {formatDay(execution.createdAt)} · <LifeBadge status={execution.status} />
              </span>
              {parent ? <span>Reopened from {parent.label}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
