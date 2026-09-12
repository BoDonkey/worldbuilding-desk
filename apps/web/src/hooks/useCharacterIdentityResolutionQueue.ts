import {useCallback, useMemo, useState} from 'react';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  Project,
  ProjectSettings,
  WorldEntity
} from '../entityTypes';
import type {CharacterIdentityMigrationReport} from '../services/characters/characterIdentity';
import {
  buildCharacterIdentityResolutionQueue,
  resolveCharacterIdentity,
  type CharacterIdentityResolutionItem
} from '../services/characters/characterIdentityResolution';
import {isCharacterCategory} from '../services/characters/characterIdentity';
import {describeError} from '../services/errors';

interface FeedbackState {
  tone: 'success' | 'error';
  message: string;
}

export function useCharacterIdentityResolutionQueue(params: {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  saveProjectSettings: (settings: ProjectSettings) => Promise<ProjectSettings>;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  characterSheets: CharacterSheet[];
  report: CharacterIdentityMigrationReport | null;
  setFeedback: (feedback: FeedbackState | null) => void;
}) {
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const characterCategoryIds = useMemo(
    () => new Set(params.categories.filter(isCharacterCategory).map((category) => category.id)),
    [params.categories]
  );
  const canonicalCharacters = useMemo(
    () =>
      params.entities
        .filter((entity) => characterCategoryIds.has(entity.categoryId))
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name)),
    [characterCategoryIds, params.entities]
  );
  const queue = useMemo(
    () =>
      params.activeProject
        ? buildCharacterIdentityResolutionQueue({
            projectId: params.activeProject.id,
            categories: params.categories,
            entities: params.entities,
            characters: params.characters,
            sheets: params.characterSheets,
            report: params.report,
            keptSeparateKeys:
              params.projectSettings?.keptSeparateCharacterIdentityKeys ?? []
          })
        : [],
    [
      params.activeProject,
      params.categories,
      params.characterSheets,
      params.characters,
      params.entities,
      params.projectSettings?.keptSeparateCharacterIdentityKeys,
      params.report
    ]
  );

  const runResolution = useCallback(
    async (
      item: CharacterIdentityResolutionItem,
      entityId: string,
      entityToCreate?: WorldEntity
    ) => {
      if (!params.activeProject) return;
      setResolvingKey(item.key);
      params.setFeedback(null);
      try {
        await resolveCharacterIdentity({
          projectId: params.activeProject.id,
          item,
          entityId,
          entityToCreate
        });
        params.setFeedback({
          tone: 'success',
          message: entityToCreate
            ? `Created World Bible canon for "${item.name}" and linked its legacy records.`
            : `Linked "${item.name}" to the selected World Bible character.`
        });
      } catch (error) {
        params.setFeedback({
          tone: 'error',
          message:
            describeError(error, 'Unable to resolve this character identity.')
        });
      } finally {
        setResolvingKey(null);
      }
    },
    [params]
  );

  const linkToCanon = useCallback(
    async (item: CharacterIdentityResolutionItem, entityId: string) => {
      if (!entityId) {
        params.setFeedback({
          tone: 'error',
          message: 'Choose an existing World Bible character first.'
        });
        return;
      }
      await runResolution(item, entityId);
    },
    [params, runResolution]
  );

  const createCanon = useCallback(
    async (item: CharacterIdentityResolutionItem) => {
      if (!params.activeProject) return;
      const category = params.categories.find(isCharacterCategory);
      if (!category) {
        params.setFeedback({
          tone: 'error',
          message: 'Mark or create a World Bible category as Characters first.'
        });
        return;
      }
      const sourceCharacter =
        item.recordType === 'character'
          ? params.characters.find((record) => record.id === item.recordId)
          : undefined;
      const sourceSheet =
        item.recordType === 'sheet'
          ? params.characterSheets.find((record) => record.id === item.recordId)
          : undefined;
      const now = Date.now();
      const entity: WorldEntity = {
        id: crypto.randomUUID(),
        projectId: params.activeProject.id,
        categoryId: category.id,
        name: item.name,
        fields: {
          ...(sourceCharacter?.fields ?? {}),
          ...(sourceCharacter?.description
            ? {description: sourceCharacter.description}
            : {}),
          ...(sourceSheet?.notes ? {notes: sourceSheet.notes} : {})
        },
        links: [],
        needsCompletion: true,
        isNew: true,
        createdAt: now,
        updatedAt: now
      };
      await runResolution(item, entity.id, entity);
    },
    [params, runResolution]
  );

  const keepSeparate = useCallback(
    async (item: CharacterIdentityResolutionItem) => {
      if (!params.projectSettings) return;
      setResolvingKey(item.key);
      params.setFeedback(null);
      try {
        const keys = Array.from(
          new Set([
            ...(params.projectSettings.keptSeparateCharacterIdentityKeys ?? []),
            item.key
          ])
        );
        await params.saveProjectSettings({
          ...params.projectSettings,
          keptSeparateCharacterIdentityKeys: keys,
          updatedAt: Date.now()
        });
        params.setFeedback({
          tone: 'success',
          message: `Kept "${item.name}" as an unresolved legacy record. It will not be treated as canon.`
        });
      } catch (error) {
        params.setFeedback({
          tone: 'error',
          message:
            describeError(error, 'Unable to save this decision.')
        });
      } finally {
        setResolvingKey(null);
      }
    },
    [params]
  );

  return {
    queue,
    canonicalCharacters,
    resolvingKey,
    linkToCanon,
    createCanon,
    keepSeparate
  };
}
