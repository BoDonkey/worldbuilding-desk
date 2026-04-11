import { saveGuardrailEvent, saveProposal } from './consistencyStorage';
import type {
  ExtractProposalInput,
  ExtractedProposal,
  GuardrailIssue,
  KnownEntityRef,
  ValidationResult
} from './types';

interface CandidateMention {
  surface: string;
  normalized: string;
  start: number;
  end: number;
}

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
  'i',
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
  'the',
  'their',
  'them',
  'then',
  'there',
  'they',
  'to',
  'we',
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

const normalizePhrase = (value: string): string =>
  value
    .trim()
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

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
  'getting',
  'had',
  'has',
  'have',
  'if',
  'maybe',
  'not',
  'perhaps',
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
  'inside',
  'outside',
  'city',
  'town',
  'village',
  'kingdom',
  'empire',
  'capital',
  'guild',
  'guard',
  'team',
  'group',
  'squad',
  'party'
]);

const MIN_UNKNOWN_CONFIDENCE = 0.72;

const tokenizeNormalized = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const isPronounContraction = (token: string): boolean =>
  /^(?:i|you|we|they|he|she|it)(?:'m|'re|'ve|'d|'ll|'s)$/.test(token);

const isNonEntityToken = (token: string): boolean =>
  NON_ENTITY_BOUNDARY_TOKENS.has(token) || isPronounContraction(token);

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

  if (isSentenceStart(text, mention.start)) {
    return false;
  }

  return true;
};

const extractCandidateMentions = (text: string): CandidateMention[] => {
  const pattern = /\b[A-Z][A-Za-z0-9'_-]*(?:\s+[A-Z][A-Za-z0-9'_-]*){0,2}\b/g;
  const matches = Array.from(text.matchAll(pattern));

  return matches
    .map((match) => {
      const surface = (match[0] ?? '').trim();
      const start = match.index ?? 0;
      const end = start + surface.length;
      return {
        surface,
        normalized: normalizePhrase(surface),
        start,
        end
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
    `\\b(?:${escapedCues.join('|')})\\s+(?:the|a|an|his|her|their)?\\s*([A-Za-z][A-Za-z0-9'_-]*(?:\\s+[A-Za-z][A-Za-z0-9'_-]*){0,2})`,
    'gi'
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
      end
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

export class ConsistencyEngineService {
  async extractProposal(input: ExtractProposalInput): Promise<ExtractedProposal> {
    const knownEntityMap = buildKnownEntityMap(input.knownEntities);
    const actionCues = [...ACTION_CUE_WORDS, ...(input.actionCues ?? [])];
    const mentions = [
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
        const known =
          knownMatches.length === 1
            ? knownMatches[0]
            : undefined;
        const mentionCount = mentionCounts.get(mention.normalized) ?? 0;
        const hasCue = hasLeadingCueWord(input.text, mention.start);
        const baseConfidence = known
          ? 0.99
          : Math.min(
              0.92,
              0.58 +
                (mention.surface.split(/\s+/).length > 1 ? 0.16 : 0) +
                (mentionCount > 1 ? 0.13 : 0) +
                (hasCue ? 0.1 : 0)
            );
        return {
          surface: mention.surface,
          normalized: mention.normalized,
          entityId: known?.id,
          entityType: known?.type,
          candidateEntities:
            knownMatches.length > 1
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
          }
        };
      })
      .filter((entityRef) => {
        if (entityRef.entityId) {
          return true;
        }

        const wordCount = entityRef.surface.split(/\s+/).length;
        if (wordCount > 1) {
          return true;
        }

        if (entityRef.normalized.length < 4) {
          return false;
        }

        const mentionCount = mentionCounts.get(entityRef.normalized) ?? 0;
        return mentionCount > 1 || hasLeadingCueWord(input.text, entityRef.span.start);
      });

    const proposal: ExtractedProposal = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      source: input.source,
      text: input.text,
      entities,
      intents: [],
      unresolvedSpans: [],
      createdAt: Date.now()
    };

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
        surface: mention.surface
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
        relatedEntities
      });
    });

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
