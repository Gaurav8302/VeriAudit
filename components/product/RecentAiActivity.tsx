"use client";

import Link from "next/link";
import { findingReviewLabel } from "@/lib/product/localWorkspace";
import { useWorkspace } from "./WorkspaceProvider";

export function RecentAiActivity() {
  const workspace = useWorkspace();
  if (!workspace.ready) {
    return (
      <section className="va-section">
        <h2>Recent AI activity</h2>
        <p className="va-empty">Loading recent AI activity…</p>
      </section>
    );
  }

  const actions = [...workspace.state.actions]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, 5);
  const pending = workspace.state.findings.filter((item) => item.origin === "ai" && item.review === "pending");

  return (
    <section className="va-section">
      <h2>Recent AI activity</h2>
      {actions.length === 0 ? (
        <p className="va-empty">
          No local AI work yet. Create an audit, attach evidence, and ask the
          assistant to check it. Sample catalog rows below are not live AI
          activity.
        </p>
      ) : (
        <ul className="va-list">
          {actions.map((item) => (
            <li key={item.actionId}>
              <Link href={`/product/audits/${item.auditId}`}>
                <strong>{item.title}</strong>
              </Link>
              <span>
                {item.type.replace(/_/g, " ").toLowerCase()} · {item.status}
                {" · Recorded to execution"}
                {item.findingId ? ` · ${item.findingId}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pending.length > 0 ? (
        <p className="va-empty">
          {pending.length} AI finding{pending.length === 1 ? "" : "s"}{" "}
          {findingReviewLabel("pending").toLowerCase()} — awaiting human review.
        </p>
      ) : null}
    </section>
  );
}
