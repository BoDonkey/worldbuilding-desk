import {useCallback, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {
  saveEntity,
  deleteEntity,
  deleteAliasesForEntity,
  replaceAliasesForEntity,
  type ConsistencyAlias
} from '../services/storage';
import type {
  Character,
  EntityCategory,
  WorldEntity,
  Project
} from '../entityTypes';
import type {ReviewQueueItem} from '../services/consistency';
import {
  isCharacterLikeEntity as isCharacterLikeRecord,
  isLocationLikeEntity as isLocationLikeRecord,
  pickNextReviewItem,
  planEntityDraft
} from '../services/worldBible/worldBibleEntityPlans';
import {useWorldBibleMergeActions} from './useWorldBibleMergeActions';
import {useWorldBibleLinkActions} from './useWorldBibleLinkActions';
import type {RAGProvider} from '../services/rag/RAGService';
import type {
  ShodhMemoryProvider
} from '../services/shodh/ShodhMemoryService';
import type {ConfirmRequest} from './useConfirmDialog';
import {describeError} from '../services/errors';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorldBibleEntityActionsParams {
  activeProject: Project | null;
  activeCategory: EntityCategory | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  setAliases: Dispatch<SetStateAction<ConsistencyAlias[]>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  requestConfirm: (request: ConfirmRequest) => void;
  setViewMode: Dispatch<SetStateAction<'category' | 'review'>>;
  setCanonState: Dispatch<
    SetStateAction<{
      parentCanonVersion?: string;
      childLastSynced?: string;
      parentName?: string;
    }>
  >;
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  refreshMemories: () => Promise<void>;
  editingId: string | null;
  name: string;
  fieldValues: Record<string, string>;
  systemNegativeSpace?: WorldEntity['systemNegativeSpace'];
  viewMode: 'category' | 'review';
  selectedEntityQueueItem: ReviewQueueItem | null;
  filteredReviewQueue: ReviewQueueItem[];
  aliasMapByEntityId: Map<string, string[]>;
  compendiumLinkedEntityIds: Set<string>;
  setCompendiumLinkedEntityIds: Dispatch<SetStateAction<Set<string>>>;
  hasRuleset: boolean;
  seriesParentProjectId: string | null;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
  formatAlternativeNames: (names: string[]) => string;
  buildEntityContent: (entity: WorldEntity) => string;
  alternativeNamesKey: string;
  openReviewItem: (entity: WorldEntity, focus?: 'general' | 'aliases') => void;
  handleEdit: (entity: WorldEntity, focus?: 'general' | 'aliases') => void;
  resetForm: () => void;
  navigate: (to: string, options?: {state?: unknown}) => void;
}

export const useWorldBibleEntityActions = ({
  activeProject,
  activeCategory,
  categories,
  entities,
  characters,
  setCharacters,
  setEntities,
  setAliases,
  setFeedback,
  requestConfirm,
  setViewMode,
  setCanonState,
  ragService,
  shodhService,
  refreshMemories,
  editingId,
  name,
  fieldValues,
  systemNegativeSpace,
  viewMode,
  selectedEntityQueueItem,
  filteredReviewQueue,
  aliasMapByEntityId,
  compendiumLinkedEntityIds,
  setCompendiumLinkedEntityIds,
  hasRuleset,
  seriesParentProjectId,
  normalizeName,
  parseAlternativeNames,
  formatAlternativeNames,
  buildEntityContent,
  alternativeNamesKey,
  openReviewItem,
  handleEdit,
  resetForm,
  navigate
}: UseWorldBibleEntityActionsParams) => {
  const [isSubmittingEntity, setIsSubmittingEntity] = useState(false);
  const [deletingEntityId, setDeletingEntityId] = useState<string | null>(null);

  const isCharacterLikeEntity = useCallback(
    (entity: WorldEntity): boolean => isCharacterLikeRecord(categories, entity),
    [categories]
  );

  const openNextReviewItem = useCallback(
    (currentEntityId: string) => {
      const nextItem = pickNextReviewItem(filteredReviewQueue, currentEntityId);
      if (!nextItem) {
        return false;
      }
      openReviewItem(nextItem.entity);
      return true;
    },
    [filteredReviewQueue, openReviewItem]
  );

  const saveEntityDraft = useCallback(
    async (options?: {
      openNext?: boolean;
      successMessage?: string;
      successMessageWithNext?: string;
    }) => {
      if (!activeProject || !activeCategory) return null;

      setIsSubmittingEntity(true);
      setFeedback(null);
      try {
        const now = Date.now();
        const id = editingId ?? crypto.randomUUID();
        const {entity, aliases: aliasesToSave} = planEntityDraft({
          id,
          now,
          projectId: activeProject.id,
          category: activeCategory,
          existing: entities.find((record) => record.id === id),
          name,
          fieldValues,
          systemNegativeSpace,
          indexedAliases: aliasMapByEntityId.get(id) ?? [],
          reviewingFromQueue: Boolean(viewMode === 'review' && selectedEntityQueueItem),
          alternativeNamesKey,
          normalizeName,
          parseAlternativeNames,
          formatAlternativeNames
        });

        await saveEntity(entity);
        const savedAliases = await replaceAliasesForEntity({
          projectId: activeProject.id,
          entityId: entity.id,
          aliases: aliasesToSave
        });
        if (ragService) {
          await ragService.indexDocument(
            entity.id,
            entity.name,
            buildEntityContent(entity),
            'worldbible',
            {
              tags: [activeCategory.slug],
              entityIds: [entity.id]
            }
          );
        }
        if (shodhService) {
          await shodhService.captureAutoMemory({
            projectId: activeProject.id,
            documentId: entity.id,
            title: entity.name,
            content: buildEntityContent(entity),
            tags: ['worldbible', activeCategory.slug]
          });
          await refreshMemories();
        }

        setEntities((prev) => {
          const idx = prev.findIndex((item) => item.id === id);
          if (idx === -1) return [...prev, entity];
          const copy = [...prev];
          copy[idx] = entity;
          return copy;
        });
        setAliases((prev) => [
          ...prev.filter(
            (alias) => alias.targetType !== 'entity' || alias.targetId !== entity.id
          ),
          ...savedAliases
        ]);

        const savedName = entity.name;
        resetForm();
        const openedNext = options?.openNext ? openNextReviewItem(entity.id) : false;
        setFeedback({
          tone: 'success',
          message: openedNext
            ? options?.successMessageWithNext ??
              `"${savedName}" saved. Opened the next record.`
            : (options?.successMessage ?? (editingId ? 'Entry updated.' : 'Entry created.'))
        });
        return entity;
      } catch (error) {
        const message = describeError(error, 'Unable to save entry.');
        setFeedback({tone: 'error', message});
        return null;
      } finally {
        setIsSubmittingEntity(false);
      }
    },
    [
      activeCategory,
      activeProject,
      aliasMapByEntityId,
      alternativeNamesKey,
      buildEntityContent,
      editingId,
      entities,
      fieldValues,
      systemNegativeSpace,
      formatAlternativeNames,
      name,
      normalizeName,
      openNextReviewItem,
      parseAlternativeNames,
      ragService,
      refreshMemories,
      resetForm,
      selectedEntityQueueItem,
      setAliases,
      setEntities,
      setFeedback,
      shodhService,
      viewMode
    ]
  );

  const handleMarkEntityComplete = useCallback(
    async (entity: WorldEntity, options?: {openNext?: boolean}) => {
      const now = Date.now();
      const next: WorldEntity = {
        ...entity,
        isNew: false,
        needsCompletion: false,
        aliasesReviewedAt: now,
        updatedAt: now
      };

      setFeedback(null);
      try {
        await saveEntity(next);
        setEntities((prev) =>
          prev.map((item) => (item.id === entity.id ? next : item))
        );
        const openedNext = options?.openNext ? openNextReviewItem(entity.id) : false;
        const subject = isCharacterLikeEntity(entity) ? 'character canon' : 'record';
        setFeedback({
          tone: 'success',
          message: openedNext
            ? `"${entity.name}" ${subject} marked reviewed. Opened the next record.`
            : `"${entity.name}" ${subject} marked reviewed.`
        });
      } catch (error) {
        const message =
          describeError(error, 'Unable to update entry.');
        setFeedback({tone: 'error', message});
      }
    },
    [isCharacterLikeEntity, openNextReviewItem, setEntities, setFeedback]
  );

  const handleDeleteEntity = useCallback(
    (id: string) => {
      requestConfirm({
        title: 'Delete this entity?',
        message: 'This removes the World Bible record and its aliases.',
        confirmLabel: 'Delete',
        variant: 'danger',
        onConfirm: async () => {
          setDeletingEntityId(id);
          setFeedback(null);
          try {
            if (activeProject) {
              await deleteAliasesForEntity(activeProject.id, id);
            }
            await deleteEntity(id);
            if (ragService) {
              await ragService.deleteDocument(id);
            }
            if (shodhService) {
              await shodhService.deleteMemoriesForDocument(id);
              await refreshMemories();
            }
            setEntities((prev) => prev.filter((entity) => entity.id !== id));
            setAliases((prev) =>
              prev.filter((alias) => alias.targetType !== 'entity' || alias.targetId !== id)
            );
            if (editingId === id) resetForm();
            setFeedback({tone: 'success', message: 'Entry deleted.'});
          } catch (error) {
            const message =
              describeError(error, 'Unable to delete entry.');
            setFeedback({tone: 'error', message});
          } finally {
            setDeletingEntityId(null);
          }
        }
      });
    },
    [
      activeProject,
      editingId,
      ragService,
      refreshMemories,
      requestConfirm,
      resetForm,
      setAliases,
      setEntities,
      setFeedback,
      shodhService
    ]
  );

  const {
    mergingEntityTargetId,
    aliasingEntityTargetId,
    handleMergeEntityIntoMatch,
    handleMergeMatchIntoCurrentEntity,
    handleConvertEntityToAlias
  } = useWorldBibleMergeActions({
    activeProject,
    categories,
    entities,
    editingId,
    name,
    fieldValues,
    aliasMapByEntityId,
    alternativeNamesKey,
    normalizeName,
    parseAlternativeNames,
    buildEntityContent,
    ragService,
    shodhService,
    refreshMemories,
    requestConfirm,
    setEntities,
    setAliases,
    setFeedback,
    setViewMode,
    handleEdit,
    resetForm,
    openNextReviewItem
  });

  const isLocationLikeEntity = useCallback(
    (entity: WorldEntity): boolean => isLocationLikeRecord(categories, entity),
    [categories]
  );

  const {
    promotingEntityId,
    importingCharacterEntityId,
    exportingCharacterEntityId,
    isSyncingCanon,
    linkingCompendiumEntityId,
    handleImportEntityToCharacters,
    handleExportCharacter,
    handleAddEntityToCompendium,
    handlePromoteEntity,
    handleCanonSync
  } = useWorldBibleLinkActions({
    activeProject,
    activeCategory,
    categories,
    entities,
    characters,
    setCharacters,
    setFeedback,
    setCanonState,
    compendiumLinkedEntityIds,
    setCompendiumLinkedEntityIds,
    hasRuleset,
    seriesParentProjectId,
    buildEntityContent,
    isLocationLikeEntity,
    navigate
  });

  return {
    isSubmittingEntity,
    deletingEntityId,
    promotingEntityId,
    importingCharacterEntityId,
    exportingCharacterEntityId,
    mergingEntityTargetId,
    aliasingEntityTargetId,
    isSyncingCanon,
    linkingCompendiumEntityId,
    saveEntityDraft,
    handleMarkEntityComplete,
    handleDeleteEntity,
    handleMergeEntityIntoMatch,
    handleMergeMatchIntoCurrentEntity,
    handleConvertEntityToAlias,
    handleImportEntityToCharacters,
    handleExportCharacter,
    handleAddEntityToCompendium,
    handlePromoteEntity,
    handleCanonSync,
    isCharacterLikeEntity,
    isLocationLikeEntity
  };
};
