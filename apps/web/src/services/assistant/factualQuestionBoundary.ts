import type {RAGSearchResult} from '../rag/types';

/*
 * Deterministic request classifier for the factual evidence gate (1.2, 1.4b).
 * It classifies by what is asked, not by the opening word: leading politeness
 * ("please", "can you") and continuations ("and", "so", "how about") are
 * stripped, then the remainder is checked against the tables below in order.
 * When a request is ambiguous between reporting a project fact and generating
 * new text, it is gated.
 */

/** Stripped repeatedly from the front before classification. */
const POLITE_PREFIX = /^(?:please|(?:can|could|would|will) you(?:\s+please)?)\b[\s,]*/i;
const CONTINUATION_PREFIX = /^(?:and|so|also|then|okay|ok|what about|how about)\b[\s,]*/i;

/** Things an author asks to have invented, as in "give me five complications". */
const INVENTED_MATERIAL =
  '(?:ideas?|names?|titles?|options?|suggestions?|prompts?|stor(?:y|ies)|poems?|scenes?|paragraphs?|lines?|beats?|ways?|twists?|hooks?|complications?|conflicts?|obstacles?|alternatives?|variations?|possibilities|endings?|openings?|scenarios?|examples?)';
const QUANTITY =
  '(?:a|an|some|more|a few|several|\\d+|two|three|four|five|six|seven|eight|nine|ten)';

/** Requests for new text stay on the creative path. */
const CREATIVE_PATTERNS: RegExp[] = [
  /^(?:write|draft|describe|brainstorm|suggest|rewrite|expand|generate|invent|create|imagine|outline|revise|edit|polish|tighten|shorten|continue|help)\b/i,
  /^(?:come up with|think of|make up|punch up)\b/i,
  // "How about we …" proposes a direction rather than asking for a fact.
  /^(?:we|let['’]s|let us)\b/i,
  /^(?:what|who|where|when|why|how)\s+(?:should|could|might|would)\b/i,
  // A report verb asking for invented material is still a creative request.
  new RegExp(`^(?:tell|give|show) me\\s+(?:${QUANTITY}\\s+)?(?:new\\s+|possible\\s+)?${INVENTED_MATERIAL}\\b`, 'i'),
  new RegExp(`^list\\s+(?:${QUANTITY}\\s+)?(?:new\\s+|possible\\s+)?${INVENTED_MATERIAL}\\b`, 'i')
];

/** Questions and report-style requests for a project fact are gated. */
const FACTUAL_PATTERNS: RegExp[] = [
  /^(?:what|which|who|whose|where|when|why|how\s+(?:long|many|much|old)|is|are|was|were|did|does|do|has|have|had|can)\b/i,
  /^(?:what|who|where|when|how)['’]s\b/i,
  /^(?:tell|remind|give|show) me\b/i,
  /^(?:list|recall)\b/i
];

/** With selected text, interpretation of that text stays collaborative. */
const SELECTION_ANALYSIS_PATTERN =
  /^(?:what does (?:this|that|it) (?:mean|imply|suggest)|why does (?:this|that|it) matter)\b/i;

const stripLeading = (prompt: string): {remainder: string; continued: boolean; asked: boolean} => {
  let remainder = prompt.trim();
  let continued = false;
  let asked = false;
  for (;;) {
    const polite = remainder.match(POLITE_PREFIX);
    if (polite) {
      asked ||= /^can\b/i.test(polite[0]);
      remainder = remainder.slice(polite[0].length).trimStart();
      continue;
    }
    const continuation = remainder.match(CONTINUATION_PREFIX);
    if (continuation) {
      continued = true;
      remainder = remainder.slice(continuation[0].length).trimStart();
      continue;
    }
    return {remainder, continued, asked};
  }
};

/** True when a message continues the previous turn ("And his rank?", "How about Dess?"). */
export const isContinuationRequest = (promptText: string): boolean =>
  stripLeading(promptText).continued;

export const isEvidenceGatedFactualQuestion = (
  promptText: string,
  hasSelectedContext = false
): boolean => {
  const {remainder, continued, asked} = stripLeading(promptText);
  const request = remainder.replace(/[?.!\s]+$/, '');
  if (!request) return false;
  if (CREATIVE_PATTERNS.some((pattern) => pattern.test(request))) return false;
  if (hasSelectedContext && SELECTION_ANALYSIS_PATTERN.test(request)) return false;
  if (FACTUAL_PATTERNS.some((pattern) => pattern.test(request))) return true;
  // "And his rank?" and "How about Dess?" ask for the same kind of fact as the
  // previous turn, and "Can you …" was gated before this classifier existed.
  return continued || asked;
};

export type UnverifiedFactualAnswer = {
  content: string;
  results: RAGSearchResult[];
};

/**
 * Universal factual fail-closed boundary. If a deterministic resolver cannot
 * prove an answer from saved evidence, a provider must never get an opportunity
 * to invent one.
 */
export const buildUnverifiedFactualAnswer = (
  results: RAGSearchResult[]
): UnverifiedFactualAnswer => {
  const reviewedResults = results.slice(0, 3);
  return {
    content:
      reviewedResults.length > 0
        ? "I found related saved project context, but I couldn't verify an explicit answer to that factual question without making an inference. I won't invent one. Check the sources reviewed below or add an accepted fact that states the answer."
        : "I couldn't find saved project context that explicitly answers that factual question, so I won't guess. Confirm the material is saved and rebuild project context, or add an accepted fact that states the answer.",
    results: reviewedResults
  };
};
