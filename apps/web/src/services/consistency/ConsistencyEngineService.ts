import { saveGuardrailEvent, saveProposal } from '../storage';
import type {
  ExtractProposalInput,
  ExtractedProposal,
  GuardrailIssue,
  KnownEntityRef,
  ValidationResult
} from './types';
import {
  isInProgressCanonPrefix,
  normalizeCanonText
} from './textMatcher';
import {ACTION_CUE_WORDS, TYPED_ENTITY_SUFFIX_TOKENS} from './nameCueWords';
import {
  countEntityNameParts,
  extractActionObjectMentionsWithCues,
  extractCandidateMentions,
  extractTitledNameMentions,
  hasCharacterContextCue,
  hasDirectAddressCue,
  hasLeadingCueWord,
  tokenizeNormalized,
  type CandidateMention
} from './mentionExtraction';
import {findUnexpectedScenePresenceIssues} from './scenePresenceCheck';
import {
  getUnknownDetectionReason,
  isEligibleSingleWordUnknown,
  shouldSuppressUnknownMention
} from './unknownMentionRules';

const normalizePhrase = normalizeCanonText;

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

const stripNormalizedTitle = (value: string): string =>
  value.replace(
    /^(?:detective|dr|mr|mrs|ms|mx|officer|prof|professor)\s+/u,
    ''
  );

const getKnownMatchesForMention = (
  normalizedMention: string,
  knownEntityMap: Map<string, KnownEntityRef[]>
): KnownEntityRef[] => {
  const directMatches = knownEntityMap.get(normalizedMention) ?? [];
  if (directMatches.length > 0) {
    return directMatches;
  }

  const untitledMention = stripNormalizedTitle(normalizedMention);
  if (untitledMention === normalizedMention) {
    return [];
  }
  return knownEntityMap.get(untitledMention) ?? [];
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
  const mergedMentions = Array.from(dedupedMentions.values()).sort(
    (left, right) => left.start - right.start || right.end - left.end
  );
  const mentionCounts = new Map<string, number>();
  mergedMentions.forEach((mention) => {
    mentionCounts.set(
      mention.normalized,
      (mentionCounts.get(mention.normalized) ?? 0) + 1
    );
  });

  const entities = mergedMentions
    .map((mention) => {
      const rawMatches = getKnownMatchesForMention(mention.normalized, knownEntityMap);
      const knownMatches = Array.from(
        new Map(rawMatches.map((match) => [match.id, match])).values()
      );
      const known = resolveSingleKnownMatch(knownMatches);
      const mentionCount = mentionCounts.get(mention.normalized) ?? 0;
      const hasCue = hasLeadingCueWord(input.text, mention.start);
      const hasCharacterCue = hasCharacterContextCue(input.text, mention);
      const hasDirectAddress = hasDirectAddressCue(input.text, mention);
      const wordCount = countEntityNameParts(mention.surface);
      const normalizedTokens = tokenizeNormalized(mention.normalized);
      const hasTypedSuffix = TYPED_ENTITY_SUFFIX_TOKENS.has(
        normalizedTokens[normalizedTokens.length - 1] ?? ''
      );
      const detectionReason =
        known || knownMatches.length > 1
          ? 'known_entity'
          : getUnknownDetectionReason({
              source: input.source,
              wordCount,
              mentionCount,
              hasCue,
              hasCharacterCue,
              hasDirectAddress,
              hasTypedSuffix,
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
        detectionReason: entityRef.detectionReason,
        hasDirectAddress: hasDirectAddressCue(input.text, entityRef.span)
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
        detectionReason: mention.detectionReason,
        confidence: mention.confidence
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
        confidence: mention.confidence,
        relatedEntities
      });
    });

    issues.push(...findUnexpectedScenePresenceIssues(proposal));

    const result: ValidationResult = {
      allowCommit: !issues.some((issue) => issue.severity === 'blocking'),
      issues
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
