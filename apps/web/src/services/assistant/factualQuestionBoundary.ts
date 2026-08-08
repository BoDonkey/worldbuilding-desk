import type {RAGSearchResult} from '../rag/types';

const FACT_QUESTION_PATTERN =
  /^(?:what|which|who|whose|where|when|why|how\s+(?:long|many|much|old)|is|are|was|were|did|does|do|has|have|had|can)\b/i;

const CREATIVE_QUESTION_PATTERN =
  /^(?:(?:what|who|where|when|why|how)\s+(?:should|could|might|would)|can you\s+(?:brainstorm|draft|generate|help|suggest|write))\b/i;

const ANALYSIS_QUESTION_PATTERN =
  /^(?:what does (?:this|that|it) (?:mean|imply|suggest)|why does (?:this|that|it) matter)\b/i;

export const isEvidenceGatedFactualQuestion = (
  promptText: string,
  hasSelectedContext = false
): boolean => {
  const prompt = promptText.trim();
  if (!FACT_QUESTION_PATTERN.test(prompt)) return false;
  if (CREATIVE_QUESTION_PATTERN.test(prompt)) return false;
  if (hasSelectedContext && ANALYSIS_QUESTION_PATTERN.test(prompt)) return false;
  return true;
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
