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
    return true;
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

    results.push({
      surface,
      normalized,
      start,
      end
    });
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

const buildKnownEntityMap = (
  knownEntities: KnownEntityRef[]
): Map<string, KnownEntityRef> => {
  const map = new Map<string, KnownEntityRef>();
  knownEntities.forEach((entity) => {
    const key = normalizePhrase(entity.name);
    if (key) {
      map.set(key, entity);
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
        const known = knownEntityMap.get(mention.normalized);
        return {
          surface: mention.surface,
          normalized: mention.normalized,
          entityId: known?.id,
          entityType: known?.type,
          confidence: known ? 0.99 : 0.7,
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
    const unknownMentions = proposal.entities.filter((ref) => !ref.entityId);
    const dedupedBySurface = new Map<string, (typeof unknownMentions)[number]>();

    unknownMentions.forEach((mention) => {
      if (!dedupedBySurface.has(mention.normalized)) {
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

    const result: ValidationResult = {
      allowCommit: issues.length === 0,
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
