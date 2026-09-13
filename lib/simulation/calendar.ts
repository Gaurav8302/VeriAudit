/**
 * Logical-calendar helpers. Every date is an offset from DEMO_TODAY.
 * `new Date(iso)` here constructs a known instant; it never reads the clock.
 */
import { DEMO_TODAY } from "./rng";

const MS_PER_DAY = 86_400_000;

export function utcMs(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new TypeError(`not an RFC 3339 timestamp: ${iso}`);
  return ms;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Whole days from `later` back to `earlier`. */
export function daysBetween(earlier: string, later: string): number {
  return Math.round((utcMs(later) - utcMs(earlier)) / MS_PER_DAY);
}

/** `DEMO_TODAY` minus `daysBack`, same clock time. */
export function dayAt(daysBack: number): Date {
  return new Date(utcMs(DEMO_TODAY) - daysBack * MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday, UTC. */
export function weekdayUtc(ms: number): number {
  return new Date(ms).getUTCDay();
}

export function isWeekdayUtc(ms: number): boolean {
  const day = weekdayUtc(ms);
  return day !== 0 && day !== 6;
}

/**
 * Walk to the nearest weekday still inside [minDay, maxDay] (days back
 * from DEMO_TODAY). Returns null if the window is all weekend — the
 * caller retries with a different draw.
 */
export function weekdayInWindow(daysBack: number, minDay: number, maxDay: number): number | null {
  const candidates = [0, -1, 1, -2, 2, -3, 3];
  for (const delta of candidates) {
    const next = daysBack + delta;
    if (next < minDay || next > maxDay) continue;
    if (isWeekdayUtc(dayAt(next).getTime())) return next;
  }
  return null;
}
