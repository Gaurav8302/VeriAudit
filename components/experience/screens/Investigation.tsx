"use client";

import { useState } from "react";
import { APPROVED_CLAIMS, SUGGESTION_CHIPS } from "@/lib/demo/copy";

export function Investigation({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Inquiry</p>
        <h1 className="display">The original decision is no longer in sight.</h1>
        <blockquote className="quote">
          <p>{APPROVED_CLAIMS.bossQuestion}</p>
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
          {SUGGESTION_CHIPS.map((chip) => (
            <button key={chip} type="button" className="chip" onClick={() => onSearch(chip)}>
              {chip}
            </button>
          ))}
        </div>
      </aside>
    </article>
  );
}
