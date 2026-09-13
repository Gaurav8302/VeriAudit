/**
 * Explainable relevance. Weights from docs/SEARCH_SPEC.md §3.
 *
 *   score = Σ matched tokens of entityWeight × fieldBoost × matchQuality
 *         + phraseBonus (+5)
 *         + tagExactBonus (+4 per query token that equals a searchTag)
 *
 * Best field per token, so a title hit is not also counted as a body hit.
 */
import { fieldTokens, normalise } from "./tokenize";
import type { SearchDoc } from "./types";

const TITLE_BOOST = 2.0;
const TAG_BOOST = 1.5;
const BODY_BOOST = 1.0;
const EXACT = 1.0;
const PREFIX = 0.6;
const PHRASE_BONUS = 5.0;
const TAG_EXACT_BONUS = 4.0;

function quality(queryToken: string, fieldToken: string): number {
  if (queryToken === fieldToken) return EXACT;
  if (queryToken.length >= 3 && fieldToken.startsWith(queryToken)) return PREFIX;
  if (fieldToken.length >= 3 && queryToken.startsWith(fieldToken)) return PREFIX;
  return 0;
}

function bestIn(queryToken: string, fieldTokensList: readonly string[]): number {
  let best = 0;
  for (const fieldToken of fieldTokensList) {
    const q = quality(queryToken, fieldToken);
    if (q > best) best = q;
  }
  return best;
}

export function scoreDocument(
  doc: SearchDoc,
  queryTokens: readonly string[],
  phrases: readonly string[],
  rawQuery: string,
): { score: number; matched: string[] } {
  const titleTokens = fieldTokens(doc.title);
  const tagTokens = doc.tags.flatMap((tag) => fieldTokens(tag));
  const bodyTokens = fieldTokens(`${doc.body} ${doc.description} ${doc.type} ${doc.auditId} ${doc.executionId ?? ""}`);
  const normalisedTags = doc.tags.map((tag) => normalise(tag));
  const haystack = normalise(`${doc.title} ${doc.description} ${doc.body} ${doc.tags.join(" ")}`);
  const queryNorm = normalise(rawQuery);

  let score = 0;
  const matched: string[] = [];

  if (queryNorm.length > 0 && haystack.includes(queryNorm)) {
    score += PHRASE_BONUS;
    matched.push(rawQuery);
  }
  for (const phrase of phrases) {
    if (haystack.includes(normalise(phrase))) {
      score += PHRASE_BONUS;
      matched.push(phrase);
    }
  }

  for (const token of queryTokens) {
    const titleQ = bestIn(token, titleTokens);
    const tagQ = bestIn(token, tagTokens);
    const bodyQ = bestIn(token, bodyTokens);

    let fieldBoost = 0;
    let matchQ = 0;
    if (titleQ >= tagQ && titleQ >= bodyQ && titleQ > 0) {
      fieldBoost = TITLE_BOOST;
      matchQ = titleQ;
    } else if (tagQ >= bodyQ && tagQ > 0) {
      fieldBoost = TAG_BOOST;
      matchQ = tagQ;
    } else if (bodyQ > 0) {
      fieldBoost = BODY_BOOST;
      matchQ = bodyQ;
    }

    if (matchQ > 0) {
      score += doc.entityWeight * fieldBoost * matchQ;
      matched.push(token);
    }

    if (normalisedTags.includes(token)) {
      score += TAG_EXACT_BONUS;
      matched.push(token);
    }
  }

  return {
    score,
    matched: [...new Set(matched)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  };
}
