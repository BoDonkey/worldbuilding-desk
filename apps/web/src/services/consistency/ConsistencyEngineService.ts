import { saveGuardrailEvent, saveProposal } from './consistencyStorage';
import type {
  ExtractProposalInput,
  ExtractedProposal,
  GuardrailIssue,
  KnownEntityRef,
  CandidateDetectionReason,
  ValidationResult
} from './types';
import {
  isInProgressCanonPrefix,
  normalizeCanonText
} from './textMatcher';

interface CandidateMention {
  surface: string;
  normalized: string;
  start: number;
  end: number;
  detectionReason: CandidateDetectionReason;
}

const SCENE_ENTRY_CUE_WORDS = new Set([
  'arrived',
  'approached',
  'appeared',
  'came',
  'entered',
  'followed',
  'joined',
  'knocked',
  'returned',
  'showed',
  'stepped',
  'walked'
]);

const SCENE_PROGRESS_CHAR_THRESHOLD = 240;
const SCENE_PROGRESS_SENTENCE_THRESHOLD = 2;

const NON_ENTITY_SINGLE_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'for',
  'from',
  'he',
  'her',
  'hers',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'it',
  'its',
  'my',
  'of',
  'on',
  'or',
  'our',
  'she',
  'so',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'three',
  'these',
  'this',
  'those',
  'though',
  'they',
  'to',
  'we',
  'what',
  'when',
  'where',
  'whether',
  'which',
  'while',
  'who',
  'why',
  'with',
  'you',
  'your',
  'yours',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
]);

const COMMON_SENTENCE_START_WORDS = new Set([
  'dont',
  "don't",
  'look',
  'some'
]);

const CARDINAL_NUMBER_WORDS = new Set([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty'
]);

const normalizePhrase = normalizeCanonText;

const NAME_TOKEN_PATTERN = String.raw`\p{Lu}[\p{L}\p{M}\p{N}'_-]*`;
const NAME_PARTICLE_PATTERN = String.raw`(?:d[aeiou]s?|de|del|der|di|dos|du|el|la|las|le|of|the|van|von)`;
const NAME_SEQUENCE_PATTERN = String.raw`${NAME_TOKEN_PATTERN}(?:\s+(?:(?:${NAME_PARTICLE_PATTERN})\s+)?${NAME_TOKEN_PATTERN}){0,2}`;
const TITLE_PATTERN = String.raw`(?:Detective|Dr|Mr|Mrs|Ms|Mx|Officer|Prof|Professor)`;
const WORD_TOKEN_PATTERN = String.raw`[\p{L}\p{M}][\p{L}\p{M}\p{N}'_-]*`;
const TEXT_BOUNDARY_PREFIX = String.raw`(^|[^\p{L}\p{N}_])`;
const TEXT_BOUNDARY_SUFFIX = String.raw`(?=$|[^\p{L}\p{N}_])`;

const LEADING_ENTITY_CUE_WORDS = new Set([
  'the',
  'a',
  'an',
  'named',
  'called',
  'from',
  'to',
  'into',
  'toward',
  'towards',
  'at',
  'in',
  'near',
  'inside',
  'outside',
  'with',
  'using'
]);

const ACTION_CUE_WORDS = [
  'swing',
  'swung',
  'use',
  'used',
  'equip',
  'equipped',
  'drink',
  'drank',
  'cast',
  'wield',
  'wielded',
  'grab',
  'grabbed',
  'draw',
  'drew',
  'pick up',
  'picked up',
  'threw',
  'throw'
];

const CHARACTER_CONTEXT_CUE_WORDS = new Set([
  'arrived',
  'asked',
  'attacked',
  'believed',
  'called',
  'closed',
  'could',
  'crossed',
  'entered',
  'felt',
  'fought',
  'found',
  'grabbed',
  'hate',
  'hated',
  'hates',
  'held',
  'knew',
  'laughed',
  'love',
  'loved',
  'loves',
  'looked',
  'moved',
  'opened',
  'replied',
  'returned',
  'said',
  'saw',
  'shouted',
  'spoke',
  'thought',
  'told',
  'walked',
  'wanted',
  'was',
  'went',
  'whispered',
  'would'
]);

const PRONOUN_STARTERS = new Set([
  'he',
  'she',
  'they',
  'it',
  'we',
  'i',
  'you',
  'him',
  'her',
  'them'
]);

const NON_ENTITY_BOUNDARY_TOKENS = new Set([
  ...NON_ENTITY_SINGLE_WORDS,
  'all',
  'am',
  'are',
  'been',
  'being',
  'did',
  'do',
  'does',
  'doing',
  'dont',
  "don't",
  'despite',
  'getting',
  'had',
  'has',
  'have',
  'if',
  'maybe',
  'not',
  'perhaps',
  'reflecting',
  'some',
  'typical',
  'was',
  'were',
  'when',
  'while'
]);

const GENERIC_UNKNOWN_TERMS = new Set([
  'chapter',
  'chapters',
  'scene',
  'scenes',
  'page',
  'pages',
  'paragraph',
  'paragraphs',
  'line',
  'lines',
  'part',
  'book',
  'books',
  'day',
  'days',
  'night',
  'nights',
  'morning',
  'afternoon',
  'evening',
  'today',
  'tomorrow',
  'yesterday',
  'week',
  'month',
  'year',
  'years',
  'north',
  'south',
  'east',
  'west',
  'left',
  'right',
  'center',
  'middle',
  'front',
  'back',
  'above',
  'below',
  'inside',
  'outside',
  'office',
  'offices',
  'room',
  'rooms',
  'hall',
  'halls',
  'hallway',
  'hallways',
  'door',
  'doors',
  'window',
  'windows',
  'wall',
  'walls',
  'floor',
  'floors',
  'stairs',
  'tower',
  'towers',
  'road',
  'roads',
  'street',
  'streets',
  'city',
  'cities',
  'town',
  'towns',
  'village',
  'villages',
  'kingdom',
  'kingdoms',
  'empire',
  'empires',
  'capital',
  'capitals',
  'guild',
  'guilds',
  'guard',
  'guards',
  'team',
  'teams',
  'group',
  'groups',
  'squad',
  'squads',
  'party',
  'parties',
  'people',
  'person',
  'man',
  'men',
  'woman',
  'women',
  'child',
  'children',
  'friend',
  'friends',
  'enemy',
  'enemies',
  'hand',
  'hands',
  'head',
  'eyes',
  'face',
  'voice',
  'word',
  'words',
  'each',
  'every',
  'other',
  'another',
  'same',
  'first',
  'second',
  'third',
  'last',
  'next',
  'only',
  'again',
  'still',
  'just',
  'even'
]);

const MIN_UNKNOWN_CONFIDENCE = 0.72;

const tokenizeNormalized = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const countEntityNameParts = (value: string): number =>
  value
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean).length;

const isPronounContraction = (token: string): boolean =>
  /^(?:i|you|we|they|he|she|it)(?:'m|'re|'ve|'d|'ll|'s)$/.test(token);

const isNonEntityToken = (token: string): boolean =>
  NON_ENTITY_BOUNDARY_TOKENS.has(token) ||
  COMMON_SENTENCE_START_WORDS.has(token) ||
  CARDINAL_NUMBER_WORDS.has(token) ||
  isPronounContraction(token);

const hasEntityLikeToken = (tokens: string[]): boolean =>
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

const extractCandidateMentions = (text: string): CandidateMention[] => {
  const pattern = new RegExp(
    `${TEXT_BOUNDARY_PREFIX}(${NAME_SEQUENCE_PATTERN})${TEXT_BOUNDARY_SUFFIX}`,
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
        detectionReason: 'multiword_proper_candidate' as const
      };
    })
    .filter((mention) => mention.normalized.length > 0)
    .filter((mention) => !isPartOfTitledName(text, mention.start))
    .filter((mention) => shouldKeepMention(text, mention));
};

const extractTitledNameMentions = (text: string): CandidateMention[] => {
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

const extractActionObjectMentionsWithCues = (
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
    const surface = (match[1] ?? '').trim();
    if (!surface) {
      continue;
    }

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

const hasLeadingCueWord = (text: string, mentionStart: number): boolean => {
  const prefix = text.slice(0, mentionStart).trimEnd();
  if (!prefix) return false;
  const match = prefix.match(/([A-Za-z]+)$/);
  const prevWord = (match?.[1] ?? '').toLowerCase();
  return LEADING_ENTITY_CUE_WORDS.has(prevWord);
};

const hasCharacterContextCue = (
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
  if (/^\s*,/u.test(suffix) && /["“‘]\s*$/u.test(prefix)) {
    return true;
  }
  const nextWord = suffix.match(/^\s+(?:['’]s\s+)?([\p{L}\p{M}][\p{L}\p{M}\p{N}'_-]*)/u)?.[1]
    .toLowerCase();

  return !!nextWord && CHARACTER_CONTEXT_CUE_WORDS.has(nextWord);
};

const countSceneSentencesBefore = (text: string, index: number): number =>
  (text.slice(0, index).match(/[.!?](?:\s|$)/g) ?? []).length;

const hasSceneEntryCue = (text: string, mention: {start: number; end: number}): boolean => {
  const prefix = text.slice(Math.max(0, mention.start - 48), mention.start).toLowerCase();
  if (
    /\b(?:when|as|after|before)\s+$/u.test(prefix) ||
    /\b(?:then|suddenly)\s+$/u.test(prefix)
  ) {
    return true;
  }
  const suffix = text.slice(mention.end, mention.end + 48).toLowerCase();
  const nextWord = suffix.match(/^\s+([\p{L}\p{M}][\p{L}\p{M}\p{N}'_-]*)/u)?.[1];
  return !!nextWord && SCENE_ENTRY_CUE_WORDS.has(nextWord);
};

const findUnexpectedScenePresenceIssues = (
  proposal: ExtractedProposal
): GuardrailIssue[] => {
  type ResolvedCharacterMention = ExtractedProposal['entities'][number] & {
    entityId: string;
    entityType: 'character';
    entityName: string;
  };
  const firstMentionsByCharacterId = new Map<
    string,
    ResolvedCharacterMention
  >();

  proposal.entities
    .filter(
      (ref): ref is ResolvedCharacterMention =>
        ref.entityId !== undefined &&
        ref.entityType === 'character' &&
        typeof ref.entityName === 'string'
    )
    .forEach((ref) => {
      const existing = firstMentionsByCharacterId.get(ref.entityId);
      if (!existing || ref.span.start < existing.span.start) {
        firstMentionsByCharacterId.set(ref.entityId, ref);
      }
    });

  return Array.from(firstMentionsByCharacterId.values())
    .filter((ref) => {
      if (ref.span.start < SCENE_PROGRESS_CHAR_THRESHOLD) {
        return false;
      }
      if (countSceneSentencesBefore(proposal.text, ref.span.start) < SCENE_PROGRESS_SENTENCE_THRESHOLD) {
        return false;
      }
      if (hasSceneEntryCue(proposal.text, ref.span)) {
        return false;
      }

      const surfaceTokens = tokenizeNormalized(ref.normalized);
      const canonicalTokens = tokenizeNormalized(normalizePhrase(ref.entityName));
      if (surfaceTokens.length !== 1 || canonicalTokens.length < 2) {
        return false;
      }

      return ref.normalized !== normalizePhrase(ref.entityName);
    })
    .map((ref) => ({
      code: 'UNEXPECTED_SCENE_PRESENCE' as const,
      severity: 'warning' as const,
      message:
        `"${ref.surface}" is the first mention of ${ref.entityName} in this scene and appears after the scene is already underway. ` +
        'Confirm this entrance is intentional and not a leftover name from an earlier draft.',
      span: ref.span,
      surface: ref.surface,
      detectionReason: ref.detectionReason,
      relatedEntities: [
        {
          id: ref.entityId,
          name: ref.entityName,
          type: 'character' as const
        }
      ]
    }));
};

const looksLikeNumericOrRoman = (value: string): boolean => {
  if (/^\d+$/.test(value)) return true;
  return /^(?:[ivxlcdm]+)$/i.test(value);
};

const shouldSuppressUnknownMention = (mention: {
  normalized: string;
  surface: string;
  confidence: number;
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
  }

  return false;
};

const isEligibleSingleWordUnknown = (params: {
  text: string;
  normalized: string;
  mentionCount: number;
  start: number;
  surface: string;
  end: number;
  detectionReason: CandidateDetectionReason;
}): boolean => {
  const {text, normalized, mentionCount, start, surface, end, detectionReason} = params;
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

const getUnknownDetectionReason = (params: {
  source: ExtractProposalInput['source'];
  wordCount: number;
  mentionCount: number;
  hasCue: boolean;
  hasCharacterCue: boolean;
  mentionReason: CandidateDetectionReason;
}): CandidateDetectionReason | null => {
  const {source, wordCount, mentionCount, hasCue, hasCharacterCue, mentionReason} = params;
  if (mentionReason === 'titled_name' || mentionReason === 'action_object_candidate') {
    return mentionReason;
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
  if (wordCount > 1 && source !== 'import') {
    return 'multiword_proper_candidate';
  }
  return null;
};

const buildKnownEntityMap = (
  knownEntities: KnownEntityRef[]
): Map<string, KnownEntityRef[]> => {
  const map = new Map<string, KnownEntityRef[]>();
  knownEntities.forEach((entity) => {
    const key = normalizePhrase(entity.name);
    if (key) {
      const existing = map.get(key) ?? [];
      existing.push(entity);
      map.set(key, existing);
    }
  });
  return map;
};

const resolveSingleKnownMatch = (matches: KnownEntityRef[]): KnownEntityRef | undefined => {
  if (matches.length === 1) {
    return matches[0];
  }
  const normalizedNames = new Set(matches.map((match) => normalizePhrase(match.name)));
  if (normalizedNames.size === 1) {
    return matches[0];
  }
  return undefined;
};

export function buildExtractedProposal(
  input: ExtractProposalInput,
  options: {
    id?: string;
    createdAt?: number;
  } = {}
): ExtractedProposal {
  const knownEntityMap = buildKnownEntityMap(input.knownEntities);
  const knownEntityNames = Array.from(knownEntityMap.keys());
  const actionCues = [...ACTION_CUE_WORDS, ...(input.actionCues ?? [])];
  const mentions = [
    ...extractTitledNameMentions(input.text),
    ...extractCandidateMentions(input.text),
    ...extractActionObjectMentionsWithCues(input.text, actionCues)
  ];
  const dedupedMentions = new Map<string, CandidateMention>();
  mentions.forEach((mention) => {
    const key = `${mention.start}:${mention.end}:${mention.normalized}`;
    if (!dedupedMentions.has(key)) {
      dedupedMentions.set(key, mention);
    }
  });
  const mergedMentions = Array.from(dedupedMentions.values());
  const mentionCounts = new Map<string, number>();
  mergedMentions.forEach((mention) => {
    mentionCounts.set(
      mention.normalized,
      (mentionCounts.get(mention.normalized) ?? 0) + 1
    );
  });

  const entities = mergedMentions
    .map((mention) => {
      const rawMatches = knownEntityMap.get(mention.normalized) ?? [];
      const knownMatches = Array.from(
        new Map(rawMatches.map((match) => [match.id, match])).values()
      );
      const known = resolveSingleKnownMatch(knownMatches);
      const mentionCount = mentionCounts.get(mention.normalized) ?? 0;
      const hasCue = hasLeadingCueWord(input.text, mention.start);
      const hasCharacterCue = hasCharacterContextCue(input.text, mention);
      const wordCount = countEntityNameParts(mention.surface);
      const detectionReason =
        known || knownMatches.length > 1
          ? 'known_entity'
          : getUnknownDetectionReason({
              source: input.source,
              wordCount,
              mentionCount,
              hasCue,
              hasCharacterCue,
              mentionReason: mention.detectionReason
            });
      const baseConfidence = known
        ? 0.99
        : Math.min(
            0.92,
            0.72 +
              (wordCount > 1 ? 0.16 : 0) +
              (mentionCount > 1 ? 0.16 : 0) +
              (hasCue ? 0.1 : 0) +
              (hasCharacterCue ? 0.1 : 0) +
              (mention.detectionReason === 'titled_name' ? 0.1 : 0)
          );
      return {
        surface: mention.surface,
        normalized: mention.normalized,
        entityId: known?.id,
        entityType: known?.type,
        entityName: known?.name,
        candidateEntities:
          knownMatches.length > 1 && !known
            ? knownMatches.map((match) => ({
                id: match.id,
                name: match.name,
                type: match.type
              }))
            : undefined,
        confidence: baseConfidence,
        span: {
          start: mention.start,
          end: mention.end
        },
        detectionReason
      };
    })
    .filter((entityRef) => {
      if (entityRef.entityId) {
        return true;
      }
      if (!entityRef.detectionReason) {
        return false;
      }
      if (isInProgressCanonPrefix(entityRef.normalized, knownEntityNames)) {
        return false;
      }

      const wordCount = countEntityNameParts(entityRef.surface);
      if (wordCount > 1) {
        return true;
      }

      const mentionCount = mentionCounts.get(entityRef.normalized) ?? 0;
      return isEligibleSingleWordUnknown({
        text: input.text,
        normalized: entityRef.normalized,
        mentionCount,
        start: entityRef.span.start,
        surface: entityRef.surface,
        end: entityRef.span.end,
        detectionReason: entityRef.detectionReason
      });
    })
    .map((entityRef) => ({
      ...entityRef,
      detectionReason: entityRef.detectionReason ?? 'multiword_proper_candidate'
    }));

  const proposal: ExtractedProposal = {
    id: options.id ?? crypto.randomUUID(),
    projectId: input.projectId,
    source: input.source,
    text: input.text,
    entities,
    intents: [],
    unresolvedSpans: [],
    createdAt: options.createdAt ?? Date.now()
  };

  return proposal;
}

export class ConsistencyEngineService {
  async extractProposal(input: ExtractProposalInput): Promise<ExtractedProposal> {
    const proposal = buildExtractedProposal(input);
    await saveProposal(proposal);
    return proposal;
  }

  async validateProposal(proposal: ExtractedProposal): Promise<ValidationResult> {
    const unknownMentions = proposal.entities.filter(
      (ref) =>
        !ref.entityId &&
        !(ref.candidateEntities && ref.candidateEntities.length > 1) &&
        !shouldSuppressUnknownMention(ref)
    );
    const dedupedBySurface = new Map<string, (typeof unknownMentions)[number]>();

    unknownMentions.forEach((mention) => {
      const existing = dedupedBySurface.get(mention.normalized);
      if (!existing || mention.confidence > existing.confidence) {
        dedupedBySurface.set(mention.normalized, mention);
      }
    });

    const issues: GuardrailIssue[] = Array.from(dedupedBySurface.values()).map(
      (mention) => ({
        code: 'UNKNOWN_ENTITY',
        severity: 'blocking',
        message: `Entity '${mention.surface}' not found. Create it before saving.`,
        span: mention.span,
        surface: mention.surface,
        detectionReason: mention.detectionReason
      })
    );

    const ambiguousMentions = proposal.entities.filter(
      (ref) => (ref.candidateEntities?.length ?? 0) > 1
    );
    const dedupedAmbiguous = new Map<string, (typeof ambiguousMentions)[number]>();
    ambiguousMentions.forEach((mention) => {
      if (!dedupedAmbiguous.has(mention.normalized)) {
        dedupedAmbiguous.set(mention.normalized, mention);
      }
    });

    Array.from(dedupedAmbiguous.values()).forEach((mention) => {
      const relatedEntities = mention.candidateEntities ?? [];
      const candidateNames = relatedEntities.map((entity) => entity.name).join(', ');
      issues.push({
        code: 'AMBIGUOUS_REFERENCE',
        severity: 'warning',
        message:
          `Reference '${mention.surface}' matches multiple records: ${candidateNames}. ` +
          'Clarify the target entity in this scene.',
        span: mention.span,
        surface: mention.surface,
        detectionReason: mention.detectionReason,
        relatedEntities
      });
    });

    issues.push(...findUnexpectedScenePresenceIssues(proposal));

    const result: ValidationResult = {
      allowCommit: !issues.some((issue) => issue.severity === 'blocking'),
      issues,
      proposedMutations: []
    };

    await saveGuardrailEvent({
      id: crypto.randomUUID(),
      proposalId: proposal.id,
      projectId: proposal.projectId,
      kind: result.allowCommit ? 'validation_passed' : 'validation_blocked',
      payload: {
        issues,
        validation: result
      },
      createdAt: Date.now()
    });

    return result;
  }

  async applyProposal(proposal: ExtractedProposal, validation: ValidationResult): Promise<void> {
    await saveGuardrailEvent({
      id: crypto.randomUUID(),
      proposalId: proposal.id,
      projectId: proposal.projectId,
      kind: 'apply',
      payload: {
        validation
      },
      createdAt: Date.now()
    });
  }
}
