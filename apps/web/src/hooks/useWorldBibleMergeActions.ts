import {useCallback, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {saveEntity, deleteEntity} from '../entityStorage';
import type {EntityCategory, Project, WorldEntity} from '../entityTypes';
import type {ConsistencyAlias} from '../services/consistency';
import {deleteAliasesForEntity, replaceAliasesForEntity} from '../services/consistency';
import {buildEntityMergePlan, getAliasConversionPlan} from '../services/worldBible/worldBibleCanonicalization';
import {getCategorySlug} from '../services/worldBible/worldBibleEntityPlans';
import type {RAGProvider} from '../services/rag/RAGService';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import type {ConfirmRequest} from './useConfirmDialog';
import {describeError} from '../services/errors';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorldBibleMergeActionsParams {
  activeProject: Project | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  editingId: string | null;
  name: string;
  fieldValues: Record<string, string>;
  aliasMapByEntityId: Map<string, string[]>;
  alternativeNamesKey: string;
  normalizeName: (value: string) => string;
  parseAlternativeNames: (value: string) => string[];
  buildEntityContent: (entity: WorldEntity) => string;
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  refreshMemories: () => Promise<void>;
  requestConfirm: (request: ConfirmRequest) => void;
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  setAliases: Dispatch<SetStateAction<ConsistencyAlias[]>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  setViewMode: Dispatch<SetStateAction<'category' | 'review'>>;
  handleEdit: (entity: WorldEntity, focus?: 'general' | 'aliases') => void;
  resetForm: () => void;
  openNextReviewItem: (currentEntityId: string) => boolean;
}

/**
 * Merging duplicate World Bible records and converting a duplicate into an
 * alias. Split from useWorldBibleEntityActions (3.22); behavior unchanged.
 */
export const useWorldBibleMergeActions = ({
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
}: UseWorldBibleMergeActionsParams) => {
  const [mergingEntityTargetId, setMergingEntityTargetId] = useState<string | null>(null);
  const [aliasingEntityTargetId, setAliasingEntityTargetId] = useState<string | null>(null);

  /** Persists a merge plan: the merged target, its aliases, and removal of the source everywhere. */
  const commitMerge = useCallback(
    async (params: {
      projectId: string;
      source: WorldEntity;
      target: WorldEntity;
      mergedEntity: WorldEntity;
      mergedAliasTexts: string[];
      successMessage: string;
    }) => {
      const {projectId, source, target, mergedEntity, mergedAliasTexts, successMessage} = params;
      await saveEntity(mergedEntity);
      const mergedAliases = await replaceAliasesForEntity({
        projectId,
        entityId: target.id,
        aliases: mergedAliasTexts
      });
      await deleteAliasesForEntity(projectId, source.id);
      await deleteEntity(source.id);

      // The merged record keeps the target's category.
      const targetCategorySlug = getCategorySlug(categories, mergedEntity.categoryId);
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
          projectId,
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
        ...prev.filter((alias) => alias.targetId !== source.id && alias.targetId !== target.id),
        ...mergedAliases
      ]);
      setViewMode('category');
      handleEdit(mergedEntity, 'aliases');
      setFeedback({tone: 'success', message: successMessage});
    },
    [buildEntityContent, categories, handleEdit, ragService, refreshMemories, setAliases, setEntities, setFeedback, setViewMode, shodhService]
  );

  const handleMergeEntityIntoMatch = useCallback(
    (target: WorldEntity) => {
      if (!activeProject || !editingId) return;

      const source = entities.find((entity) => entity.id === editingId);
      if (!source || source.id === target.id) return;

      requestConfirm({
        title: `Merge "${source.name}" into "${target.name}"?`,
        message: 'The duplicate record will be removed.',
        confirmLabel: 'Merge',
        variant: 'danger',
        onConfirm: async () => {
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
            await commitMerge({
              projectId: activeProject.id,
              source,
              target,
              mergedEntity,
              mergedAliasTexts,
              successMessage: `"${sourceName}" merged into "${target.name}".`
            });
          } catch (error) {
            const message =
              describeError(error, 'Unable to merge records.');
            setFeedback({tone: 'error', message});
          } finally {
            setMergingEntityTargetId(null);
          }
        }
      });
    },
    [
      activeProject,
      aliasMapByEntityId,
      alternativeNamesKey,
      commitMerge,
      editingId,
      entities,
      fieldValues,
      name,
      normalizeName,
      parseAlternativeNames,
      requestConfirm,
      setFeedback
    ]
  );

  const handleMergeMatchIntoCurrentEntity = useCallback(
    (source: WorldEntity) => {
      if (!activeProject || !editingId) return;

      const target = entities.find((entity) => entity.id === editingId);
      if (!target || source.id === target.id) return;

      const targetName = name.trim() || target.name;

      requestConfirm({
        title: `Keep "${targetName}" canonical?`,
        message: `"${source.name}" will be merged into it and the duplicate record removed.`,
        confirmLabel: 'Merge',
        variant: 'danger',
        onConfirm: async () => {
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
            await commitMerge({
              projectId: activeProject.id,
              source,
              target,
              mergedEntity,
              mergedAliasTexts,
              successMessage: `"${source.name}" merged into "${targetName}".`
            });
          } catch (error) {
            const message =
              describeError(error, 'Unable to merge records.');
            setFeedback({tone: 'error', message});
          } finally {
            setMergingEntityTargetId(null);
          }
        }
      });
    },
    [
      activeProject,
      aliasMapByEntityId,
      alternativeNamesKey,
      commitMerge,
      editingId,
      entities,
      fieldValues,
      name,
      normalizeName,
      parseAlternativeNames,
      requestConfirm,
      setFeedback
    ]
  );

  const handleConvertEntityToAlias = useCallback(
    (target: WorldEntity, options?: {openNext?: boolean}) => {
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

      requestConfirm({
        title: `Convert "${sourceName}" into an alias of "${target.name}"?`,
        message: 'The duplicate record will be removed.',
        confirmLabel: 'Convert',
        variant: 'danger',
        onConfirm: async () => {
          setAliasingEntityTargetId(target.id);
          setFeedback(null);

          try {
            const now = Date.now();
            const targetCategorySlug = getCategorySlug(categories, target.categoryId);
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
            const reviewedTarget: WorldEntity = {
              ...nextTarget,
              aliasesReviewedAt: Math.max(
                nextTarget.aliasesReviewedAt ?? 0,
                ...savedAliases.map((alias) => alias.updatedAt ?? alias.createdAt)
              )
            };
            if (reviewedTarget.aliasesReviewedAt !== nextTarget.aliasesReviewedAt) {
              await saveEntity(reviewedTarget);
            }
            await deleteAliasesForEntity(activeProject.id, source.id);
            await deleteEntity(source.id);

            if (ragService) {
              await ragService.indexDocument(
                nextTarget.id,
                nextTarget.name,
                buildEntityContent(reviewedTarget),
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
                content: buildEntityContent(reviewedTarget),
                tags: ['worldbible', targetCategorySlug].filter(Boolean)
              });
              await shodhService.deleteMemoriesForDocument(source.id);
              await refreshMemories();
            }

            setEntities((prev) =>
              prev
                .filter((entity) => entity.id !== source.id)
                .map((entity) => (entity.id === target.id ? reviewedTarget : entity))
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
              handleEdit(reviewedTarget, 'aliases');
            }
            setFeedback({
              tone: 'success',
              message: openedNext
                ? `"${sourceName}" converted into an alias of "${target.name}". Opened the next record.`
                : `"${sourceName}" converted into an alias of "${target.name}".`
            });
          } catch (error) {
            const message =
              describeError(error, 'Unable to convert record into an alias.');
            setFeedback({tone: 'error', message});
          } finally {
            setAliasingEntityTargetId(null);
          }
        }
      });
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
      requestConfirm,
      resetForm,
      setAliases,
      setEntities,
      setFeedback,
      setViewMode,
      shodhService
    ]
  );

  return {
    mergingEntityTargetId,
    aliasingEntityTargetId,
    handleMergeEntityIntoMatch,
    handleMergeMatchIntoCurrentEntity,
    handleConvertEntityToAlias
  };
};
