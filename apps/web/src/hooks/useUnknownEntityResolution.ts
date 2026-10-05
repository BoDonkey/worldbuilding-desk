import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {
  Character,
  EntityCategory,
  Project,
  StoredRuleset,
  WorldEntity
} from '../entityTypes';
import {getCategoriesByProject, initializeDefaultCategories} from '../categoryStorage';
import {saveEntity} from '../entityStorage';
import type {ConsistencyAlias, GuardrailIssue} from '../services/consistency';
import {saveAlias} from '../services/consistency';
import {buildCharacterCaptureAliasList} from '../services/worldBible/worldBibleCanonicalization';
import {isCharacterCategory} from '../services/characters/characterIdentity';
import {
  buildCloseUnknownLinkOptions,
  buildUnknownLinkOptions,
  namesLikelyReferToSameCharacter,
  normalizeRecordName
} from '../services/consistency/reviewLinkOptions';
import type {ConsistencyReviewItem, HighlightableReviewIssue} from '../services/consistency/reviewReadiness';
import {
  canonicalizeUnknownSurface,
  findCloseCharacterEntityMatch
} from '../services/consistency/sceneReviewHelpers';
import {describeError} from '../services/errors';
import type {ConsistencyFeedback} from './useConsistencyReviewRuns';

export interface ResolverNotice {
  message: string;
  primaryLabel?: string;
  destination?:
    | 'world-bible'
    | 'characters'
    | 'character-sheets'
    | 'character-sheet-create';
  targetId?: string;
  matchEntityId?: string;
  sourceName?: string;
}

export interface LinkUnknownEntityResult {
  destination: 'world-bible' | 'characters' | 'character-sheets' | 'character-sheet-create';
  targetId?: string;
  focus?: 'general' | 'aliases';
}

export interface ConsistencyPopoverState {
  issueId: string;
  surface: string;
  left: number;
  top: number;
}

/**
 * Unknown names found by review: add them to the World Bible or link them to
 * an existing record as an alias (dismissal lives in
 * `useUnknownEntityDismissal`); plus the in-editor review popover.
 */
export function useUnknownEntityResolution({
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
}: {
  activeProject: Project | null;
  categories: EntityCategory[];
  setCategories: Dispatch<SetStateAction<EntityCategory[]>>;
  entities: WorldEntity[];
  setEntities: Dispatch<SetStateAction<WorldEntity[]>>;
  characters: Character[];
  setAliases: Dispatch<SetStateAction<ConsistencyAlias[]>>;
  ruleset: StoredRuleset | null;
  setFeedback: ConsistencyFeedback;
  characterCategoryIds: Set<string>;
  characterLoreEntityIdByCharacterId: Map<string, string>;
  consistencyReviewItems: ConsistencyReviewItem[];
  unknownGuardrailIssues: GuardrailIssue[];
  highlightableReviewIssues: HighlightableReviewIssue[];
  removeReviewSurface: (surface: string, options?: {docId?: string}) => void;
  getSuggestedUnknownCategoryId: (surface: string) => string | undefined;
}) {
  const [resolvingUnknown, setResolvingUnknown] = useState<string | null>(null);
  const [linkingUnknown, setLinkingUnknown] = useState<string | null>(null);
  const [resolverNotice, setResolverNotice] = useState<ResolverNotice | null>(null);
  const [unknownLinkSelection, setUnknownLinkSelection] = useState<
    Record<string, string>
  >({});
  const [unknownCategorySelection, setUnknownCategorySelection] = useState<
    Record<string, string>
  >({});
  const [consistencyPopover, setConsistencyPopover] =
    useState<ConsistencyPopoverState | null>(null);

  useEffect(() => {
    if (!consistencyPopover) return;
    const close = () => setConsistencyPopover(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [consistencyPopover]);

  const attachAliasTexts = useCallback(
    async (params: {
      projectId: string;
      targetId: string;
      targetType: 'entity' | 'character';
      aliasTexts: string[];
    }) => {
      const uniqueAliases = Array.from(
        new Map(
          params.aliasTexts
            .map((alias) => alias.trim())
            .filter(Boolean)
            .map((alias) => [alias.toLowerCase(), alias])
        ).values()
      );

      for (const alias of uniqueAliases) {
        const saved = await saveAlias({
          projectId: params.projectId,
          targetId: params.targetId,
          targetType: params.targetType,
          alias
        });
        setAliases((prev) => {
          const existingIndex = prev.findIndex((entry) => entry.id === saved.id);
          if (existingIndex >= 0) {
            const copy = [...prev];
            copy[existingIndex] = saved;
            return copy;
          }
          return [...prev, saved];
        });
      }
    },
    [setAliases]
  );

  const unknownLinkOptions = useMemo(
    () =>
      buildUnknownLinkOptions({
        categories,
        characterCategoryIds,
        characterLoreEntityIdByCharacterId,
        characters,
        consistencyReviewItems,
        entities,
        unknownGuardrailIssues
      }),
    [
      categories,
      characterCategoryIds,
      characterLoreEntityIdByCharacterId,
      characters,
      consistencyReviewItems,
      entities,
      unknownGuardrailIssues
    ]
  );

  const closeUnknownLinkOptions = useMemo(
    () =>
      buildCloseUnknownLinkOptions({
        unknownGuardrailIssues,
        unknownLinkOptions
      }),
    [unknownGuardrailIssues, unknownLinkOptions]
  );

  const resolveUnknownEntity = useCallback(
    async (
      surface: string,
      categoryId?: string,
      preferredName?: string,
      acceptedAliases?: string[]
    ) => {
      if (!activeProject) return;

      const normalizedSurface = surface.trim();
      const normalizedName = preferredName?.trim() || normalizedSurface;
      if (!normalizedSurface || !normalizedName) return;

      setResolvingUnknown(surface);
      setFeedback(null);
      try {
        let availableCategories = categories;
        if (availableCategories.length === 0) {
          await initializeDefaultCategories(activeProject.id);
          availableCategories = await getCategoriesByProject(activeProject.id);
          setCategories(availableCategories);
        }

        const inferredCategoryId = getSuggestedUnknownCategoryId(normalizedSurface);
        const selectedCategory = categoryId
          ? availableCategories.find((c) => c.id === categoryId)
          : inferredCategoryId
            ? availableCategories.find((c) => c.id === inferredCategoryId) ?? null
            : null;
        const chosenCategory =
          selectedCategory ??
          availableCategories.find((category) =>
            ['characters', 'locations', 'items'].includes(category.slug)
          ) ??
          availableCategories[0];

        if (!chosenCategory) {
          throw new Error('No categories available for entity creation.');
        }

        const now = Date.now();
        const explicitCharacterSelection = Boolean(
          selectedCategory && isCharacterCategory(selectedCategory)
        );
        let acceptedReviewAliases: string[] = [];
        if (explicitCharacterSelection) {
          const normalizedCharacterName = normalizeRecordName(normalizedName);
          const linkedCharacterEntity = entities.find(
            (entity) =>
              entity.categoryId === chosenCategory.id &&
              normalizeRecordName(entity.name) === normalizedCharacterName
          );
          const closeCharacterEntityMatch = findCloseCharacterEntityMatch({
            entities,
            categoryId: chosenCategory.id,
            normalizedCharacterName
          });
          const characterEntity =
            linkedCharacterEntity ??
            ({
              id: crypto.randomUUID(),
              projectId: activeProject.id,
              categoryId: chosenCategory.id,
              name: normalizedName,
              fields: {},
              isNew: true,
              needsCompletion: false,
              links: [],
              createdAt: now,
              updatedAt: now
            } satisfies WorldEntity);
          if (!linkedCharacterEntity) {
            await saveEntity(characterEntity);
            setEntities((prev) => [...prev, characterEntity]);
          }
          const aliasTexts = acceptedAliases ?? buildCharacterCaptureAliasList({
            surface: normalizedSurface,
            canonicalName: normalizedName
          });
          acceptedReviewAliases = aliasTexts;
          await attachAliasTexts({
            projectId: activeProject.id,
            targetId: characterEntity.id,
            targetType: 'entity',
            aliasTexts
          });
          setResolverNotice({
            message: closeCharacterEntityMatch
              ? `"${normalizedName}" added to World Bible Characters. Review possible match with "${closeCharacterEntityMatch.name}".`
              : `"${normalizedName}" added to World Bible Characters.`,
            primaryLabel: closeCharacterEntityMatch ? 'Review Character Match' : undefined,
            destination: 'world-bible',
            targetId: characterEntity.id,
            matchEntityId: closeCharacterEntityMatch?.id,
            sourceName: normalizedName
          });
        } else {
          const entity: WorldEntity = {
            id: crypto.randomUUID(),
            projectId: activeProject.id,
            categoryId: chosenCategory.id,
            name: normalizedName,
            fields: {},
            isNew: true,
            needsCompletion: false,
            links: [],
            createdAt: now,
            updatedAt: now
          };
          await saveEntity(entity);
          await attachAliasTexts({
            projectId: activeProject.id,
            targetId: entity.id,
            targetType: 'entity',
            aliasTexts:
              normalizedName.toLowerCase() === normalizedSurface.toLowerCase()
                ? []
                : [normalizedSurface]
          });
          setEntities((prev) => [...prev, entity]);
          setResolverNotice({
            message: `"${normalizedName}" added to your world.`,
            destination: 'world-bible',
            targetId: entity.id
          });
        }
        removeReviewSurface(normalizedSurface);
        acceptedReviewAliases.forEach((alias) => removeReviewSurface(alias));
        setUnknownLinkSelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setUnknownCategorySelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          canonicalizeUnknownSurface(prev?.surface ?? '') ===
          canonicalizeUnknownSurface(normalizedSurface)
            ? null
            : prev
        );
      } catch (error) {
        const message =
          describeError(error, 'Unable to create entity.');
        setFeedback({tone: 'error', message});
      } finally {
        setResolvingUnknown(null);
      }
    },
    [
      activeProject,
      attachAliasTexts,
      categories,
      entities,
      getSuggestedUnknownCategoryId,
      removeReviewSurface,
      setCategories,
      setEntities,
      setFeedback
    ]
  );


  const resolveAllUnknownEntities = useCallback(async () => {
    const surfaces = unknownGuardrailIssues
      .map((issue) => issue.surface?.trim())
      .filter((surface): surface is string => Boolean(surface));
    if (surfaces.length === 0) return;

    for (const surface of surfaces) {
      await resolveUnknownEntity(surface);
    }
  }, [resolveUnknownEntity, unknownGuardrailIssues]);




  const linkUnknownEntity = useCallback(
    async (
      surface: string,
      explicitEntityId?: string,
      preferredAlias?: string
    ): Promise<LinkUnknownEntityResult | false> => {
      if (!activeProject) return false;
      const selectedEntityId = explicitEntityId ?? unknownLinkSelection[surface];
      if (!selectedEntityId) {
        setFeedback({
          tone: 'error',
          message: `Select an existing record before linking "${surface}".`
        });
        return false;
      }

      setLinkingUnknown(surface);
      setFeedback(null);
      try {
        const [selectedTargetType, selectedTargetId] = selectedEntityId.split(':');
        if (
          (selectedTargetType !== 'entity' && selectedTargetType !== 'character') ||
          !selectedTargetId
        ) {
          throw new Error('Invalid link target selected.');
        }
        const characterCategoryIds = new Set(
          categories
            .filter(isCharacterCategory)
            .map((category) => category.id)
        );
        let targetType: 'entity' | 'character' = selectedTargetType;
        let targetId = selectedTargetId;
        if (selectedTargetType === 'character') {
          const selectedCharacter = characters.find((character) => character.id === selectedTargetId);
          const linkedEntity = selectedCharacter
            ? entities.find(
                (entity) =>
                  characterCategoryIds.has(entity.categoryId) &&
                  namesLikelyReferToSameCharacter(entity.name, selectedCharacter.name)
              )
            : null;
          if (linkedEntity) {
            targetType = 'entity';
            targetId = linkedEntity.id;
          }
        }
        const aliasTexts =
          preferredAlias && preferredAlias.trim()
            ? [preferredAlias.trim(), surface]
            : [surface];
        await attachAliasTexts({
          projectId: activeProject.id,
          targetId,
          targetType,
          aliasTexts
        });
        removeReviewSurface(surface);
        setUnknownLinkSelection((prev) => {
          const copy = {...prev};
          delete copy[surface];
          return copy;
        });
        setConsistencyPopover((prev) =>
          canonicalizeUnknownSurface(prev?.surface ?? '') ===
          canonicalizeUnknownSurface(surface)
            ? null
            : prev
        );
        setResolverNotice({
          message: `Connected "${surface}" as an alias of an existing record.`,
          destination:
            targetType === 'character'
              ? ruleset
                ? 'character-sheet-create'
                : 'characters'
              : 'world-bible',
          targetId
        });
        return {
          destination:
            targetType === 'character'
              ? ruleset
                ? 'character-sheet-create'
                : 'characters'
              : 'world-bible',
          targetId,
          focus:
            selectedTargetType === 'character' || selectedTargetType === 'entity'
              ? selectedTargetType === 'character'
                ? 'aliases'
                : 'general'
              : 'general'
        };
      } catch (error) {
        const message =
          describeError(error, 'Unable to link alias.');
        setFeedback({tone: 'error', message});
        return false;
      } finally {
        setLinkingUnknown(null);
      }
    },
    [
      activeProject,
      attachAliasTexts,
      categories,
      characters,
      entities,
      ruleset,
      removeReviewSurface,
      setFeedback,
      unknownLinkSelection
    ]
  );

  const activeConsistencyPopoverIssue = consistencyPopover
    ? highlightableReviewIssues.find((issue) => issue.id === consistencyPopover.issueId) ?? null
    : null;

  const openConsistencyPopover = useCallback(
    (
      issueId: string,
      anchorRect: {left: number; bottom: number},
      surface: string
    ) => {
      setConsistencyPopover({
        issueId,
        surface,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
      setUnknownLinkSelection((prev) => ({
        ...prev,
        [surface]:
          prev[surface] ??
          (unknownLinkOptions[surface]?.[0]
            ? `${unknownLinkOptions[surface][0].type}:${unknownLinkOptions[surface][0].id}`
            : '')
      }));
      setUnknownCategorySelection((prev) => ({
        ...prev,
        [surface]: prev[surface] ?? getSuggestedUnknownCategoryId(surface) ?? ''
      }));
    },
    [getSuggestedUnknownCategoryId, unknownLinkOptions]
  );

  return {
    resolvingUnknown,
    linkingUnknown,
    resolverNotice,
    setResolverNotice,
    unknownLinkSelection,
    setUnknownLinkSelection,
    unknownCategorySelection,
    setUnknownCategorySelection,
    consistencyPopover,
    setConsistencyPopover,
    unknownLinkOptions,
    closeUnknownLinkOptions,
    resolveUnknownEntity,
    resolveAllUnknownEntities,
    linkUnknownEntity,
    activeConsistencyPopoverIssue,
    openConsistencyPopover
  };
}
