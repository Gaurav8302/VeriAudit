"use client";

import { useState } from "react";
import { SUGGESTION_CHIPS } from "@/lib/demo/copy";
import { formatDay } from "@/lib/demo/format";
import type { SearchResponse } from "@/lib/demo/payloads";

export function SearchResults({
  query,
  results,
  loading,
  error,
  onSearch,
  onOpen,
  onRetry,
}: {
  query: string;
  results: SearchResponse | null;
  loading: boolean;
  error: string | null;
  onSearch: (query: string) => void;
  onOpen: (auditId: string, executionId: string) => void;
  onRetry: () => void;
}) {
  const [draft, setDraft] = useState(query);
  const lead = results?.groups[0] ?? null;
  const others = results?.groups.slice(1, 6) ?? [];

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Search</p>
        <h1 className="display">Recover the original execution.</h1>

        <form
          className="search-box"
          onSubmit={(event) => {
            event.preventDefault();
            const next = draft.trim();
            if (next) onSearch(next);
          }}
        >
          <label className="sr-only" htmlFor="search-again">
            Search historical executions
          </label>
          <input
            id="search-again"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="primary tight" disabled={draft.trim().length === 0}>
            Search
          </button>
        </form>

        <div className="chips">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="chip"
              onClick={() => {
                setDraft(chip);
                onSearch(chip);
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {loading && <p className="note">Searching the recorded history…</p>}

        {error && (
          <p className="error" role="alert">
            {error}{" "}
            <button type="button" className="text-btn" onClick={onRetry}>
              Try again
            </button>
          </p>
        )}

        {!loading && results && results.total === 0 && (
          <p className="note">No matching executions. Try one of the inquiries above.</p>
        )}

        {!loading && lead && (
          <button
            type="button"
            className="found"
            onClick={() => onOpen(lead.auditId, lead.executionId ?? "")}
          >
            <p className="hero-tag">Original execution</p>
            <h2>{lead.title}</h2>
            <p className="found-id">{lead.auditId}</p>
            {lead.executionId && <p className="found-id">{lead.executionId}</p>}
            <p className="found-meta">{formatDay(lead.topHit.timestamp)}</p>
            <p className="found-meta">Open this execution</p>
          </button>
        )}
      </div>

      {!loading && others.length > 0 && (
        <aside className="side-panel">
          <p className="section-label">Also in the record</p>
          {others.map((group) => (
            <button
              key={group.auditId}
              type="button"
              className="hit"
              onClick={() => onOpen(group.auditId, group.executionId ?? "")}
            >
              <p className="hit-title">{group.title}</p>
              <p className="hit-meta">{group.auditId}</p>
            </button>
          ))}
        </aside>
      )}
    </article>
  );
}
