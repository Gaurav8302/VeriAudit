"use client";

import Link from "next/link";
import { formatDay } from "@/lib/product/workspace";
import { auditLifeStatus, latestActivity } from "@/lib/product/lineage";
import { useAuditExecutions } from "./LineageProvider";
import { ExecutionLineage } from "./ExecutionLineage";
import { LifeBadge } from "./LifeBadge";
import { ReopenAudit } from "./ReopenAudit";

export function AuditLifecycle({
  auditId,
  fallbackActivity,
  showBoard = false,
}: {
  auditId: string;
  fallbackActivity: string;
  showBoard?: boolean;
}) {
  const { executions, extras, canReopen } = useAuditExecutions(auditId);
  const life = auditLifeStatus(executions);
  const latest = latestActivity(fallbackActivity, executions);
  const original = executions[0];
  const current = executions[executions.length - 1];

  return (
    <>
      <section className="va-section">
        <h2>Executions</h2>
        <dl className="va-detail">
          <div>
            <dt>Current status</dt>
            <dd>
              <LifeBadge status={life} />
            </dd>
          </div>
          <div>
            <dt>Executions</dt>
            <dd>{executions.length}</dd>
          </div>
          <div>
            <dt>Latest activity</dt>
            <dd>{formatDay(latest)}</dd>
          </div>
          <div>
            <dt>Trace</dt>
            <dd>
              {original?.hasEngineTrail
                ? `${original.label} has a recorded trail`
                : "No recorded trail"}
            </dd>
          </div>
        </dl>
        <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
          <Link href={`/product/audits/${auditId}/executions`} className="va-btn">
            View executions
          </Link>
          {original ? (
            <Link
              href={`/product/audits/${auditId}/executions/${original.executionId}/trace`}
              className="va-btn"
            >
              Open original trace
            </Link>
          ) : null}
          {canReopen ? <ReopenAudit auditId={auditId} stayOnPage={showBoard} /> : null}
        </div>
        {extras.length > 0 && current && original && current.executionId !== original.executionId ? (
          <p className="va-empty">
            The original sealed execution remains unchanged. {current.label} is
            the new connected execution.
          </p>
        ) : (
          <p className="va-empty">
            The audit is the workspace. Each execution is a separate run of
            work. Reopening later adds a new execution instead of rewriting the
            original trail.
          </p>
        )}
      </section>
      {showBoard ? (
        <section className="va-section">
          <h2>How the work connects</h2>
          <ExecutionLineage auditId={auditId} executions={executions} />
        </section>
      ) : null}
    </>
  );
}
