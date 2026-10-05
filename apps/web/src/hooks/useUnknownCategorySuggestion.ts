import {useCallback} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {EntityCategory, Project, WritingDocument} from '../entityTypes';
import {saveCategory} from '../categoryStorage';
import type {GuardrailIssue} from '../services/consistency';
import {canonicalizeUnknownSurface} from '../services/consistency/sceneReviewHelpers';
import {
  findCategoryIdForSuggestedKind,
  suggestUnknownCategory
} from '../services/consistency/unknownCategorySuggestion';
import {
  buildWorldCategory,
  normalizeWorldCategoryName
} from '../services/worldBible/categoryAuthoring';
import type {ConsistencyFeedback} from './useConsistencyReviewRuns';

/** World Bible type suggestions for unknown names, and creating a new type from review. */
export function useUnknownCategorySuggestion({
  activeProject,
  categories,
  setCategories,
  documents,
  selectedDocumentId,
  unknownGuardrailIssues,
  setFeedback
}: {
  activeProject: Project | null;
  categories: EntityCategory[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  documents: WritingDocument[];
  selectedDocumentId: string | null;
  unknownGuardrailIssues: GuardrailIssue[];
  setFeedback: ConsistencyFeedback;
}) {
  const getSuggestedUnknownCategoryId = useCallback(
    (surface: string): string | undefined => {
      const normalizedSurface = canonicalizeUnknownSurface(surface);
      const issue = normalizedSurface
        ? unknownGuardrailIssues.find(
            (candidate) =>
              candidate.code === 'UNKNOWN_ENTITY' &&
              canonicalizeUnknownSurface(candidate.surface ?? '') === normalizedSurface
          )
        : undefined;
      const issueDocument =
        issue && selectedDocumentId
          ? documents.find((document) => document.id === selectedDocumentId) ?? null
          : null;
      const suggested = suggestUnknownCategory({
        surface,
        issue,
        documentContent: issueDocument ? issueDocument.content : null
      });
      return findCategoryIdForSuggestedKind(categories, suggested);
    },
    [categories, documents, selectedDocumentId, unknownGuardrailIssues]
  );

  const createWorldCategory = useCallback(
    async (name: string): Promise<EntityCategory> => {
      if (!activeProject) {
        throw new Error('Open a project before creating a World Bible type.');
      }

      const normalizedName = normalizeWorldCategoryName(name);
      const existing = categories.find(
        (category) => category.name.toLowerCase() === normalizedName.toLowerCase()
      );
      if (existing) {
        return existing;
      }

      const category = buildWorldCategory({
        projectId: activeProject.id,
        name: normalizedName
      });
      const slugMatch = categories.find((entry) => entry.slug === category.slug);
      if (slugMatch) {
        return slugMatch;
      }

      await saveCategory(category);
      setCategories((current) => [...current, category]);
      setFeedback({
        tone: 'success',
        message: `${category.name} is ready. The review candidate is still open.`
      });
      return category;
    },
    [activeProject, categories, setCategories, setFeedback]
  );

  return {getSuggestedUnknownCategoryId, createWorldCategory};
}
