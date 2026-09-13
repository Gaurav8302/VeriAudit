/**
 * The append-only execution trail.
 *
 * Milestone 2 built the events and sealed the canonical nine. This module is
 * the product rule those events live under once they exist:
 *
 *   sealed events cannot be edited
 *   sealed events cannot be deleted
 *   order cannot be rewritten
 *   a correction is a NEW event
 *
 * That is not a storage trick. It is what makes a CooL receipt meaningful.
 * A receipt that still verifies after the application silently rewrote the
 * event it describes is a receipt of nothing.
 *
 * No CooL imports. Cryptographic checks live in `integrity.ts`. This file
 * enforces the application invariant those checks assume.
 */
import { ancestorsOf } from "./events";
import { eventById, queryEvents, type EventOrder } from "./query";
import type { AuditRun, SealedEvent } from "./run";
import type { EventType } from "./types";

export class AppendOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppendOnlyError";
  }
}

export interface EventPointer {
  readonly eventId: string;
  readonly type: EventType;
  readonly occurredAt: string;
  readonly sequence: number;
}

export interface WhyConclusion {
  readonly question: "What caused the final conclusion?";
  readonly conclusionEventId: string | null;
  /** Root-first causal path. For the hero this is exactly the sealed nine. */
  readonly path: readonly {
    readonly eventId: string;
    readonly type: EventType;
    readonly title: string;
    readonly parentEventId: string | null;
    readonly sealed: boolean;
  }[];
}

/**
 * Compact integrity summary for the future UI.
 *
 * `verificationStatus` is `unavailable` when receipts are not in this call —
 * regenerated GET routes hold none, by design (docs/COOL_SDK_AUDIT.md §7.2).
 * That is not a failure.
 */
export interface ExecutionSnapshot {
  readonly executionId: string;
  readonly auditId: string;
  readonly eventCount: number;
  readonly sealedCount: number;
  readonly firstEvent: EventPointer | null;
  readonly lastEvent: EventPointer | null;
  readonly rootEventId: string;
  readonly treeHead: { logId: string; treeSize: number; rootHash: string } | null;
  readonly verificationStatus: "verified" | "failed" | "unavailable" | "not-recorded";
  readonly verifiedAt: string | null;
}

export class ExecutionTrail {
  readonly events: readonly SealedEvent[];
  readonly logState: readonly string[];
  readonly treeHead: { logId: string; treeSize: number; rootHash: string } | null;
  readonly receipts: ReadonlyMap<string, unknown>;
  readonly canonicalEventIds: readonly string[];
  readonly rootEventId: string;
  readonly auditId: string;
  readonly executionId: string;

  private constructor(run: AuditRun) {
    // Frozen copies: a caller who mutates the array they got back cannot
    // change the trail they asked questions of.
    this.events = Object.freeze(run.events.map((e) => Object.freeze({ ...e })));
    this.logState = Object.freeze([...run.logState]);
    this.treeHead = run.sealing.treeHead;
    this.receipts = run.receipts;
    this.canonicalEventIds = Object.freeze([...run.canonicalEventIds]);
    this.rootEventId = run.rootEventId;
    this.auditId = run.result.auditId;
    this.executionId = run.result.executionId;
  }

  static fromRun(run: AuditRun): ExecutionTrail {
    return new ExecutionTrail(run);
  }

  get(eventId: string): SealedEvent | undefined {
    return eventById(this.events, eventId);
  }

  query(options: { type?: EventType; order?: EventOrder } = {}): SealedEvent[] {
    return queryEvents(this.events, options);
  }

  /**
   * Walk from the conclusion to the root. The answer to the product question.
   *
   * Uses `parentEventId`, not array order. Ordering alone would reconstruct a
   * list; relationships reconstruct a cause.
   */
  whyConclusion(): WhyConclusion {
    const conclusion = this.events.find((e) => e.type === "conclusion.created") ?? null;
    if (!conclusion) {
      return { question: "What caused the final conclusion?", conclusionEventId: null, path: [] };
    }

    const path = ancestorsOf(this.events, conclusion.eventId);
    return {
      question: "What caused the final conclusion?",
      conclusionEventId: conclusion.eventId,
      path: path.map((e) => ({
        eventId: e.eventId,
        type: e.type,
        title: e.title,
        parentEventId: e.parentEventId,
        sealed: e.cool !== null,
      })),
    };
  }

  snapshot(verification?: {
    status: ExecutionSnapshot["verificationStatus"];
    verifiedAt: string | null;
  }): ExecutionSnapshot {
    const first = this.events[0] ?? null;
    const last = this.events[this.events.length - 1] ?? null;
    const sealedCount = this.events.filter((e) => e.cool !== null).length;

    let status: ExecutionSnapshot["verificationStatus"];
    if (verification) {
      status = verification.status;
    } else if (sealedCount === 0) {
      status = "not-recorded";
    } else {
      status = "unavailable";
    }

    return {
      executionId: this.executionId,
      auditId: this.auditId,
      eventCount: this.events.length,
      sealedCount,
      firstEvent: first ? pointerOf(first) : null,
      lastEvent: last ? pointerOf(last) : null,
      rootEventId: this.rootEventId,
      treeHead: this.treeHead,
      verificationStatus: status,
      verifiedAt: verification?.verifiedAt ?? null,
    };
  }

  /**
   * The only legal write. Returns a NEW trail. The original is unchanged.
   *
   * Sequence must be the next index. The parent must already be in the trail.
   * That is how "historical events remain addressable" stays true after a
   * correction: the old ids still resolve, and the new event hangs off them.
   */
  append(event: SealedEvent, receipt?: { receiptRef: string; evidence: unknown }): ExecutionTrail {
    if (event.auditId !== this.auditId || event.executionId !== this.executionId) {
      throw new AppendOnlyError(
        `event ${event.eventId} belongs to ${event.executionId}, not ${this.executionId}`,
      );
    }
    if (this.get(event.eventId)) {
      throw new AppendOnlyError(
        `event ${event.eventId} already exists — a correction is a new event, not a rewrite`,
      );
    }
    if (event.sequence !== this.events.length) {
      throw new AppendOnlyError(
        `event ${event.eventId} has sequence ${event.sequence}; the next append must be ${this.events.length}`,
      );
    }
    if (event.parentEventId !== null && !this.get(event.parentEventId)) {
      throw new AppendOnlyError(
        `event ${event.eventId} names unknown parent ${event.parentEventId}`,
      );
    }

    const receipts = new Map(this.receipts);
    if (receipt) receipts.set(receipt.receiptRef, receipt.evidence);

    return new ExecutionTrail({
      result: {
        auditId: this.auditId,
        executionId: this.executionId,
      } as AuditRun["result"],
      events: [...this.events, event],
      canonicalEventIds: this.canonicalEventIds,
      rootEventId: this.rootEventId,
      sealing: {
        attempted: this.canonicalEventIds.length,
        sealed: [...this.events, event].filter((e) => e.cool !== null).length,
        error: null,
        treeHead: this.treeHead,
        timings: null,
      },
      logState: this.logState,
      receipts,
    });
  }

  /** Illegal. Exists so a test can prove the trail refuses silent edits. */
  replace(_eventId: string, _event: SealedEvent): never {
    throw new AppendOnlyError(
      "events are append-only: record a correction event instead of replacing history",
    );
  }

  /** Illegal. Exists so a test can prove the trail refuses silent deletion. */
  remove(_eventId: string): never {
    throw new AppendOnlyError(
      "events are append-only: a deleted historical event would leave a hole the tree cannot hide",
    );
  }

  /** Illegal. Exists so a test can prove the trail refuses silent reordering. */
  reorder(_eventIds: readonly string[]): never {
    throw new AppendOnlyError(
      "events are append-only: sequence is the sealed order and cannot be rewritten",
    );
  }
}

function pointerOf(event: SealedEvent): EventPointer {
  return {
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt,
    sequence: event.sequence,
  };
}
