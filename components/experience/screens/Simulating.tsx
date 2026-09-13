"use client";

import { useEffect, useRef, useState } from "react";
import { APPROVED_CLAIMS } from "@/lib/demo/copy";
import type { SimulationFeed } from "@/lib/demo/payloads";

export function Simulating({
  simulation,
  error,
  onRetry,
  onRevealed,
}: {
  simulation: SimulationFeed | null;
  error: string | null;
  onRetry: () => void;
  onRevealed: () => void;
}) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (!simulation || error) return;
    done.current = false;
    const target = simulation.stats.totalActivities;
    const start = performance.now();
    const duration = 1600;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(Math.round(target * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else if (!done.current) {
        done.current = true;
        window.setTimeout(onRevealed, 400);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [simulation, error, onRevealed]);

  if (error) {
    return (
      <article className="frame">
        <p className="kicker">Time</p>
        <h1 className="display">{APPROVED_CLAIMS.simulateLater}</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="primary" onClick={onRetry}>
          Try again
        </button>
      </article>
    );
  }

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Organizational time</p>
        <h1 className="display">{APPROVED_CLAIMS.simulateLater}</h1>
        <div className="time-span" aria-hidden="true">
          <span>15 September 2026</span>
          <span className="time-arrow">↓</span>
          <span>15 December 2026</span>
        </div>
      </div>
      <aside className="side-panel contrast">
        <p className="count-line">
          <span className="count-value">{simulation ? shown : "—"}</span>
          <span className="count-label">
            {simulation
              ? `activities across ${simulation.stats.scenariosCovered} domains`
              : "Replaying the authored history"}
          </span>
        </p>
        {simulation && (
          <p className="side-copy">
            {simulation.stats.totalAudits} audits. The September execution is no
            longer at hand.
          </p>
        )}
      </aside>
    </article>
  );
}
