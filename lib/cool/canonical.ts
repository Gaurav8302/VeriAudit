/**
 * Canonicalisation: VeriAudit event → the exact payload committed to CooL.
 *
 * This is the contract for what leaves the product layer. Determinism is the
 * whole point, so the rules are strict:
 *
 *   - explicit, fixed key order (alphabetical after `schema`)
 *   - snake_case, matching the receipt's own vocabulary
 *   - `detail` is deep-sorted, so two logically equal events canonicalise alike
 *   - NO wall-clock reads, NO random values, NO UI-only fields
 *   - `undefined` is never emitted; absent optional values become `null`
 *
 * The event's own `occurredAt` IS included — it is part of what the event
 * asserts. What is excluded is anything the CALLER did not decide: sealing
 * times, request ids, render state, cache keys.
 *
 * CooL encodes with RFC 8949 §4.2 deterministic CBOR, so key order does not
 * affect the resulting hash. We fix it anyway: the canonical payload is a
 * reviewable artifact, and a stable shape makes diffs and tests meaningful.
 */
import { canonicalCbor, mhSha256 } from "cool-nwc";
import type { CanonicalEventPayload, JsonValue, VeriAuditEvent } from "./types";

/** Recursively sort object keys so logically equal values encode identically. */
function sortDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = value[key];
      // Drop undefined-ish holes rather than emitting them: CBOR has no
      // `undefined` in our profile, and a missing key must not silently
      // become a different committed value than an explicit null.
      if (entry === undefined) continue;
      out[key] = sortDeep(entry);
    }
    return out;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("canonical payload cannot contain NaN or Infinity");
  }
  return value;
}

/**
 * Project a VeriAudit event into its canonical committed payload.
 *
 * Pure: the same event always produces the same payload, on any machine.
 */
export function canonicalEventPayload(event: VeriAuditEvent): CanonicalEventPayload {
  if (!Number.isInteger(event.sequence) || event.sequence < 0) {
    throw new TypeError(`event ${event.eventId}: sequence must be a non-negative integer`);
  }
  if (!event.executionId) {
    throw new TypeError(`event ${event.eventId}: executionId is required`);
  }

  return {
    schema: "veriaudit.event.v1",
    actor: event.actor,
    artifact_ids: [...event.artifactRefs].sort(),
    audit_id: event.auditId,
    detail: sortDeep({ ...event.detail }) as Record<string, JsonValue>,
    event_id: event.eventId,
    event_type: event.type,
    execution_id: event.executionId,
    occurred_at: event.occurredAt,
    parent_event_id: event.parentEventId ?? null,
    scenario: event.scenario,
    sequence: event.sequence,
    summary: event.summary,
    title: event.title,
  };
}

/**
 * A salt-free digest of the canonical payload.
 *
 * Distinct from the receipt's `binding_hash`, which is NOT reproducible because
 * `randomSalt()` draws fresh bytes per record (docs/COOL_SDK_AUDIT.md §7.2).
 * This digest IS reproducible, which makes it the right value for asserting
 * that two recordings committed the same logical event.
 */
export function contentDigest(event: VeriAuditEvent): string {
  return mhSha256(canonicalCbor(canonicalEventPayload(event)));
}
