import type {CandidateDetectionReason} from './types';
import {normalizeCanonText as normalizePhrase} from './textMatcher';
import {
  ACTION_OBJECT_STOP_TOKENS,
  CARDINAL_NUMBER_WORDS,
  CHARACTER_CONTEXT_CUE_WORDS,
  COMMON_SENTENCE_START_WORDS,
  GENERIC_ARTICLE_CUE_WORDS,
  GENERIC_UNKNOWN_TERMS,
  LEADING_ENTITY_CUE_WORDS,
  NON_ENTITY_BOUNDARY_TOKENS,
  NON_ENTITY_SINGLE_WORDS,
  PRONOUN_STARTERS
} from './nameCueWords';

/**
 * Finding name-like mentions in scene text: capitalised name sequences,
 * titled names ("Dr. Vale"), and objects of action cues ("swung the
 * Lantern"), plus the cue checks around a mention that the detector and the
 * unknown-name rules read.
 */

export interface CandidateMention {
  surface: string;
  normalized: string;
  start: number;
  end: number;
  detectionReason: CandidateDetectionReason;
}

const NAME_PARTICLE_PATTERN = String.raw`(?:d[aeiou]s?|de|del|der|di|dos|du|el|la|las|le|of|the|van|von)`;
const JOINED_PARTICLE_NAME_TOKEN_PATTERN = String.raw`(?:d[aeiou]s?|de|del|der|di|dos|du|van|von)\p{Lu}[\p{L}\p{M}\p{N}'_-]*`;
const NAME_TOKEN_PATTERN = String.raw`(?:\p{Lu}[\p{L}\p{M}\p{N}'_-]*|${JOINED_PARTICLE_NAME_TOKEN_PATTERN})`;
const NAME_SEQUENCE_PATTERN = String.raw`${NAME_TOKEN_PATTERN}(?:\s+(?:(?:${NAME_PARTICLE_PATTERN})\s+)?${NAME_TOKEN_PATTERN}){0,4}`;
const TITLE_PATTERN = String.raw`(?:Detective|Dr|Mr|Mrs|Ms|Mx|Officer|Prof|Professor)`;
const WORD_TOKEN_PATTERN = String.raw`[\p{L}\p{M}][\p{L}\p{M}\p{N}'_-]*`;
const TEXT_BOUNDARY_PREFIX = String.raw`(^|[^\p{L}\p{N}_])`;
const TEXT_BOUNDARY_SUFFIX = String.raw`(?=$|[^\p{L}\p{N}_])`;

export const tokenizeNormalized = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const countEntityNameParts = (value: string): number =>
  value
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean).length;

export const looksLikeNumericOrRoman = (value: string): boolean => {
  if (/^\d+$/.test(value)) return true;
  return /^(?:[ivxlcdm]+)$/i.test(value);
};

const isPronounContraction = (token: string): boolean =>
  /^(?:i|you|we|they|he|she|it)(?:'m|'re|'ve|'d|'ll|'s)$/.test(token);

const LEADING_PRONOUN_CONTRACTION_PATTERN =
  /^(?:I|You|We|They|He|She|It)(?:['’]m|['’]re|['’]ve|['’]d|['’]ll|['’]s)\s+/u;

const trimLeadingPronounContraction = (
  surface: string,
  start: number
): {surface: string; start: number} => {
  const match = surface.match(LEADING_PRONOUN_CONTRACTION_PATTERN);
  if (!match) {
    return {surface, start};
  }
  const prefix = match[0] ?? '';
  return {
    surface: surface.slice(prefix.length).trimStart(),
    start: start + prefix.length
  };
};

export const isNonEntityToken = (token: string): boolean =>
  NON_ENTITY_BOUNDARY_TOKENS.has(token) ||
  COMMON_SENTENCE_START_WORDS.has(token) ||
  CARDINAL_NUMBER_WORDS.has(token) ||
  isPronounContraction(token);

export const hasEntityLikeToken = (tokens: string[]): boolean =>
  tokens.some(
    (token) =>
      token.length >= 4 &&
      !isNonEntityToken(token) &&
      !GENERIC_UNKNOWN_TERMS.has(token) &&
      !looksLikeNumericOrRoman(token)
  );

const shouldSuppressMultiWordMention = (
  text: string,
  mention: CandidateMention
): boolean => {
  const tokens = tokenizeNormalized(mention.normalized);
  if (tokens.length < 2) {
    return false;
  }

  const [first, ...rest] = tokens;
  const last = rest[rest.length - 1] ?? first;
  if (!first || !last) {
    return true;
  }

  if (isNonEntityToken(first) || isNonEntityToken(last)) {
    return true;
  }

  if (!hasEntityLikeToken(tokens)) {
    return true;
  }

  if (isSentenceStart(text, mention.start) && isNonEntityToken(first)) {
    return true;
  }

  return false;
};

const isSentenceStart = (text: string, index: number): boolean => {
  for (let i = index - 1; i >= 0; i -= 1) {
    const char = text[i];
    if (char.trim() === '') {
      continue;
    }
    return char === '.' || char === '!' || char === '?' || char === '\n';
  }
  return true;
};

const shouldKeepMention = (text: string, mention: CandidateMention): boolean => {
  const words = mention.surface.split(/\s+/);
  if (words.length > 1) {
    return !shouldSuppressMultiWordMention(text, mention);
  }

  const normalized = mention.normalized;
  if (!normalized || NON_ENTITY_SINGLE_WORDS.has(normalized)) {
    return false;
  }
  if (COMMON_SENTENCE_START_WORDS.has(normalized)) {
    return false;
  }
  if (
    isSentenceStart(text, mention.start) &&
    (CARDINAL_NUMBER_WORDS.has(normalized) || normalized.endsWith('ing'))
  ) {
    return false;
  }

  return true;
};

const isPartOfTitledName = (text: string, start: number): boolean => {
  const prefix = text.slice(Math.max(0, start - 24), start);
  return /(?:^|[^\p{L}\p{N}_])(?:Detective|Dr|Mr|Mrs|Ms|Mx|Officer|Prof|Professor)\.?\s+$/u.test(prefix);
};

export const extractCandidateMentions = (text: string): CandidateMention[] => {
  const pattern = new RegExp(
    `${TEXT_BOUNDARY_PREFIX}(${NAME_SEQUENCE_PATTERN})${TEXT_BOUNDARY_SUFFIX}`,
    'gu'
  );
  const matches = Array.from(text.matchAll(pattern));

  return matches
    .map((match) => {
      const prefix = match[1] ?? '';
      const rawSurface = (match[2] ?? '').trim();
      const start = (match.index ?? 0) + prefix.length;
      const trimmed = trimLeadingPronounContraction(rawSurface, start);
      const surface = trimmed.surface;
      const end = trimmed.start + surface.length;
      return {
        surface,
        normalized: normalizePhrase(surface),
        start: trimmed.start,
        end,
        detectionReason: 'multiword_proper_candidate' as const
      };
    })
    .filter((mention) => mention.normalized.length > 0)
    .filter((mention) => !isPartOfTitledName(text, mention.start))
    .filter((mention) => shouldKeepMention(text, mention));
};

export const extractTitledNameMentions = (text: string): CandidateMention[] => {
  const pattern = new RegExp(
    `${TEXT_BOUNDARY_PREFIX}(${TITLE_PATTERN}\\.?\\s+${NAME_SEQUENCE_PATTERN})${TEXT_BOUNDARY_SUFFIX}`,
    'gu'
  );
  const matches = Array.from(text.matchAll(pattern));

  return matches
    .map((match) => {
      const prefix = match[1] ?? '';
      const surface = (match[2] ?? '').trim();
      const start = (match.index ?? 0) + prefix.length;
      const end = start + surface.length;
      return {
        surface,
        normalized: normalizePhrase(surface),
        start,
        end,
        detectionReason: 'titled_name' as const
      };
    })
    .filter((mention) => mention.normalized.length > 0)
    .filter((mention) => shouldKeepMention(text, mention));
};

export const extractActionObjectMentionsWithCues = (
  text: string,
  actionCues: string[]
): CandidateMention[] => {
  const uniqueCues = Array.from(
    new Set(
      actionCues
        .map((cue) => cue.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  if (uniqueCues.length === 0) {
    return [];
  }
  const escapedCues = uniqueCues.map((word) =>
    word
      .split(/\s+/)
      .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+')
  );
  const actionPattern = new RegExp(
    `\\b(?:${escapedCues.join('|')})\\s+(?:the|a|an|his|her|their)?\\s*(${WORD_TOKEN_PATTERN}(?:\\s+${WORD_TOKEN_PATTERN}){0,2})`,
    'giu'
  );
  const results: CandidateMention[] = [];

  for (const match of text.matchAll(actionPattern)) {
    const full = match[0] ?? '';
    const rawSurface = (match[1] ?? '').trim();
    if (!rawSurface) {
      continue;
    }

    const surfaceTokens = rawSurface.split(/\s+/);
    const stopIndex = surfaceTokens.findIndex((token) =>
      ACTION_OBJECT_STOP_TOKENS.has(normalizePhrase(token))
    );
    const surface = surfaceTokens
      .slice(0, stopIndex >= 0 ? stopIndex : surfaceTokens.length)
      .join(' ');
    if (!surface) continue;

    const normalized = normalizePhrase(surface);
    if (!normalized) {
      continue;
    }

    const firstToken = normalized.split(/\s+/)[0];
    if (PRONOUN_STARTERS.has(firstToken)) {
      continue;
    }

    const fullStart = match.index ?? 0;
    const objectOffset = full.toLowerCase().lastIndexOf(surface.toLowerCase());
    const start = objectOffset >= 0 ? fullStart + objectOffset : fullStart;
    const end = start + surface.length;

    const mention = {
      surface,
      normalized,
      start,
      end,
      detectionReason: 'action_object_candidate' as const
    };

    if (shouldSuppressMultiWordMention(text, mention)) {
      continue;
    }

    results.push(mention);
  }

  return results;
};

export const hasLeadingCueWord = (text: string, mentionStart: number): boolean => {
  const prefix = text.slice(0, mentionStart).trimEnd();
  if (!prefix) return false;
  const match = prefix.match(/([A-Za-z]+)$/);
  const prevWord = (match?.[1] ?? '').toLowerCase();
  if (prevWord === 'and' || prevWord === 'or') {
    const conjoinedPattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}_])(${Array.from(LEADING_ENTITY_CUE_WORDS).join('|')})\\s+${NAME_SEQUENCE_PATTERN}\\s+(?:and|or)$`,
      'iu'
    );
    return conjoinedPattern.test(prefix);
  }
  return LEADING_ENTITY_CUE_WORDS.has(prevWord);
};

export const hasSpecificLeadingCueWord = (text: string, mentionStart: number): boolean => {
  const prefix = text.slice(0, mentionStart).trimEnd();
  const prevWord = (prefix.match(/([A-Za-z]+)$/)?.[1] ?? '').toLowerCase();
  return hasLeadingCueWord(text, mentionStart) && !GENERIC_ARTICLE_CUE_WORDS.has(prevWord);
};

export const hasCharacterContextCue = (
  text: string,
  mention: {
    surface: string;
    start: number;
    end: number;
  }
): boolean => {
  if (/['’]s$/u.test(mention.surface)) {
    return true;
  }

  const suffix = text.slice(mention.end, mention.end + 48);
  const prefix = text.slice(Math.max(0, mention.start - 8), mention.start);
  if (
    /^\s*,/u.test(suffix) &&
    !/^\s*,\s*["”’]/u.test(suffix) &&
    /["“‘]\s*$/u.test(prefix)
  ) {
    return true;
  }
  const nextWord = suffix.match(/^\s+(?:['’]s\s+)?([\p{L}\p{M}][\p{L}\p{M}\p{N}'_-]*)/u)?.[1]
    .toLowerCase();

  return !!nextWord && CHARACTER_CONTEXT_CUE_WORDS.has(nextWord);
};

export const hasDirectAddressCue = (
  text: string,
  mention: {start: number; end: number}
): boolean => {
  const suffix = text.slice(mention.end, mention.end + 8);
  const prefix = text.slice(Math.max(0, mention.start - 8), mention.start);
  return (
    /^\s*,/u.test(suffix) &&
    !/^\s*,\s*["”’]/u.test(suffix) &&
    /["“‘]\s*$/u.test(prefix)
  );
};
