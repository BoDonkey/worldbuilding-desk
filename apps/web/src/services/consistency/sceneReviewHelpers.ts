import type {WorldEntity, WritingDocument} from '../../entityTypes';
import type {GuardrailIssue} from './types';
import {normalizeCanonText} from './textMatcher';
import {namesLikelyReferToSameCharacter, normalizeRecordName} from './reviewLinkOptions';

/** Pure helpers shared by the Workspace review hooks. */

export const downgradeUnknownIssuesToWarnings = (
  issues: GuardrailIssue[]
): GuardrailIssue[] =>
  issues.map((issue) =>
        issue.code === 'UNKNOWN_ENTITY'
      ? {
          ...issue,
          severity: 'warning',
          message: issue.surface
            ? `Review "${issue.surface}" when you are ready to add or ignore this scene context.`
            : 'Review this name or world term when you are ready to add or ignore it.'
        }
      : issue
  );

export const canonicalizeUnknownSurface = normalizeCanonText;

export const hashString = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

export const getReviewSourceForDocument = (
  doc: WritingDocument
): 'workspace-save' | 'import' =>
  doc.consistencyReviewMode === 'deferred' ? 'import' : 'workspace-save';

const isCloseCharacterName = (candidateName: string, normalizedCharacterName: string): boolean =>
  namesLikelyReferToSameCharacter(candidateName, normalizedCharacterName) ||
  candidateName.includes(normalizedCharacterName) ||
  normalizedCharacterName.includes(candidateName);

/**
 * Another character in the same World Bible category whose name is close to
 * `normalizedCharacterName` (likely the same person), closest first, then by
 * name. Exact name matches are excluded: those are the record itself.
 */
export function findCloseCharacterEntityMatch(params: {
  entities: WorldEntity[];
  categoryId: string;
  normalizedCharacterName: string;
}): WorldEntity | null {
  const {entities, categoryId, normalizedCharacterName} = params;
  return [...entities]
    .filter((candidate) => {
      if (
        candidate.categoryId !== categoryId ||
        normalizeRecordName(candidate.name) === normalizedCharacterName
      ) {
        return false;
      }
      return isCloseCharacterName(normalizeRecordName(candidate.name), normalizedCharacterName);
    })
    .sort((left, right) => {
      const leftClose = isCloseCharacterName(normalizeRecordName(left.name), normalizedCharacterName) ? 0 : 1;
      const rightClose = isCloseCharacterName(normalizeRecordName(right.name), normalizedCharacterName) ? 0 : 1;
      if (leftClose !== rightClose) {
        return leftClose - rightClose;
      }
      return left.name.localeCompare(right.name);
    })[0] ?? null;
}
