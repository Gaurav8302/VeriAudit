/**
 * Deterministic event retrieval.
 *
 * Sequence order is the trail's authority: it is the order events were sealed
 * into the tree, so `sequence` and `inclusion.leaf_index` move together
 * (docs/EVENT_MODEL.md §3 rule 4). Chronological order is the logical clock
 * (`occurredAt`) and is a derived view, not a second source of truth.
 *
 * This is not search. No ranking, no natural language. Lookup and filter only.
 */
import type { EventType } from "./types";

export interface QueryableEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: EventType;
  readonly occurredAt: string;
}

export type EventOrder = "sequence" | "occurredAt";

export interface EventQuery {
  readonly type?: EventType;
  readonly order?: EventOrder;
}

/** One event by id. Addressability after append is the whole point. */
export function eventById<E extends QueryableEvent>(
  events: readonly E[],
  eventId: string,
): E | undefined {
  return events.find((e) => e.eventId === eventId);
}

/** Filter and sort without mutating the source. */
export function queryEvents<E extends QueryableEvent>(
  events: readonly E[],
  query: EventQuery = {},
): E[] {
  const filtered = query.type === undefined ? [...events] : events.filter((e) => e.type === query.type);
  const order = query.order ?? "sequence";

  if (order === "sequence") {
    return filtered.sort((a, b) => a.sequence - b.sequence);
  }

  return filtered.sort((a, b) => {
    const byTime = a.occurredAt.localeCompare(b.occurredAt);
    return byTime !== 0 ? byTime : a.sequence - b.sequence;
  });
}

export function eventsByType<E extends QueryableEvent>(
  events: readonly E[],
  type: EventType,
): E[] {
  return queryEvents(events, { type, order: "sequence" });
}
