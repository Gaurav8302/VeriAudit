"use client";

import { formatClock, formatDay } from "@/lib/product/workspace";
import { useWorkspace } from "./WorkspaceProvider";

export function ActivityTimeline({
  auditId,
  executionId,
  label,
}: {
  auditId: string;
  executionId: string;
  label: string;
}) {
  const workspace = useWorkspace();
  const activities = workspace.activities(auditId, executionId);
  const sealed = Boolean(workspace.sealFor(executionId));

  return (
    <section className="va-section">
      <h2>Execution trace</h2>
      <p className="va-empty">
        {sealed
          ? "SEALED. These activities belong to a CooL-sealed execution. VERIFIED only after the server confirms it."
          : "RECORDED. These activities have not been cryptographically sealed."}
      </p>
      {activities.length === 0 ? (
        <p className="va-empty">
          No sealed events yet. Activity performed during {label} will appear
          here.
        </p>
      ) : (
        <ol className="va-spine">
          {activities.map((item, index) => (
            <li key={item.activityId}>
              <span className="va-spine-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="va-spine-dot" aria-hidden="true" />
              <div className="va-spine-body">
                <strong>
                  {formatClock(item.occurredAt)} · {item.title}
                </strong>
                <span className="meta">
                  {item.type} · {item.actor} · {formatDay(item.occurredAt)}
                  {item.subjectId ? ` · ${item.subjectId}` : ""}
                  {sealed ? " · Sealed" : " · Unsealed"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
