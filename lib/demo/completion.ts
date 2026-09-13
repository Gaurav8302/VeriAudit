/**
 * Client-only walkthrough completion. Survives refresh and tab close.
 * Restarting the demo must not clear this — the judge already finished once.
 */

export const DEMO_COMPLETED_KEY = "veriaudit.demo.completed.v1";

export function isDemoCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDemoCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_COMPLETED_KEY, "1");
  } catch {
    // Private mode or quota — the current session still works without persistence.
  }
}
