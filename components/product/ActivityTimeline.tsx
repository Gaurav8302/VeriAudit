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
  const activities = useWorkspace().activities(auditId, executionId);

  return (
    <section className="va-section">
      <h2>Product activity</h2>
      <p className="va-empty">
        Unsealed execution. These activities have not been cryptographically
        sealed. This is a WIP workspace.
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
                  {formatDay(item.occurredAt)} · {item.detail} · {item.actor} · Unsealed
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
