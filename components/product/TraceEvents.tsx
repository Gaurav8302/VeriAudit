"use client";

import { useState } from "react";
import { formatDay } from "@/lib/product/workspace";

export interface TraceEventRow {
  readonly eventId: string;
  readonly title: string;
  readonly type: string;
  readonly occurredAt?: string;
  readonly executionId?: string;
  readonly findingRef?: string | null;
  readonly artifactRefs?: readonly string[];
}

export function TraceEvents({
  events,
  executionLabel,
  executionStatus,
}: {
  events: readonly TraceEventRow[];
  executionLabel: string;
  executionStatus: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((event) => event.eventId === selectedId) ?? null;

  if (events.length === 0) return null;

  return (
    <section className="va-section">
      <h2>Recorded events</h2>
      <table className="va-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Type</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.eventId}
              className={selectedId === event.eventId ? "is-selected" : undefined}
            >
              <td>
                <button
                  type="button"
                  className="va-inline"
                  onClick={() =>
                    setSelectedId((current) => (current === event.eventId ? null : event.eventId))
                  }
                >
                  {event.title}
                </button>
                <span className="meta">{event.eventId}</span>
              </td>
              <td>{event.type}</td>
              <td>{event.occurredAt ? formatDay(event.occurredAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <dl className="va-detail">
          <div>
            <dt>Event</dt>
            <dd>{selected.title}</dd>
          </div>
          <div>
            <dt>Timestamp</dt>
            <dd>{selected.occurredAt ? formatDay(selected.occurredAt) : "Recorded with the original run"}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{selected.type}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{selected.title}</dd>
          </div>
          <div>
            <dt>Execution</dt>
            <dd>{executionLabel}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{executionStatus}</dd>
          </div>
          {selected.findingRef ? (
            <div>
              <dt>Related finding</dt>
              <dd>{selected.findingRef}</dd>
            </div>
          ) : null}
          {selected.artifactRefs && selected.artifactRefs.length > 0 ? (
            <div>
              <dt>Related evidence</dt>
              <dd>{selected.artifactRefs.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
