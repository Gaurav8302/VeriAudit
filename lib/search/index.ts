/**
 * Search boundary. In-memory inverted index over the deterministic corpus.
 * No CooL imports except `reconstruct.ts`, which only verifies when the
 * caller supplies receipts.
 */
export { buildCorpus } from "./corpus";
export { reconstructAudit } from "./reconstruct";
export type { ReconstructionEvidence } from "./reconstruct";
export { buildIndex, search } from "./retrieve";
export type { SearchIndex } from "./retrieve";
export { DEMO_QUERIES, SUGGESTION_CHIPS } from "./tokenize";
export type {
  SearchDoc,
  SearchFilters,
  SearchGroup,
  SearchHit,
  SearchKind,
  SearchResponse,
} from "./types";
