/**
 * Seeded PRNG for the historical simulation.
 *
 * `Math.random()`, `Date.now()`, and `crypto.randomUUID()` are forbidden in
 * this directory. The demo, the search corpus, and the tests all have to see
 * the same 55 rows on every machine.
 *
 * mulberry32, 32-bit, no dependencies — docs/SIMULATION_SPEC.md §2.
 */
export const SEED = 20260915;

/** Logical "now" for the demo. Never the wall clock. */
export const DEMO_TODAY = "2026-12-15T09:00:00.000Z";

export const HERO_AUDIT_ID = "AUD-FIN-2026-09";
export const HERO_EXECUTION_ID = "EXEC-FIN-2026-09-001";
export const HERO_OPENED_AT = "2026-09-15T09:00:00.000Z";

export type Rng = () => number;

export function rng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
