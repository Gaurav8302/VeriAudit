"use client";

import { useState } from "react";
import type { Scenario } from "@/lib/audit/types";
import { explainerCopy, type ExplainerTopic } from "@/lib/demo/explainer";

export function Explainer({
  topic,
  scenarioId,
  raised,
}: {
  topic: ExplainerTopic;
  scenarioId?: Scenario | null;
  raised?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const copy = explainerCopy(topic, scenarioId);

  return (
    <aside className={raised ? "explainer raised" : "explainer"}>
      {open ? (
        <div className="explainer-card">
          <p className="section-label">What am I looking at?</p>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
          <button type="button" className="ghost" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      ) : (
        <button type="button" className="explainer-toggle" onClick={() => setOpen(true)}>
          What am I looking at?
        </button>
      )}
    </aside>
  );
}
