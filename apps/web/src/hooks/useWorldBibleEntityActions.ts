import {useCallback, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {saveEntity, deleteEntity} from '../entityStorage';
import {saveCharacter} from '../characterStorage';
import type {
  Character,
  EntityCategory,
  WorldEntity,
  CompendiumDomain,
  CompendiumEntry,
  Project
} from '../entityTypes';
import type {ConsistencyAlias, ReviewQueueItem} from '../services/consistency';
import {deleteAliasesForEntity, replaceAliasesForEntity} from '../services/consistency';
import {
  buildCanonicalAliasList,
  buildEntityMergePlan,
  deriveFirstNameAlias,
  getAliasConversionPlan
} from '../services/worldBible/worldBibleCanonicalization';
import {
  normalizeRichTextValue
} from '../services/worldBible/worldBibleEntityHelpers';
import type {RAGProvider} from '../services/rag/RAGService';
import type {
  ShodhMemoryProvider
} from '../services/shodh/ShodhMemoryService';
import {upsertCompendiumEntryFromEntity} from '../services/compendium';
import {promoteDocumentToParent, syncChildWithParent} from '../services/seriesBible/SeriesBibleService';

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

const CHARACTER_CATEGORY_HINTS = ['character', 'characters', 'npc', 'person', 'people'];
const LOCATION_CATEGORY_HINTS = ['location', 'locations', 'place', 'places', 'region', 'zone'];

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
  setViewMode,
  setCanonState,
  ragService,
  shodhService,
  refreshMemories,
  editingId,
  name,
  fieldValues,
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
  const [promotingEntityId, setPromotingEntityId] = useState<string | null>(null);
  const [importingCharacterEntityId, setImportingCharacterEntityId] = useState<string | null>(
    null
  );
  const [mergingEntityTargetId, setMergingEntityTargetId] = useState<string | null>(null);
  const [aliasingEntityTargetId, setAliasingEntityTargetId] = useState<string | null>(null);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const [linkingCompendiumEntityId, setLinkingCompendiumEntityId] = useState<
    string | null
  >(null);

  const isCharacterLikeEntity = useCallback(
    (entity: WorldEntity): boolean => {
      const category = categories.find((item) => item.id === entity.categoryId);
      const slug = (category?.slug ?? '').toLowerCase();
      const categoryName = (category?.name ?? '').toLowerCase();
      return CHARACTER_CATEGORY_HINTS.some(
        (hint) => slug.includes(hint) || categoryName.includes(hint)
      );
    },
    [categories]
  );

  const openNextReviewItem = useCallback(
    (currentEntityId: string) => {
      const currentIndex = filteredReviewQueue.findIndex(
        (item) => item.entity.id === currentEntityId
      );
      const nextItem =
        filteredReviewQueue[currentIndex + 1] ??
        filteredReviewQueue[currentIndex - 1] ??
        null;
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
      if (!activeProject || !activeCategory) return;

      setIsSubmittingEntity(true);
      setFeedback(null);
      try {
        const now = Date.now();
        const id = editingId ?? crypto.randomUUID();
        const existing = entities.find((entity) => entity.id === id);
        const manualAlternativeNames = parseAlternativeNames(
          fieldValues[alternativeNamesKey] || ''
        );
        const activeCategorySlug = activeCategory.slug.toLowerCase();
        const shouldSuggestFirstNameAlias =
          CHARACTER_CATEGORY_HINTS.some((hint) => activeCategorySlug.includes(hint)) &&
          (!existing || !existing.aliasesReviewedAt);
        const suggestedAliases = shouldSuggestFirstNameAlias
          ? [deriveFirstNameAlias(name)].filter(
              (alias): alias is string => typeof alias === 'string'
            )
          : [];
        const alternativeNames = buildCanonicalAliasList({
          previousName: existing?.name,
          nextName: name,
          aliases: manualAlternativeNames,
          suggestedAliases
        });
        const persistedAlternativeNames = [
          ...parseAlternativeNames(
            typeof existing?.fields?.[alternativeNamesKey] === 'string'
              ? String(existing.fields[alternativeNamesKey])
              : ''
          ),
          ...(aliasMapByEntityId.get(id) ?? [])
        ]
          .map((alias) => normalizeName(alias))
          .filter(Boolean)
          .filter((alias) => alias !== normalizeName(name));
        const nextAlternativeNamesNormalized = alternativeNames
          .map((alias) => normalizeName(alias))
          .filter(Boolean)
          .filter((alias) => alias !== normalizeName(name));
        const aliasesChanged =
          persistedAlternativeNames.length !== nextAlternativeNamesNormalized.length ||
          persistedAlternativeNames.some(
            (alias, index) => alias !== nextAlternativeNamesNormalized[index]
          );
        const nextFields = {...fieldValues};
        activeCategory.fieldSchema.forEach((field) => {
          if (field.type !== 'textarea') return;
          nextFields[field.key] = normalizeRichTextValue(nextFields[field.key] || '');
        });
        if (alternativeNames.length > 0) {
          nextFields[alternativeNamesKey] = formatAlternativeNames(alternativeNames);
        } else {
          delete nextFields[alternativeNamesKey];
        }
        const canonicalRename =
          typeof existing?.name === 'string' &&
          existing.name.trim().length > 0 &&
          existing.name.trim().toLowerCase() !== name.trim().toLowerCase();

        const entity: WorldEntity = {
          id,
          projectId: activeProject.id,
          categoryId: activeCategory.id,
          name,
          fields: nextFields,
          isNew: false,
          needsCompletion: false,
          aliasesReviewedAt:
            aliasesChanged || (viewMode === 'review' && selectedEntityQueueItem)
              ? now
              : canonicalRename
                ? now
                : existing?.aliasesReviewedAt,
          links: existing?.links ?? [],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        };

        await saveEntity(entity);
        const savedAliases = await replaceAliasesForEntity({
          projectId: activeProject.id,
          entityId: entity.id,
          aliases: alternativeNames.filter(
            (alias) => alias.trim().toLowerCase() !== entity.name.trim().toLowerCase()
          )
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
              `"${savedName}" saved. Opened the next queue item.`
            : (options?.successMessage ?? (editingId ? 'Entry updated.' : 'Entry created.'))
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save entry.';
        setFeedback({tone: 'error', message});
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
            ? `"${entity.name}" ${subject} marked reviewed. Opened the next queue item.`
            : `"${entity.name}" ${subject} marked reviewed.`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to update entry.';
        setFeedback({tone: 'error', message});
      }
    },
    [isCharacterLikeEntity, openNextReviewItem, setEntities, setFeedback]
  );

  const handleDeleteEntity = useCallback(
    async (id: string) => {
      if (!confirm('Delete this entity?')) return;
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
          error instanceof Error ? error.message : 'Unable to delete entry.';
        setFeedback({tone: 'error', message});
      } finally {
        setDeletingEntityId(null);
      }
    },
    [
      activeProject,
      editingId,
      ragService,
      refreshMemories,
      resetForm,
      setAliases,
      setEntities,
      setFeedback,
      shodhService
    ]
  );

  const handleMergeEntityIntoMatch = useCallback(
    async (target: WorldEntity) => {
      if (!activeProject || !editingId) return;

      const source = entities.find((entity) => entity.id === editingId);
      if (!source || source.id === target.id) return;

      if (!confirm(`Merge "${source.name}" into "${target.name}" and remove the duplicate record?`)) {
        return;
      }

      setMergingEntityTargetId(target.id);
      setFeedback(null);

      try {
        const sourceName = name.trim() || source.name;
        const sourceDraftFields: Record<string, unknown> = {
          ...source.fields,
          ...fieldValues
        };
        const {mergedEntity, aliases: mergedAliasTexts} = buildEntityMergePlan({
          source,
          target,
          sourceName,
          sourceFields: sourceDraftFields,
          targetFields: target.fields,
          sourceIndexedAliases: aliasMapByEntityId.get(source.id) ?? [],
          targetIndexedAliases: aliasMapByEntityId.get(target.id) ?? [],
          alternativeNamesKey,
          normalizeName,
          parseAlternativeNames,
          aliasesReviewedAt: Math.max(
            target.aliasesReviewedAt ?? 0,
            source.aliasesReviewedAt ?? 0
          ) || undefined
        });

        await saveEntity(mergedEntity);
        const mergedAliases = await replaceAliasesForEntity({
          projectId: activeProject.id,
          entityId: target.id,
          aliases: mergedAliasTexts
        });
        await deleteAliasesForEntity(activeProject.id, source.id);
        await deleteEntity(source.id);

        if (ragService) {
          await ragService.indexDocument(
            mergedEntity.id,
            mergedEntity.name,
            buildEntityContent(mergedEntity),
            'worldbible',
            {
              tags: [
                categories.find((category) => category.id === mergedEntity.categoryId)?.slug ?? ''
              ].filter(Boolean),
              entityIds: [mergedEntity.id]
            }
          );
          await ragService.deleteDocument(source.id);
        }
        if (shodhService) {
          await shodhService.captureAutoMemory({
            projectId: activeProject.id,
            documentId: mergedEntity.id,
            title: mergedEntity.name,
            content: buildEntityContent(mergedEntity),
            tags: [
              'worldbible',
              categories.find((category) => category.id === mergedEntity.categoryId)?.slug ?? ''
            ].filter(Boolean)
          });
          await shodhService.deleteMemoriesForDocument(source.id);
          await refreshMemories();
        }

        setEntities((prev) =>
          prev
            .filter((entity) => entity.id !== source.id)
            .map((entity) => (entity.id === target.id ? mergedEntity : entity))
        );
        setAliases((prev) => [
          ...prev.filter(
            (alias) => alias.targetId !== source.id && alias.targetId !== target.id
          ),
          ...mergedAliases
        ]);
        setViewMode('category');
        handleEdit(mergedEntity, 'aliases');
        setFeedback({
          tone: 'success',
          message: `"${sourceName}" merged into "${target.name}".`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to merge records.';
        setFeedback({tone: 'error', message});
      } finally {
        setMergingEntityTargetId(null);
      }
    },
    [
      activeProject,
      aliasMapByEntityId,
      alternativeNamesKey,
      buildEntityContent,
      categories,
      editingId,
      entities,
      fieldValues,
      handleEdit,
      name,
      normalizeName,
      parseAlternativeNames,
      ragService,
      refreshMemories,
      setAliases,
      setEntities,
      setFeedback,
      setViewMode,
      shodhService
    ]
  );

  const handleMergeMatchIntoCurrentEntity = useCallback(
    async (source: WorldEntity) => {
      if (!activeProject || !editingId) return;

      const target = entities.find((entity) => entity.id === editingId);
      if (!target || source.id === target.id) return;

      const targetName = name.trim() || target.name;
      if (!confirm(`Keep "${targetName}" canonical, merge "${source.name}" into it, and remove the duplicate record?`)) {
        return;
      }

      setMergingEntityTargetId(source.id);
      setFeedback(null);

      try {
        const now = Date.now();
        const targetDraftFields: Record<string, unknown> = {
          ...target.fields,
          ...fieldValues
        };
        const {mergedEntity, aliases: mergedAliasTexts} = buildEntityMergePlan({
          source,
          target,
          targetName,
          sourceFields: source.fields,
          targetFields: targetDraftFields,
          sourceIndexedAliases: aliasMapByEntityId.get(source.id) ?? [],
          targetIndexedAliases: aliasMapByEntityId.get(target.id) ?? [],
          alternativeNamesKey,
          normalizeName,
          parseAlternativeNames,
          aliasesReviewedAt: now
        });

        await saveEntity(mergedEntity);
        const mergedAliases = await replaceAliasesForEntity({
          projectId: activeProject.id,
          entityId: target.id,
          aliases: mergedAliasTexts
        });
        await deleteAliasesForEntity(activeProject.id, source.id);
        await deleteEntity(source.id);

        const targetCategorySlug =
          categories.find((category) => category.id === target.categoryId)?.slug ?? '';
        if (ragService) {
          await ragService.indexDocument(
            mergedEntity.id,
            mergedEntity.name,
            buildEntityContent(mergedEntity),
            'worldbible',
            {
              tags: [targetCategorySlug].filter(Boolean),
              entityIds: [mergedEntity.id]
            }
          );
          await ragService.deleteDocument(source.id);
        }
        if (shodhService) {
          await shodhService.captureAutoMemory({
            projectId: activeProject.id,
            documentId: mergedEntity.id,
            title: mergedEntity.name,
            content: buildEntityContent(mergedEntity),
            tags: ['worldbible', targetCategorySlug].filter(Boolean)
          });
          await shodhService.deleteMemoriesForDocument(source.id);
          await refreshMemories();
        }

        setEntities((prev) =>
          prev
            .filter((entity) => entity.id !== source.id)
            .map((entity) => (entity.id === target.id ? mergedEntity : entity))
        );
        setAliases((prev) => [
          ...prev.filter(
            (alias) => alias.targetId !== source.id && alias.targetId !== target.id
          ),
          ...mergedAliases
        ]);
        setViewMode('category');
        handleEdit(mergedEntity, 'aliases');
        setFeedback({
          tone: 'success',
          message: `"${source.name}" merged into "${targetName}".`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to merge records.';
        setFeedback({tone: 'error', message});
      } finally {
        setMergingEntityTargetId(null);
      }
    },
    [
      activeProject,
      aliasMapByEntityId,
      alternativeNamesKey,
      buildEntityContent,
      categories,
      editingId,
      entities,
      fieldValues,
      handleEdit,
      name,
      normalizeName,
      parseAlternativeNames,
      ragService,
      refreshMemories,
      setAliases,
      setEntities,
      setFeedback,
      setViewMode,
      shodhService
    ]
  );

  const handleConvertEntityToAlias = useCallback(
    async (target: WorldEntity, options?: {openNext?: boolean}) => {
      if (!activeProject || !editingId) return;

      const source = entities.find((entity) => entity.id === editingId);
      if (!source || source.id === target.id) return;

      const sourceName = name.trim() || source.name;
      const sourceDraftFields: Record<string, unknown> = {
        ...source.fields,
        ...fieldValues
      };
      const plan = getAliasConversionPlan({
        sourceName,
        sourceFields: sourceDraftFields,
        sourceLinks: source.links ?? [],
        targetName: target.name,
        targetFields: target.fields,
        targetLinks: target.links ?? [],
        sourceIndexedAliases: aliasMapByEntityId.get(source.id) ?? [],
        targetIndexedAliases: aliasMapByEntityId.get(target.id) ?? [],
        alternativeNamesKey,
        normalizeName,
        parseAlternativeNames
      });

      if (!plan.canDeleteSource) {
        setFeedback({
          tone: 'error',
          message: `Use merge instead. "${sourceName}" still has unique field data: ${plan.blockingFieldKeys.join(', ')}.`
        });
        return;
      }

      if (
        !confirm(`Convert "${sourceName}" into an alias of "${target.name}" and remove the duplicate record?`)
      ) {
        return;
      }

      setAliasingEntityTargetId(target.id);
      setFeedback(null);

      try {
        const now = Date.now();
        const targetCategorySlug =
          categories.find((category) => category.id === target.categoryId)?.slug ?? '';
        const nextTarget: WorldEntity = {
          ...target,
          links: plan.mergedLinks,
          isNew: false,
          needsCompletion: false,
          aliasesReviewedAt: now,
          updatedAt: now
        };

        await saveEntity(nextTarget);
        const savedAliases = await replaceAliasesForEntity({
          projectId: activeProject.id,
          entityId: target.id,
          aliases: plan.transferAliases
        });
        await deleteAliasesForEntity(activeProject.id, source.id);
        await deleteEntity(source.id);

        if (ragService) {
          await ragService.indexDocument(
            nextTarget.id,
            nextTarget.name,
            buildEntityContent(nextTarget),
            'worldbible',
            {
              tags: [targetCategorySlug].filter(Boolean),
              entityIds: [nextTarget.id]
            }
          );
          await ragService.deleteDocument(source.id);
        }
        if (shodhService) {
          await shodhService.captureAutoMemory({
            projectId: activeProject.id,
            documentId: nextTarget.id,
            title: nextTarget.name,
            content: buildEntityContent(nextTarget),
            tags: ['worldbible', targetCategorySlug].filter(Boolean)
          });
          await shodhService.deleteMemoriesForDocument(source.id);
          await refreshMemories();
        }

        setEntities((prev) =>
          prev
            .filter((entity) => entity.id !== source.id)
            .map((entity) => (entity.id === target.id ? nextTarget : entity))
        );
        setAliases((prev) => [
          ...prev.filter(
            (alias) => alias.targetId !== source.id && alias.targetId !== target.id
          ),
          ...savedAliases
        ]);

        resetForm();
        const openedNext = options?.openNext !== false ? openNextReviewItem(source.id) : false;
        if (!openedNext) {
          setViewMode('category');
          handleEdit(nextTarget, 'aliases');
        }
        setFeedback({
          tone: 'success',
          message: openedNext
            ? `"${sourceName}" converted into an alias of "${target.name}". Opened the next queue item.`
            : `"${sourceName}" converted into an alias of "${target.name}".`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to convert record into an alias.';
        setFeedback({tone: 'error', message});
      } finally {
        setAliasingEntityTargetId(null);
      }
    },
    [
      activeProject,
      aliasMapByEntityId,
      alternativeNamesKey,
      buildEntityContent,
      categories,
      editingId,
      entities,
      fieldValues,
      handleEdit,
      name,
      normalizeName,
      openNextReviewItem,
      parseAlternativeNames,
      ragService,
      refreshMemories,
      resetForm,
      setAliases,
      setEntities,
      setFeedback,
      setViewMode,
      shodhService
    ]
  );

  const isLocationLikeEntity = useCallback(
    (entity: WorldEntity): boolean => {
      const category = categories.find((item) => item.id === entity.categoryId);
      const slug = (category?.slug ?? '').toLowerCase();
      return LOCATION_CATEGORY_HINTS.some((hint) => slug.includes(hint));
    },
    [categories]
  );

  const handleImportEntityToCharacters = useCallback(
    async (entity: WorldEntity, options?: {autoCreateSheet?: boolean}) => {
      if (!activeProject) return;
      setImportingCharacterEntityId(entity.id);
      setFeedback(null);
      try {
        const existingCharacter = characters.find(
          (character) => normalizeName(character.name) === normalizeName(entity.name)
        );
        const character: Character = existingCharacter ?? {
          id: crypto.randomUUID(),
          projectId: activeProject.id,
          name: entity.name,
          description:
            typeof entity.fields.description === 'string'
              ? entity.fields.description
              : undefined,
          fields: {
            age: typeof entity.fields.age === 'string' ? entity.fields.age : undefined,
            role: typeof entity.fields.role === 'string' ? entity.fields.role : undefined,
            notes: typeof entity.fields.notes === 'string' ? entity.fields.notes : undefined
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        if (!existingCharacter) {
          await saveCharacter(character);
          setCharacters((prev) => [...prev, character]);
        }

        if (options?.autoCreateSheet && hasRuleset) {
          setFeedback({
            tone: 'success',
            message: existingCharacter
              ? `"${entity.name}" is already linked to Character Tools. Opening sheet and state tracking.`
              : `"${entity.name}" is now linked to Character Tools. Opening sheet and state tracking.`
          });
          navigate('/characters?view=sheets', {
            state: {
              prefillCharacterId: character.id,
              preferredView: 'sheets',
              autoCreateSheetForCharacterId: character.id
            }
          });
          return;
        }

        setFeedback({
          tone: 'success',
          message: existingCharacter
            ? `"${entity.name}" is already linked to Character Tools. World Bible remains the canonical record.`
            : `"${entity.name}" is now linked to Character Tools. World Bible remains the canonical record.`
        });

        navigate('/characters', {
          state: {
            prefillCharacterId: character.id,
            preferredView: 'roster'
          }
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to open character tools.';
        setFeedback({tone: 'error', message});
      } finally {
        setImportingCharacterEntityId(null);
      }
    },
    [activeProject, characters, hasRuleset, navigate, normalizeName, setCharacters, setFeedback]
  );

  const inferCompendiumDomain = useCallback(
    (entity: WorldEntity): CompendiumDomain => {
      const category = categories.find((item) => item.id === entity.categoryId);
      const slug = (category?.slug ?? '').toLowerCase();
      if (slug.includes('monster') || slug.includes('beast') || slug.includes('creature')) {
        return 'beast';
      }
      if (slug.includes('plant') || slug.includes('flora') || slug.includes('herb')) {
        return 'flora';
      }
      if (slug.includes('ore') || slug.includes('mineral') || slug.includes('rock')) {
        return 'mineral';
      }
      if (slug.includes('artifact') || slug.includes('relic')) {
        return 'artifact';
      }
      return 'custom';
    },
    [categories]
  );

  const handleAddEntityToCompendium = useCallback(
    async (entity: WorldEntity): Promise<CompendiumEntry | void> => {
      if (!activeProject) return;
      if (isLocationLikeEntity(entity) && !compendiumLinkedEntityIds.has(entity.id)) {
        navigate('/compendium', {
          state: {
            activeTab: 'entries',
            importEntityId: entity.id,
            importMechanicKind: 'discovery',
            importProgressScope: 'character',
            flashMessage: `Choose the mechanics type for "${entity.name}".`
          }
        });
        return;
      }
      setLinkingCompendiumEntityId(entity.id);
      setFeedback(null);
      try {
        const entry = await upsertCompendiumEntryFromEntity({
          projectId: activeProject.id,
          entity,
          domain: inferCompendiumDomain(entity),
          needsCompletion: entity.needsCompletion ?? false
        });
        setCompendiumLinkedEntityIds((prev) => {
          const next = new Set(prev);
          next.add(entity.id);
          return next;
        });
        setFeedback({
          tone: 'success',
          message: `"${entity.name}" linked to mechanics.`
        });
        navigate('/compendium', {
          state: {
            focusEntryId: entry.id,
            activeTab: 'entries',
            flashMessage: `"${entity.name}" linked to mechanics.`
          }
        });
        return entry;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to link entity to compendium.';
        setFeedback({tone: 'error', message});
      } finally {
        setLinkingCompendiumEntityId(null);
      }
    },
    [
      activeProject,
      compendiumLinkedEntityIds,
      inferCompendiumDomain,
      isLocationLikeEntity,
      navigate,
      setCompendiumLinkedEntityIds,
      setFeedback
    ]
  );

  const handlePromoteEntity = useCallback(
    async (entity: WorldEntity) => {
      if (!seriesParentProjectId) return;
      setPromotingEntityId(entity.id);
      setFeedback(null);
      try {
        await promoteDocumentToParent({
          parentProjectId: seriesParentProjectId,
          documentId: entity.id,
          title: entity.name,
          content: buildEntityContent(entity),
          type: 'worldbible',
          tags: [activeCategory?.slug ?? 'worldbible']
        });
        setFeedback({tone: 'success', message: 'Entry promoted to parent canon.'});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to promote entry.';
        setFeedback({tone: 'error', message});
      } finally {
        setPromotingEntityId(null);
      }
    },
    [activeCategory?.slug, buildEntityContent, seriesParentProjectId, setFeedback]
  );

  const handleCanonSync = useCallback(async () => {
    if (!activeProject) return;
    setIsSyncingCanon(true);
    setFeedback(null);
    try {
      const updated = await syncChildWithParent(activeProject.id);
      if (updated) {
        setCanonState((prev) => ({
          ...prev,
          childLastSynced: updated.lastSyncedCanon
        }));
      }
      setFeedback({tone: 'success', message: 'Canon sync state updated.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark canon as synced.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
  }, [activeProject, setCanonState, setFeedback]);

  return {
    isSubmittingEntity,
    deletingEntityId,
    promotingEntityId,
    importingCharacterEntityId,
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
    handleAddEntityToCompendium,
    handlePromoteEntity,
    handleCanonSync,
    isCharacterLikeEntity,
    isLocationLikeEntity
  };
};
