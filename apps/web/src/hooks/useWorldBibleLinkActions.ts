import {useCallback, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import {saveCharacter, upsertCompendiumEntryFromEntity} from '../services/storage';
import type {
  Character,
  EntityCategory,
  WorldEntity,
  CompendiumDomain,
  CompendiumEntry,
  Project
} from '../entityTypes';
import {promoteDocumentToParent, syncChildWithParent} from '../services/seriesBible/SeriesBibleService';
import {
  createCharacterLinkResolver,
  isCharacterCategory
} from '../services/characters/characterIdentity';
import {exportCharactersJson} from '../services/characters/characterTransferService';
import {inferCompendiumDomain as inferCompendiumDomainFor} from '../services/worldBible/worldBibleEntityPlans';
import {describeError} from '../services/errors';

type FeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

interface UseWorldBibleLinkActionsParams {
  activeProject: Project | null;
  activeCategory: EntityCategory | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setFeedback: Dispatch<SetStateAction<FeedbackState>>;
  setCanonState: Dispatch<
    SetStateAction<{
      parentCanonVersion?: string;
      childLastSynced?: string;
      parentName?: string;
    }>
  >;
  compendiumLinkedEntityIds: Set<string>;
  setCompendiumLinkedEntityIds: Dispatch<SetStateAction<Set<string>>>;
  hasRuleset: boolean;
  seriesParentProjectId: string | null;
  buildEntityContent: (entity: WorldEntity) => string;
  isLocationLikeEntity: (entity: WorldEntity) => boolean;
  navigate: (to: string, options?: {state?: unknown}) => void;
}

/**
 * Linking a World Bible record to optional systems: character capabilities,
 * character export, mechanics (compendium), and series canon. Split from
 * useWorldBibleEntityActions (3.22); behavior unchanged.
 */
export const useWorldBibleLinkActions = ({
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
}: UseWorldBibleLinkActionsParams) => {
  const [promotingEntityId, setPromotingEntityId] = useState<string | null>(null);
  const [importingCharacterEntityId, setImportingCharacterEntityId] = useState<string | null>(
    null
  );
  const [exportingCharacterEntityId, setExportingCharacterEntityId] = useState<string | null>(
    null
  );
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const [linkingCompendiumEntityId, setLinkingCompendiumEntityId] = useState<
    string | null
  >(null);

  const handleImportEntityToCharacters = useCallback(
    async (entity: WorldEntity, options?: {autoCreateSheet?: boolean}) => {
      if (!activeProject) return;
      setImportingCharacterEntityId(entity.id);
      setFeedback(null);
      try {
        const entityCategory = categories.find(
          (category) => category.id === entity.categoryId
        );
        if (!entityCategory || !isCharacterCategory(entityCategory)) {
          throw new Error('Optional character capabilities require a World Bible character.');
        }
        const resolver = createCharacterLinkResolver({
          categories,
          entities,
          characters,
          sheets: []
        });
        const existingCharacter = resolver.getCharacter(entity.id);
        const character: Character = existingCharacter
          ? {...existingCharacter, entityId: entity.id, updatedAt: Date.now()}
          : {
          id: crypto.randomUUID(),
          projectId: activeProject.id,
          entityId: entity.id,
          name: entity.name,
          fields: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await saveCharacter(character);
        if (!existingCharacter) {
          setCharacters((prev) => [...prev, character]);
        } else if (!existingCharacter.entityId) {
          setCharacters((prev) =>
            prev.map((record) =>
              record.id === existingCharacter.id ? character : record
            )
          );
        }

        if (options?.autoCreateSheet && hasRuleset) {
          setFeedback({
            tone: 'success',
            message: existingCharacter
              ? `Opening sheet and state tracking for "${entity.name}".`
              : `Optional character data attached to "${entity.name}". Opening sheet and state tracking.`
          });
          navigate('/sheets', {
            state: {
              prefillCharacterId: character.id,
              autoCreateSheetForCharacterId: character.id,
            }
          });
          return;
        }

        setFeedback({
          tone: 'success',
          message: existingCharacter
            ? `Opening dialogue style for "${entity.name}".`
            : `Optional character data attached to "${entity.name}". World Bible remains canonical.`
        });

        navigate('/world-bible', {
          state: {
            focusEntityId: entity.id,
            focusCharacterSection: 'writing-aids'
          }
        });
      } catch (error) {
        const message =
          describeError(error, 'Unable to open character tools.');
        setFeedback({tone: 'error', message});
      } finally {
        setImportingCharacterEntityId(null);
      }
    },
    [activeProject, categories, characters, entities, hasRuleset, navigate, setCharacters, setFeedback]
  );

  const handleExportCharacter = useCallback(
    async (entity: WorldEntity) => {
      if (!activeProject) return;
      setExportingCharacterEntityId(entity.id);
      setFeedback(null);
      try {
        await exportCharactersJson({
          projectId: activeProject.id,
          projectName: activeProject.name,
          includeSheets: true,
          entityIds: [entity.id]
        });
        setFeedback({
          tone: 'success',
          message: `Exported "${entity.name}" with its attached character capabilities.`
        });
      } catch (error) {
        setFeedback({
          tone: 'error',
          message: describeError(error, 'Unable to export this character.')
        });
      } finally {
        setExportingCharacterEntityId(null);
      }
    },
    [activeProject, setFeedback]
  );

  const inferCompendiumDomain = useCallback(
    (entity: WorldEntity): CompendiumDomain => inferCompendiumDomainFor(categories, entity),
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
          describeError(error, 'Unable to link entity to compendium.');
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
          describeError(error, 'Unable to promote entry.');
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
        describeError(error, 'Unable to mark canon as synced.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
  }, [activeProject, setCanonState, setFeedback]);

  return {
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
  };
};
