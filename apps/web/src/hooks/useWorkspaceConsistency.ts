import {useCallback, useMemo, useState} from 'react';
import type {Dispatch, MutableRefObject, SetStateAction} from 'react';
import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  EntityCategory,
  Project,
  ProjectSettings,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import type {RAGProvider} from '../services/rag/RAGService';
import type {ConsistencyAlias, GuardrailIssue} from '../services/consistency';
import type {WorldEngine} from '../services/worldEngine';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import type {WorkspaceAnnotationSummary} from '../services/consistency/workspaceAnnotations';
import {summarizeWorkspaceReviewSurfaces} from '../services/consistency/workspaceAnnotations';
import type {ActorResolution} from '../services/characters/characterIdentity';
import {
  buildCharacterCategoryIds,
  buildCharacterLoreEntityIdByCharacterId,
  buildKnownConsistencyEntities
} from '../services/consistency/reviewLinkOptions';
import {
  buildHighlightableReviewIssues,
  buildReviewReadiness,
  filterUnknownGuardrailIssues,
  mapReviewAnnotationsByIssueKey,
  type ConsistencyReviewItem,
  type ReviewReadiness
} from '../services/consistency/reviewReadiness';
import {canonicalizeUnknownSurface} from '../services/consistency/sceneReviewHelpers';
import {
  useConsistencyReviewRuns,
  type ConsistencyFeedback,
  type ConsistencySystemHistory
} from './useConsistencyReviewRuns';
import {useReviewPreferences} from './useReviewPreferences';
import {useSceneSaveReview} from './useSceneSaveReview';
import {useStateMutationReview} from './useStateMutationReview';
import {useUnknownCategorySuggestion} from './useUnknownCategorySuggestion';
import {useUnknownEntityDismissal} from './useUnknownEntityDismissal';
import {useUnknownEntityResolution} from './useUnknownEntityResolution';

export {mapReviewAnnotationsByIssueKey};
export type {
  ReviewReadiness,
  ReviewReadinessState
} from '../services/consistency/reviewReadiness';
export type {
  StateMutationReviewGroupHiddenCounts,
  StateMutationReviewItem
} from '../services/consistency/mutationReviewGrouping';

const EMPTY_ANNOTATION_SUMMARY: WorkspaceAnnotationSummary = {
  totalCount: 0,
  inlineVisibleCount: 0,
  passiveCount: 0,
  suppressedCount: 0,
  blockingCount: 0
};

interface UseWorkspaceConsistencyParams {
  activeProject: Project | null;
  documents: WritingDocument[];
  setDocuments: Dispatch<SetStateAction<WritingDocument[]>>;
  entities: WorldEntity[];
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  categories: EntityCategory[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  aliases: ConsistencyAlias[];
  setAliases: Dispatch<SetStateAction<ConsistencyAlias[]>>;
  characters: Character[];
  canonicalFacts: CanonicalFact[];
  characterSheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  selectedDocumentId: string | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  resolvedActionCues: string[];
  worldEngine: WorldEngine;
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  refreshMemories: () => Promise<void>;
  setSelectedCreatedAt: Dispatch<SetStateAction<number | null>>;
  setSaveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'saved'>>;
  setLastSavedAt: Dispatch<SetStateAction<number | null>>;
  lastAutosaveErrorRef: MutableRefObject<string | null>;
  setFeedback: ConsistencyFeedback;
  addSystemHistory: ConsistencySystemHistory;
}

/**
 * Workspace review, composed from responsibility hooks (3.16): review
 * preferences, scene save review, review runs, state-change review, and
 * unknown-name suggestion, resolution, and dismissal. This hook owns the
 * shared review state (scene issues and the review queue), the known-entity
 * lookups, and the derived highlights and readiness; its return shape is the
 * single surface the Workspace uses.
 */
export const useWorkspaceConsistency = ({
  activeProject,
  documents,
  setDocuments,
  entities,
  setEntities,
  categories,
  setCategories,
  aliases,
  setAliases,
  characters,
  canonicalFacts,
  characterSheets,
  actorResolutions,
  ruleset,
  stateMutationEvents,
  selectedDocumentId,
  projectSettings,
  saveProjectSettings,
  resolvedActionCues,
  worldEngine,
  ragService,
  shodhService,
  refreshMemories,
  setSelectedCreatedAt,
  setSaveStatus,
  setLastSavedAt,
  lastAutosaveErrorRef,
  setFeedback,
  addSystemHistory
}: UseWorkspaceConsistencyParams) => {
  const [guardrailIssues, setGuardrailIssues] = useState<GuardrailIssue[]>([]);
  const [consistencyReviewItems, setConsistencyReviewItems] = useState<
    ConsistencyReviewItem[]
  >([]);
  const {
    dismissedUnknownByDocument,
    setDismissedUnknownByDocument,
    hiddenStateMutationReviewKeys,
    setHiddenStateMutationReviewKeys,
    isReviewPrefsHydrated
  } = useReviewPreferences({activeProject, projectSettings, saveProjectSettings});

  const characterCategoryIds = useMemo(
    () => buildCharacterCategoryIds(categories),
    [categories]
  );
  const characterLoreEntityIdByCharacterId = useMemo(
    () =>
      buildCharacterLoreEntityIdByCharacterId({
        characterCategoryIds,
        characters,
        entities
      }),
    [characterCategoryIds, characters, entities]
  );
  const knownConsistencyEntities = useMemo(
    () =>
      buildKnownConsistencyEntities({
        entities,
        aliases,
        characterLoreEntityIdByCharacterId
      }),
    [aliases, characterLoreEntityIdByCharacterId, entities]
  );
  const knownConsistencySurfaceSet = useMemo(
    () =>
      new Set(
        knownConsistencyEntities
          .map((entity) => canonicalizeUnknownSurface(entity.name))
          .filter(Boolean)
      ),
    [knownConsistencyEntities]
  );

  const filterDismissedUnknownIssues = useCallback(
    (docId: string, issues: GuardrailIssue[]): GuardrailIssue[] => {
      const dismissed = new Set(
        (dismissedUnknownByDocument[docId] ?? []).map((surface) =>
          canonicalizeUnknownSurface(surface)
        )
      );
      const ignored = new Set(
        (projectSettings?.ignoredUnknownSurfaces ?? []).map((surface) =>
          canonicalizeUnknownSurface(surface)
        )
      );
      if (dismissed.size === 0 && ignored.size === 0) {
        return issues;
      }
      return issues.filter((issue) => {
        if (issue.code !== 'UNKNOWN_ENTITY') {
          return true;
        }
        const surface = issue.surface ? canonicalizeUnknownSurface(issue.surface) : '';
        return !surface || (!dismissed.has(surface) && !ignored.has(surface));
      });
    },
    [dismissedUnknownByDocument, projectSettings?.ignoredUnknownSurfaces]
  );

  const removeReviewSurface = useCallback(
    (
      surface: string,
      options?: {
        docId?: string;
      }
    ) => {
      const normalized = canonicalizeUnknownSurface(surface);
      if (!normalized) return;
      const shouldKeepIssue = (issue: GuardrailIssue) => {
        const issueSurface = canonicalizeUnknownSurface(issue.surface ?? '');
        if (!issueSurface) {
          return true;
        }
        return issueSurface !== normalized;
      };
      setGuardrailIssues((prev) => prev.filter(shouldKeepIssue));
      setConsistencyReviewItems((prev) =>
        prev.filter((item) => {
          if (options?.docId && item.sceneId !== options.docId) {
            return true;
          }
          return shouldKeepIssue(item.issue);
        })
      );
    },
    []
  );

  const persistDoc = useSceneSaveReview({
    documents,
    setDocuments,
    characterSheets,
    actorResolutions,
    ruleset,
    stateMutationEvents,
    resolvedActionCues,
    worldEngine,
    ragService,
    shodhService,
    refreshMemories,
    setSelectedCreatedAt,
    setSaveStatus,
    setLastSavedAt,
    lastAutosaveErrorRef,
    knownConsistencyEntities,
    filterDismissedUnknownIssues,
    setGuardrailIssues,
    setConsistencyReviewItems
  });

  const {
    isRunningConsistencyReview,
    lastConsistencyReviewAt,
    worldEngineStatus,
    refreshDeferredReview,
    refreshActiveDraftReview,
    handleRunConsistencyReview,
    dismissConsistencyReviewItem
  } = useConsistencyReviewRuns({
    activeProject,
    documents,
    entities,
    characters,
    canonicalFacts,
    characterSheets,
    actorResolutions,
    ruleset,
    stateMutationEvents,
    resolvedActionCues,
    worldEngine,
    setFeedback,
    addSystemHistory,
    knownConsistencyEntities,
    filterDismissedUnknownIssues,
    setGuardrailIssues,
    consistencyReviewItems,
    setConsistencyReviewItems
  });

  const unknownGuardrailIssues = useMemo(
    () =>
      filterUnknownGuardrailIssues({
        issues: guardrailIssues,
        knownSurfaceSet: knownConsistencySurfaceSet
      }),
    [guardrailIssues, knownConsistencySurfaceSet]
  );

  const hasBlockingUnknownGuardrailIssues = useMemo(
    () => unknownGuardrailIssues.some((issue) => issue.severity === 'blocking'),
    [unknownGuardrailIssues]
  );

  const highlightableReviewIssues = useMemo(
    () =>
      buildHighlightableReviewIssues({
        unknownGuardrailIssues,
        consistencyReviewItems,
        selectedDocumentId,
        knownSurfaceSet: knownConsistencySurfaceSet
      }),
    [
      consistencyReviewItems,
      knownConsistencySurfaceSet,
      selectedDocumentId,
      unknownGuardrailIssues
    ]
  );

  const reviewAnnotationSummary = useMemo(
    () =>
      highlightableReviewIssues.length > 0
        ? summarizeWorkspaceReviewSurfaces(highlightableReviewIssues)
        : EMPTY_ANNOTATION_SUMMARY,
    [highlightableReviewIssues]
  );

  const reviewReadiness = useMemo<ReviewReadiness>(
    () =>
      buildReviewReadiness({
        annotationSummary: reviewAnnotationSummary,
        stateMutationEvents,
        worldEngineStatus,
        isRunningConsistencyReview,
        hasBlockingUnknownGuardrailIssues
      }),
    [
      hasBlockingUnknownGuardrailIssues,
      isRunningConsistencyReview,
      reviewAnnotationSummary,
      stateMutationEvents,
      worldEngineStatus
    ]
  );

  const stateMutationReview = useStateMutationReview({
    characterSheets,
    actorResolutions,
    documents,
    ruleset,
    stateMutationEvents,
    hiddenStateMutationReviewKeys,
    setHiddenStateMutationReviewKeys,
    setFeedback,
    addSystemHistory
  });

  const {getSuggestedUnknownCategoryId, createWorldCategory} = useUnknownCategorySuggestion({
    activeProject,
    categories,
    setCategories,
    documents,
    selectedDocumentId,
    unknownGuardrailIssues,
    setFeedback
  });

  const resolution = useUnknownEntityResolution({
    activeProject,
    categories,
    setCategories,
    entities,
    setEntities,
    characters,
    setAliases,
    ruleset,
    setFeedback,
    characterCategoryIds,
    characterLoreEntityIdByCharacterId,
    consistencyReviewItems,
    unknownGuardrailIssues,
    highlightableReviewIssues,
    removeReviewSurface,
    getSuggestedUnknownCategoryId
  });

  const dismissal = useUnknownEntityDismissal({
    activeProject,
    projectSettings,
    saveProjectSettings,
    selectedDocumentId,
    setFeedback,
    unknownGuardrailIssues,
    removeReviewSurface,
    setGuardrailIssues,
    setConsistencyReviewItems,
    setDismissedUnknownByDocument,
    setConsistencyPopover: resolution.setConsistencyPopover
  });

  return {
    guardrailIssues,
    setGuardrailIssues,
    resolvingUnknown: resolution.resolvingUnknown,
    linkingUnknown: resolution.linkingUnknown,
    resolverNotice: resolution.resolverNotice,
    setResolverNotice: resolution.setResolverNotice,
    getSuggestedUnknownCategoryId,
    createWorldCategory,
    unknownLinkSelection: resolution.unknownLinkSelection,
    setUnknownLinkSelection: resolution.setUnknownLinkSelection,
    unknownCategorySelection: resolution.unknownCategorySelection,
    setUnknownCategorySelection: resolution.setUnknownCategorySelection,
    isRunningConsistencyReview,
    consistencyReviewItems,
    stateMutationReviewItems: stateMutationReview.stateMutationReviewItems,
    hiddenStateMutationReviewCountBySceneId: stateMutationReview.hiddenStateMutationReviewCountBySceneId,
    hiddenStateMutationReviewCount: stateMutationReview.hiddenStateMutationReviewCount,
    applyingStateMutationReviewId: stateMutationReview.applyingStateMutationReviewId,
    lastConsistencyReviewAt,
    reviewReadiness,
    consistencyPopover: resolution.consistencyPopover,
    setConsistencyPopover: resolution.setConsistencyPopover,
    knownConsistencyEntities,
    persistDoc,
    refreshDeferredReview,
    refreshActiveDraftReview,
    handleRunConsistencyReview,
    unknownGuardrailIssues,
    hasBlockingUnknownGuardrailIssues,
    highlightableReviewIssues,
    isReviewPrefsHydrated,
    unknownLinkOptions: resolution.unknownLinkOptions,
    closeUnknownLinkOptions: resolution.closeUnknownLinkOptions,
    resolveUnknownEntity: resolution.resolveUnknownEntity,
    resolveAllUnknownEntities: resolution.resolveAllUnknownEntities,
    dismissAllUnknownEntities: dismissal.dismissAllUnknownEntities,
    dismissUnknownEntity: dismissal.dismissUnknownEntity,
    dismissConsistencyReviewItem,
    ignoreUnknownSurfaceProjectWide: dismissal.ignoreUnknownSurfaceProjectWide,
    linkUnknownEntity: resolution.linkUnknownEntity,
    clearUnknownSurface: dismissal.clearUnknownSurface,
    activeConsistencyPopoverIssue: resolution.activeConsistencyPopoverIssue,
    openConsistencyPopover: resolution.openConsistencyPopover,
    acceptStateMutationReviewItem: stateMutationReview.acceptStateMutationReviewItem,
    rejectStateMutationReviewItem: stateMutationReview.rejectStateMutationReviewItem,
    acceptSceneStateMutationReviewItems: stateMutationReview.acceptSceneStateMutationReviewItems,
    rejectSceneStateMutationReviewItems: stateMutationReview.rejectSceneStateMutationReviewItems,
    hideStateMutationReviewItem: stateMutationReview.hideStateMutationReviewItem,
    restoreHiddenStateMutationReviewItems: stateMutationReview.restoreHiddenStateMutationReviewItems,
    restoreAllHiddenStateMutationReviewItems: stateMutationReview.restoreAllHiddenStateMutationReviewItems
  };
};
