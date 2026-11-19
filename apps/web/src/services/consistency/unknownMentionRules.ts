import type {CandidateDetectionReason, ExtractProposalInput} from './types';
import {isCommonEnglishWord} from './commonEnglishWords';
import {GENERIC_UNKNOWN_TERMS, MIN_UNKNOWN_CONFIDENCE} from './nameCueWords';
import {
  hasCharacterContextCue,
  hasEntityLikeToken,
  hasLeadingCueWord,
  hasSpecificLeadingCueWord,
  isNonEntityToken,
  looksLikeNumericOrRoman,
  tokenizeNormalized
} from './mentionExtraction';

/**
 * When an unmatched name is worth flagging: why it looks like a name
 * (`getUnknownDetectionReason`), whether a single word qualifies, and which
 * mentions validation suppresses.
 */

const isCommonSingleWordUnknown = (normalized: string): boolean => {
  const tokens = tokenizeNormalized(normalized);
  return tokens.length === 1 && isCommonEnglishWord(tokens[0] ?? '');
};

export const shouldSuppressUnknownMention = (mention: {
  normalized: string;
  surface: string;
  confidence: number;
  detectionReason: CandidateDetectionReason;
}): boolean => {
  const tokens = tokenizeNormalized(mention.normalized);
  if (tokens.length === 0) return true;
  if (mention.confidence < MIN_UNKNOWN_CONFIDENCE) return true;

  if (tokens.length > 1 && !hasEntityLikeToken(tokens)) {
    return true;
  }

  const [first, ...rest] = tokens;
  const last = rest[rest.length - 1] ?? first;
  if (!first || !last) return true;
  if (isNonEntityToken(first) || isNonEntityToken(last)) {
    return true;
  }

  if (tokens.length === 1) {
    const [first] = tokens;
    if (!first || first.length < 4) return true;
    if (GENERIC_UNKNOWN_TERMS.has(first)) return true;
    if (looksLikeNumericOrRoman(first)) return true;
    if (
      isCommonEnglishWord(first) &&
      mention.detectionReason !== 'leading_entity_cue' &&
      mention.detectionReason !== 'direct_address_candidate' &&
      mention.detectionReason !== 'titled_name'
    ) {
      return true;
    }
  }

  return false;
};

export const isEligibleSingleWordUnknown = (params: {
  text: string;
  normalized: string;
  mentionCount: number;
  start: number;
  surface: string;
  end: number;
  detectionReason: CandidateDetectionReason;
  hasDirectAddress: boolean;
}): boolean => {
  const {
    text,
    normalized,
    mentionCount,
    start,
    surface,
    end,
    detectionReason,
    hasDirectAddress
  } = params;
  if (normalized.length < 4) {
    return false;
  }
  if (
    isNonEntityToken(normalized) ||
    GENERIC_UNKNOWN_TERMS.has(normalized) ||
    looksLikeNumericOrRoman(normalized)
  ) {
    return false;
  }

  if (isCommonSingleWordUnknown(normalized)) {
    return hasSpecificLeadingCueWord(text, start) || hasDirectAddress;
  }

  if (detectionReason === 'action_object_candidate') {
    return true;
  }

  if (mentionCount > 1) {
    return true;
  }

  if (hasCharacterContextCue(text, {surface, start, end})) {
    return true;
  }

  return hasLeadingCueWord(text, start);
};

export const getUnknownDetectionReason = (params: {
  source: ExtractProposalInput['source'];
  wordCount: number;
  mentionCount: number;
  hasCue: boolean;
  hasCharacterCue: boolean;
  hasDirectAddress: boolean;
  hasTypedSuffix: boolean;
  mentionReason: CandidateDetectionReason;
}): CandidateDetectionReason | null => {
  const {
    source,
    wordCount,
    mentionCount,
    hasCue,
    hasCharacterCue,
    hasDirectAddress,
    hasTypedSuffix,
    mentionReason
  } = params;
  if (mentionReason === 'titled_name' || mentionReason === 'action_object_candidate') {
    return mentionReason;
  }
  if (hasDirectAddress) {
    return 'direct_address_candidate';
  }
  if (mentionCount > 1) {
    return 'repeated_unknown';
  }
  if (hasCue) {
    return 'leading_entity_cue';
  }
  if (hasCharacterCue) {
    return 'character_context_candidate';
  }
  if (wordCount > 1 && (source !== 'import' || hasTypedSuffix)) {
    return 'multiword_proper_candidate';
  }
  return null;
};
