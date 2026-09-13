"use client";

import Link from "next/link";
import { formatDay } from "@/lib/product/workspace";
import {
  executionHref,
  executionTraceHref,
  parentOf,
  type ProductExecution,
} from "@/lib/product/lineage";
import { LifeBadge } from "./LifeBadge";

export function ExecutionLineage({
  auditId,
  executions,
  selectedId,
}: {
  auditId: string;
  executions: readonly ProductExecution[];
  selectedId?: string;
}) {
  if (executions.length === 0) {
    return (
      <p className="va-empty">
        This catalog row has no execution yet.
      </p>
    );
  }

  return (
    <div className="va-exec">
      {executions.map((execution, index) => {
        const parent = parentOf(execution, executions);
        return (
          <div key={execution.executionId}>
            {index > 0 && parent && (
              <p className="va-exec-join">
                <span aria-hidden="true">│</span>
                <span>reopened on {formatDay(execution.createdAt)}</span>
                <span aria-hidden="true">▼</span>
              </p>
            )}
            <Link
              href={executionHref(auditId, execution.executionId)}
              className={`va-exec-card${selectedId === execution.executionId ? " is-active" : ""}`}
            >
              <header>
                <strong>{execution.label}</strong>
                <LifeBadge status={execution.status} />
              </header>
              <p>{formatDay(execution.createdAt)}</p>
              <p className="meta">
                {execution.eventCount === null
                  ? "No recorded event count"
                  : `${execution.eventCount} events`}
                {` · ${execution.findingCount} findings`}
              </p>
              {parent ? (
                <p className="va-exec-note">
                  Reopened from {parent.label}
                  <span>New work performed</span>
                </p>
              ) : (
                <p className="va-exec-note">
                  Original execution
                  {execution.immutable ? <span>This record cannot be changed.</span> : null}
                </p>
              )}
              <p className="meta">{execution.executionId}</p>
            </Link>
            <p className="va-exec-links">
              <Link href={executionTraceHref(auditId, execution.executionId)}>Open trace</Link>
            </p>
          </div>
        );
      })}
    </div>
  );
}
