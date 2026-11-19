import type {ExtractedProposal, GuardrailIssue} from './types';
import {normalizeCanonText as normalizePhrase} from './textMatcher';
import {tokenizeNormalized} from './mentionExtraction';

/**
 * The scene presence check (`UNEXPECTED_SCENE_PRESENCE`): a character first
 * named by a short form well into a scene, with no entrance cue, may be a
 * leftover name from an earlier draft.
 */

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

export const findUnexpectedScenePresenceIssues = (
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
