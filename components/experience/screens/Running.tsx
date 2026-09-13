"use client";

import { useEffect, useRef, useState } from "react";
import type { RunPayload } from "@/lib/demo/payloads";

const WAITING = [
  "Opening the engagement",
  "Reading the evidence in scope",
  "Evaluating controls",
  "Recording the execution",
] as const;

export function Running({
  title,
  period,
  payload,
  error,
  onRetry,
  onRevealed,
}: {
  title: string;
  period: string;
  payload: RunPayload | null;
  error: string | null;
  onRetry: () => void;
  onRevealed: () => void;
}) {
  const [visible, setVisible] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (!payload || error) return;
    setVisible(0);
    done.current = false;
    const steps = revealSteps(payload);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= steps.length) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          if (!done.current) {
            done.current = true;
            onRevealed();
          }
        }, 450);
      }
    }, 380);
    return () => window.clearInterval(timer);
  }, [payload, error, onRevealed]);

  if (error) {
    return (
      <article className="frame">
        <p className="kicker">Execution</p>
        <h1 className="display">The audit did not complete.</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="primary" onClick={onRetry}>
          Run again
        </button>
      </article>
    );
  }

  const steps = payload ? revealSteps(payload) : WAITING.map((label) => ({ label, done: false }));

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Execution in progress</p>
        <h1 className="display">{title}</h1>
        <p className="lede">{period}</p>
      </div>
      <aside className="side-panel">
        <ol className="stages">
          {steps.map((step, index) => {
            const complete = payload ? index < visible : false;
            return (
              <li key={step.label} className={complete ? "done" : undefined}>
                <span className="mark" aria-hidden="true">
                  {complete ? "—" : "·"}
                </span>
                <span>{step.label}</span>
              </li>
            );
          })}
        </ol>
        {!payload && <p className="note">Working from the authored evidence. No progress invented.</p>}
      </aside>
    </article>
  );
}

function revealSteps(payload: RunPayload) {
  const { summary } = payload.audit;
  const recorded = payload.trail.events.length;
  const sealError = payload.sealing.error;
  return [
    { label: `${payload.audit.artifacts.length} artifacts ingested`, done: true },
    { label: `${summary.controlsTested} controls tested`, done: true },
    { label: `${summary.exceptions} exceptions recorded`, done: true },
    { label: `${summary.findings} findings written`, done: true },
    {
      label:
        summary.humanReviewsCompleted > 0
          ? `${summary.humanReviewsCompleted} human reviews completed`
          : "Human review pending",
      done: true,
    },
    {
      label: sealError
        ? `${recorded} execution events recorded · cryptographic evidence unavailable`
        : `${recorded} execution events recorded`,
      done: true,
    },
  ];
}
