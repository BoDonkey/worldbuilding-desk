import {getNewFieldLabel} from './worldBibleImportParsing';
import type {WorldBibleImportSectionDraft} from './worldBibleImportParsing';

/**
 * Batch World Bible import (slice 4.99): a heading choice made on one draft
 * can be copied to the same heading on the other drafts. Nothing here saves;
 * drafts stay drafts until they are imported.
 */

interface MatchableDraft {
  id: string;
  categoryId: string;
  parseError?: string;
  status?: 'imported' | 'failed';
  useDetectedSections?: boolean;
  detectedSections?: WorldBibleImportSectionDraft[];
}

const headingKey = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase();

const sameDestination = (a: WorldBibleImportSectionDraft, b: WorldBibleImportSectionDraft) => {
  if (a.action !== b.action) return false;
  if (a.action === 'existing-field') return a.fieldKey === b.fieldKey;
  if (a.action === 'new-field') return headingKey(getNewFieldLabel(a)) === headingKey(getNewFieldLabel(b));
  return true;
};

/**
 * Drafts the source section's destination would change: same category, not
 * imported, structured headings on, with a section of the same heading text
 * that the author has not set by hand and that goes somewhere else today.
 */
export function findMatchingHeadingDrafts<T extends MatchableDraft>(
  drafts: T[],
  draftId: string,
  sectionId: string
): Array<{draftId: string; sectionIds: string[]}> {
  const source = drafts.find((draft) => draft.id === draftId);
  const sourceSection = source?.detectedSections?.find((section) => section.id === sectionId);
  if (!source || !sourceSection) return [];
  const key = headingKey(sourceSection.title);
  return drafts.flatMap((draft) => {
    if (
      draft.id === source.id ||
      draft.categoryId !== source.categoryId ||
      draft.parseError ||
      draft.status === 'imported' ||
      !draft.useDetectedSections
    ) {
      return [];
    }
    const sectionIds = (draft.detectedSections ?? [])
      .filter(
        (section) =>
          headingKey(section.title) === key &&
          !section.chosenByAuthor &&
          !sameDestination(section, sourceSection)
      )
      .map((section) => section.id);
    return sectionIds.length > 0 ? [{draftId: draft.id, sectionIds}] : [];
  });
}

/** The drafts with the source section's destination copied onto each match. */
export function applyHeadingDestinationToMatches<T extends MatchableDraft>(
  drafts: T[],
  draftId: string,
  sectionId: string
): T[] {
  const sourceSection = drafts
    .find((draft) => draft.id === draftId)
    ?.detectedSections?.find((section) => section.id === sectionId);
  const matches = findMatchingHeadingDrafts(drafts, draftId, sectionId);
  if (!sourceSection || matches.length === 0) return drafts;
  const sectionIdsByDraft = new Map(matches.map((match) => [match.draftId, new Set(match.sectionIds)]));
  return drafts.map((draft) => {
    const sectionIds = sectionIdsByDraft.get(draft.id);
    if (!sectionIds) return draft;
    return {
      ...draft,
      detectedSections: draft.detectedSections?.map((section) =>
        sectionIds.has(section.id)
          ? {
              ...section,
              action: sourceSection.action,
              fieldKey: sourceSection.fieldKey,
              newFieldLabel: sourceSection.newFieldLabel
            }
          : section
      )
    };
  });
}
