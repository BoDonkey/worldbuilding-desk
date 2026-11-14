import {useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction} from 'react';
import {saveEntity} from '../services/storage';
import type {
  EntityCategory,
  Project,
  ProjectSettings,
  WorldEntity
} from '../entityTypes';
import type {RAGProvider} from '../services/rag/RAGService';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {indexWorldBibleEntity} from '../services/worldBible/indexWorldBibleEntity';
import type {WorldBibleRecordDraft} from '../components/WorldBible/record/useWorldBibleRecordDraft';
import {
  buildCanonicalAliasList,
  deriveCharacterAliasSuggestions
} from '../services/worldBible/worldBibleCanonicalization';
import {
  ALTERNATIVE_NAMES_KEY,
  formatAlternativeNames,
  parseAlternativeNames
} from '../services/worldBible/worldBibleEntityHelpers';
import {
  buildEntityMatchKey,
  type PotentialEntityMatch
} from '../services/worldBible/worldBibleReviewHelpers';
import {describeError} from '../services/errors';
import {normalizeNameExact} from '../services/names/nameMatching';

interface FeedbackState {
  tone: 'success' | 'error';
  message: string;
}

export interface WorldBibleCanonicalizationHandoff {
  kind: 'character-canonicalization';
  sourceName: string;
  matchEntityId?: string;
}

interface UseWorldBibleRecordResolutionOptions {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  activeCategoryIsCharacterLike: boolean;
  activeTab: string | null;
  /** The open record's draft: its name, aliases, and resolver selections. */
  draft: Pick<
    WorldBibleRecordDraft,
    | 'editingId'
    | 'name'
    | 'setName'
    | 'fieldValues'
    | 'setFieldValues'
    | 'manualResolutionTargetId'
    | 'setManualResolutionTargetId'
    | 'moveCategoryTargetId'
    | 'setIsNameResolverOpen'
  >;
  selectedEntity: WorldEntity | null;
  selectedEntityAliases: string[];
  entities: WorldEntity[];
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  categories: EntityCategory[];
  potentialEntityMatches: PotentialEntityMatch[];
  setActiveTab: Dispatch<SetStateAction<string | null>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState | null>>;
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  refreshMemories: () => Promise<void>;
  handleEdit: (entity: WorldEntity, focus?: 'general' | 'aliases') => void;
  saveEntityDraft: (options?: {
    openNext?: boolean;
    successMessage?: string;
    successMessageWithNext?: string;
  }) => Promise<WorldEntity | null>;
}

export function useWorldBibleRecordResolution({
  activeProject,
  projectSettings,
  saveProjectSettings,
  activeCategoryIsCharacterLike,
  activeTab,
  draft,
  selectedEntity,
  selectedEntityAliases,
  entities,
  setEntities,
  categories,
  potentialEntityMatches,
  setActiveTab,
  setFeedback,
  ragService,
  shodhService,
  refreshMemories,
  handleEdit,
  saveEntityDraft
}: UseWorldBibleRecordResolutionOptions) {
  const {
    editingId,
    name,
    setName,
    fieldValues,
    setFieldValues,
    manualResolutionTargetId,
    setManualResolutionTargetId,
    moveCategoryTargetId,
    setIsNameResolverOpen
  } = draft;
  const [movingEntityCategoryId, setMovingEntityCategoryId] = useState<string | null>(null);
  /** Set when another screen sends a character here to be canonicalized. */
  const [handoffGuidance, setHandoffGuidance] =
    useState<WorldBibleCanonicalizationHandoff | null>(null);
  const isCanonicalRenameDraft = Boolean(
    selectedEntity &&
      name.trim().length > 0 &&
      normalizeNameExact(selectedEntity.name) !== normalizeNameExact(name)
  );

  const suggestedCharacterAliases = useMemo(() => {
    if (!activeCategoryIsCharacterLike) {
      return [];
    }
    const currentName = name.trim();
    if (!currentName) {
      return [];
    }
    const existingAliases = new Set(
      parseAlternativeNames(fieldValues[ALTERNATIVE_NAMES_KEY] || '')
        .map((alias) => normalizeNameExact(alias))
        .filter(Boolean)
    );
    return deriveCharacterAliasSuggestions(currentName).filter(
      (alias) =>
        normalizeNameExact(alias) !== normalizeNameExact(currentName) &&
        !existingAliases.has(normalizeNameExact(alias))
    );
  }, [activeCategoryIsCharacterLike, fieldValues, name]);

  const canonicalRenameAliasPreview = useMemo(() => {
    if (!isCanonicalRenameDraft || !selectedEntity) {
      return [];
    }
    return buildCanonicalAliasList({
      previousName: selectedEntity.name,
      nextName: name,
      aliases: parseAlternativeNames(fieldValues[ALTERNATIVE_NAMES_KEY] || '')
    });
  }, [fieldValues, isCanonicalRenameDraft, name, selectedEntity]);

  const manualResolutionTargets = useMemo(
    () =>
      entities
        .filter((entity) => entity.categoryId === activeTab && entity.id !== editingId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeTab, editingId, entities]
  );

  const manualResolutionTarget =
    manualResolutionTargets.find((entity) => entity.id === manualResolutionTargetId) ??
    manualResolutionTargets[0] ??
    null;

  const canonicalResolutionMatches = useMemo(() => {
    if (!editingId) {
      return potentialEntityMatches;
    }
    const handoffMatch = handoffGuidance?.matchEntityId
      ? entities.find((entity) => entity.id === handoffGuidance.matchEntityId)
      : null;
    if (!handoffMatch || handoffMatch.id === editingId) {
      return potentialEntityMatches;
    }
    if (potentialEntityMatches.some((match) => match.entity.id === handoffMatch.id)) {
      return potentialEntityMatches;
    }
    return [
      {
        entity: handoffMatch,
        matchKey: buildEntityMatchKey(editingId, handoffMatch.id),
        reasons: [`Linked from ${handoffGuidance?.sourceName ?? 'older character data'}`],
        recommendedResolution: 'merge' as const
      },
      ...potentialEntityMatches
    ];
  }, [editingId, entities, handoffGuidance, potentialEntityMatches]);

  const handleSaveCanonicalRename = useCallback(async () => {
    await saveEntityDraft({successMessage: 'Canonical name updated.'});
    setIsNameResolverOpen(false);
  }, [saveEntityDraft, setIsNameResolverOpen]);

  const handlePromoteAliasToCanonical = useCallback(
    (alias: string) => {
      if (!selectedEntity) return;
      const nextName = alias.trim();
      if (!nextName) return;
      const previousName = name.trim() || selectedEntity.name;
      const nextAliases = formatAlternativeNames(
        parseAlternativeNames(
          [
            previousName,
            fieldValues[ALTERNATIVE_NAMES_KEY] || '',
            ...selectedEntityAliases
          ]
            .filter(Boolean)
            .join(', ')
        ).filter((candidate) => normalizeNameExact(candidate) !== normalizeNameExact(nextName))
      );
      setName(nextName);
      setFieldValues((current) => ({
        ...current,
        [ALTERNATIVE_NAMES_KEY]: nextAliases
      }));
    },
    [fieldValues, name, selectedEntity, selectedEntityAliases, setFieldValues, setName]
  );

  const handleMoveSelectedEntityCategory = useCallback(async () => {
    if (!selectedEntity || !moveCategoryTargetId) return;
    const targetCategory = categories.find(
      (category) => category.id === moveCategoryTargetId
    );
    if (!targetCategory || targetCategory.id === selectedEntity.categoryId) return;

    setMovingEntityCategoryId(selectedEntity.id);
    setFeedback(null);
    try {
      const nextEntity: WorldEntity = {
        ...selectedEntity,
        categoryId: targetCategory.id,
        updatedAt: Date.now()
      };
      await saveEntity(nextEntity);
      await indexWorldBibleEntity(nextEntity, targetCategory.slug, {ragService, shodhService});
      if (shodhService) await refreshMemories();
      setEntities((current) =>
        current.map((entity) =>
          entity.id === nextEntity.id ? nextEntity : entity
        )
      );
      setActiveTab(targetCategory.id);
      handleEdit(nextEntity);
      setFeedback({
        tone: 'success',
        message: `Moved "${nextEntity.name}" to ${targetCategory.name}.`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to move this record.');
      setFeedback({tone: 'error', message});
    } finally {
      setMovingEntityCategoryId(null);
    }
  }, [
    categories,
    handleEdit,
    moveCategoryTargetId,
    ragService,
    refreshMemories,
    selectedEntity,
    setActiveTab,
    setEntities,
    setFeedback,
    setMovingEntityCategoryId,
    shodhService
  ]);

  const persistIgnoredEntityMatch = useCallback(
    async (otherEntityId: string) => {
      if (!activeProject || !projectSettings || !editingId) {
        throw new Error('Project settings are not ready.');
      }

      const matchKey = buildEntityMatchKey(editingId, otherEntityId);
      const nextSettings: ProjectSettings = {
        ...projectSettings,
        ignoredEntityMatchKeys: Array.from(
          new Set([...(projectSettings.ignoredEntityMatchKeys ?? []), matchKey])
        )
      };
      await saveProjectSettings(nextSettings);
      return matchKey;
    },
    [activeProject, editingId, projectSettings, saveProjectSettings]
  );

  const handleKeepSeparateMatch = useCallback(
    async (otherEntity: WorldEntity) => {
      try {
        await persistIgnoredEntityMatch(otherEntity.id);
        setFeedback({
          tone: 'success',
          message: `"${selectedEntity?.name ?? 'This entry'}" and "${otherEntity.name}" will stay separate.`
        });
      } catch (error) {
        const message =
          describeError(error, 'Unable to keep these records separate.');
        setFeedback({tone: 'error', message});
      }
    },
    [persistIgnoredEntityMatch, selectedEntity, setFeedback]
  );

  const handleIgnoreEntityMatch = useCallback(
    async (otherEntity: WorldEntity) => {
      try {
        await persistIgnoredEntityMatch(otherEntity.id);
        setFeedback({
          tone: 'success',
          message: `Ignored the match between "${selectedEntity?.name ?? 'this entry'}" and "${otherEntity.name}".`
        });
      } catch (error) {
        const message =
          describeError(error, 'Unable to ignore this match.');
        setFeedback({tone: 'error', message});
      }
    },
    [persistIgnoredEntityMatch, selectedEntity, setFeedback]
  );

  const handleAddSuggestedCharacterAlias = useCallback(
    (alias: string) => {
      setFieldValues((current) => ({
        ...current,
        [ALTERNATIVE_NAMES_KEY]: formatAlternativeNames(
          parseAlternativeNames(
            [current[ALTERNATIVE_NAMES_KEY] || '', alias]
              .filter(Boolean)
              .join(', ')
          )
        )
      }));
    },
    [setFieldValues]
  );

  useEffect(() => {
    setManualResolutionTargetId((targetId) =>
      manualResolutionTargets.some((entity) => entity.id === targetId)
        ? targetId
        : manualResolutionTargets[0]?.id ?? ''
    );
  }, [manualResolutionTargets, setManualResolutionTargetId]);

  return {
    isCanonicalRenameDraft,
    suggestedCharacterAliases,
    canonicalRenameAliasPreview,
    manualResolutionTargets,
    manualResolutionTarget,
    canonicalResolutionMatches,
    handleSaveCanonicalRename,
    handlePromoteAliasToCanonical,
    handleMoveSelectedEntityCategory,
    handleKeepSeparateMatch,
    handleIgnoreEntityMatch,
    handleAddSuggestedCharacterAlias,
    movingEntityCategoryId,
    handoffGuidance,
    setHandoffGuidance
  };
}
