"use client";

import { useState } from "react";
import type { Scenario } from "@/lib/audit/types";
import { scenarioInquiry } from "@/lib/demo/scenario-copy";

export function Investigation({
  scenarioId,
  onSearch,
}: {
  scenarioId: Scenario | null;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inquiry = scenarioInquiry(scenarioId);

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Inquiry</p>
        <h1 className="display">The original decision is no longer in sight.</h1>
        <blockquote className="quote">
          <p>{inquiry.bossQuestion}</p>
        </blockquote>
      </div>
      <aside className="side-panel">
        <p className="section-label">Search the historical record</p>
        <form
          className="search-box stacked"
          onSubmit={(event) => {
            event.preventDefault();
            const next = query.trim();
            if (next) onSearch(next);
          }}
        >
          <label className="sr-only" htmlFor="inquiry">
            Search historical executions
          </label>
          <input
            id="inquiry"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask what the execution actually did"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="primary tight" disabled={query.trim().length === 0}>
            Search
          </button>
        </form>
        <div className="chips">
          {inquiry.chips.map((chip) => (
            <button key={chip} type="button" className="chip" onClick={() => onSearch(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </aside>
    </article>
  );
}
