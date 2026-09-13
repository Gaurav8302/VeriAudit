/**
 * In-memory inverted index + ranked retrieval.
 *
 * Built from the deterministic corpus. No I/O, no clock, no LLM.
 */
import { DEMO_TODAY } from "@/lib/simulation";
import { utcMs } from "@/lib/simulation/calendar";
import { buildCorpus } from "./corpus";
import { scoreDocument } from "./score";
import { expand, SUGGESTION_CHIPS, tokenise } from "./tokenize";
import type { SearchDoc, SearchFilters, SearchGroup, SearchHit, SearchResponse } from "./types";

const SCORE_FLOOR = 1.0;

export interface SearchIndex {
  readonly docs: readonly SearchDoc[];
  readonly posting: ReadonlyMap<string, readonly string[]>;
}

function postingList(docs: readonly SearchDoc[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const doc of docs) {
    const tokens = tokenise(
      `${doc.title} ${doc.description} ${doc.body} ${doc.tags.join(" ")} ${doc.auditId} ${doc.executionId ?? ""} ${doc.type}`,
    );
    for (const token of tokens) {
      const set = map.get(token) ?? new Set<string>();
      set.add(doc.id);
      map.set(token, set);
    }
  }
  const posting = new Map<string, string[]>();
  for (const [token, ids] of [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    posting.set(token, [...ids].sort());
  }
  return posting;
}

export function buildIndex(docs: readonly SearchDoc[] = buildCorpus()): SearchIndex {
  return { docs, posting: postingList(docs) };
}

function withinDate(doc: SearchDoc, filters: SearchFilters): boolean {
  const t = utcMs(doc.occurredAt);
  if (filters.after !== undefined && t < utcMs(filters.after)) return false;
  if (filters.before !== undefined && t > utcMs(filters.before)) return false;
  if (filters.sinceDays !== undefined) {
    const start = utcMs(DEMO_TODAY) - filters.sinceDays * 86_400_000;
    if (t < start || t > utcMs(DEMO_TODAY)) return false;
  }
  return true;
}

function matchesFilters(doc: SearchDoc, filters: SearchFilters): boolean {
  if (!withinDate(doc, filters)) return false;
  if (filters.domain !== undefined && doc.domain !== filters.domain) return false;
  if (filters.type !== undefined && doc.type !== filters.type) return false;
  if (filters.auditId !== undefined && doc.auditId !== filters.auditId) return false;
  if (filters.status !== undefined && doc.status !== filters.status) return false;
  if (filters.evidence === "cool" && !doc.coolBacked) return false;
  if (filters.evidence === "none" && doc.coolBacked) return false;
  return true;
}

function toHit(doc: SearchDoc, relevance: number, matchedTerms: readonly string[]): SearchHit {
  const snippetSource = doc.description || doc.body;
  return {
    activityId: doc.activityId,
    eventId: doc.eventId,
    findingId: doc.findingId,
    kind: doc.kind,
    title: doc.title,
    description: doc.description,
    timestamp: doc.occurredAt,
    type: doc.type,
    domain: doc.domain,
    auditId: doc.auditId,
    executionId: doc.executionId,
    relevance,
    matchedTerms,
    tags: doc.tags,
    status: doc.status,
    coolBacked: doc.coolBacked,
    snippet: snippetSource.length > 220 ? `${snippetSource.slice(0, 217)}...` : snippetSource,
  };
}

function compareHits(a: SearchHit, b: SearchHit): number {
  if (b.relevance !== a.relevance) return b.relevance - a.relevance;
  const byTime = b.timestamp.localeCompare(a.timestamp);
  if (byTime !== 0) return byTime;
  return a.auditId.localeCompare(b.auditId) || (a.activityId ?? a.eventId ?? a.title).localeCompare(
    b.activityId ?? b.eventId ?? b.title,
  );
}

export function search(
  query: string,
  filters: SearchFilters = {},
  index: SearchIndex = buildIndex(),
): SearchResponse {
  const trimmed = query.trim();
  const tokens = tokenise(trimmed);
  const { tokens: expanded, phrases } = expand(tokens);

  const candidates: SearchDoc[] = [];
  if (trimmed.length === 0) {
    candidates.push(...index.docs.filter((d) => d.kind === "activity"));
  } else {
    const ids = new Set<string>();
    for (const token of expanded) {
      for (const id of index.posting.get(token) ?? []) ids.add(id);
    }
    for (const phrase of phrases) {
      for (const part of tokenise(phrase)) {
        for (const id of index.posting.get(part) ?? []) ids.add(id);
      }
    }
    const byId = new Map(index.docs.map((d) => [d.id, d]));
    for (const id of [...ids].sort()) {
      const doc = byId.get(id);
      if (doc) candidates.push(doc);
    }
  }

  const hits: SearchHit[] = [];
  for (const doc of candidates) {
    if (!matchesFilters(doc, filters)) continue;
    if (trimmed.length === 0) {
      hits.push(toHit(doc, 0, []));
      continue;
    }
    const { score, matched } = scoreDocument(doc, expanded, phrases, trimmed);
    if (score >= SCORE_FLOOR) hits.push(toHit(doc, score, matched));
  }

  hits.sort(compareHits);

  const groupMap = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const list = groupMap.get(hit.auditId) ?? [];
    list.push(hit);
    groupMap.set(hit.auditId, list);
  }

  const groups: SearchGroup[] = [...groupMap.entries()]
    .map(([auditId, groupHits]) => {
      const top = groupHits[0]!;
      return {
        auditId,
        executionId: top.executionId,
        title: groupHits.find((h) => h.kind === "audit")?.title ?? top.title,
        domain: top.domain,
        score: top.relevance,
        hitCount: groupHits.length,
        topHit: top,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const byTime = b.topHit.timestamp.localeCompare(a.topHit.timestamp);
      if (byTime !== 0) return byTime;
      return a.auditId.localeCompare(b.auditId);
    });

  const groupedHits =
    trimmed.length === 0
      ? hits.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.auditId.localeCompare(b.auditId))
      : groups.flatMap((g) => groupMap.get(g.auditId) ?? []);

  return {
    query: trimmed,
    tokens: expanded,
    total: groupedHits.length,
    results: groupedHits,
    groups,
    suggestions: [...SUGGESTION_CHIPS],
  };
}
