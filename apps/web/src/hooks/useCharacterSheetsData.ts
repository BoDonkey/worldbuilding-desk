import {useEffect, useMemo, useState} from 'react';
import type {
  Character,
  CharacterSheet,
  CompendiumEntry,
  Project,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {
  getCharacterSheetsByProject, deriveCharacterSheetNames, findCharacterSheetCollisions,
  getCharactersByProject, getEntitiesByProject, getActorResolutionsByProject,
  getRulesetByProjectId, getOrCreateSettlementState, getSettlementModulesByProject,
  getCompendiumEntriesByProject, getDocumentsByProject, getStateMutationEventsByProject,
  getCategoriesByProject
} from '../services/storage';
import {placeNameSuggestions} from '../services/worldBible/placePositions';
import type {ActorResolution} from '../services/characters/characterIdentity';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {getSeriesBibleConfig} from '../services/seriesBible/SeriesBibleService';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getPartySynergySuggestions
} from '../services/compendium';
import {
  reconcileCharacterResources,
  reconcileCharacterStats
} from '../services/characters/characterSheetRuleset';

export type CharacterSheetsFeedback = {
  tone: 'success' | 'error';
  message: string;
} | null;

/**
 * Loads everything the Character Sheets screen reads for the active project,
 * and derives the runtime modifiers (settlement and party bonuses) that sheet
 * previews apply.
 */
export const useCharacterSheetsData = (params: {
  activeProject: Project | null;
  setFeedback: (feedback: CharacterSheetsFeedback) => void;
}) => {
  const {activeProject, setFeedback} = params;
  const [sheets, setSheets] = useState<CharacterSheet[]>([]);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const [compendiumEntries, setCompendiumEntries] = useState<CompendiumEntry[]>([]);
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [stateMutationEvents, setStateMutationEvents] = useState<StateMutationEvent[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [actorResolutions, setActorResolutions] = useState<ActorResolution[]>([]);
  const [settlementState, setSettlementState] = useState<Awaited<
    ReturnType<typeof getOrCreateSettlementState>
  > | null>(null);
  const [settlementModules, setSettlementModules] = useState<Awaited<
    ReturnType<typeof getSettlementModulesByProject>
  >>([]);
  const [placeNames, setPlaceNames] = useState<string[]>([]);
  const [shodhService, setShodhService] = useState<ShodhMemoryProvider | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeProject) {
        if (!cancelled) {
          setSheets([]);
          setRuleset(null);
          setCharacters([]);
          setActorResolutions([]);
          setSettlementState(null);
          setSettlementModules([]);
          setCompendiumEntries([]);
          setDocuments([]);
          setStateMutationEvents([]);
          setPlaceNames([]);
          setShodhService(null);
          setIsLoaded(true);
        }
        return;
      }
      if (!cancelled) {
        setIsLoaded(false);
      }

      const [
        loadedSheets,
        loadedRuleset,
        loadedCharacters,
        loadedSettlementState,
        loadedSettlementModules,
        loadedCompendiumEntries,
        loadedDocuments,
        loadedStateMutationEvents,
        loadedEntities,
        loadedActorResolutions,
        loadedCategories
      ] = await Promise.all(
        [
          getCharacterSheetsByProject(activeProject.id),
          getRulesetByProjectId(activeProject.id),
          getCharactersByProject(activeProject.id),
          getOrCreateSettlementState(activeProject.id),
          getSettlementModulesByProject(activeProject.id),
          getCompendiumEntriesByProject(activeProject.id),
          getDocumentsByProject(activeProject.id),
          getStateMutationEventsByProject(activeProject.id),
          getEntitiesByProject(activeProject.id),
          getActorResolutionsByProject(activeProject.id),
          getCategoriesByProject(activeProject.id)
        ]
      );

      const bibleConfig = getSeriesBibleConfig(activeProject);
      const shodhOptions =
        bibleConfig.parentProjectId && bibleConfig.inheritShodh
          ? {
              projectId: activeProject.id,
              inheritFromParent: true,
              parentProjectId: bibleConfig.parentProjectId
            }
          : {projectId: activeProject.id};

      if (!cancelled) {
        const entityNameById = new Map(
          loadedEntities.map((entity: WorldEntity) => [entity.id, entity.name])
        );
        setSheets(
          deriveCharacterSheetNames(loadedSheets, loadedEntities).map((sheet) => ({
            ...sheet,
            stats: reconcileCharacterStats(loadedRuleset, sheet.stats),
            resources: reconcileCharacterResources(loadedRuleset, sheet.resources)
          }))
        );
        setRuleset(loadedRuleset);
        setCharacters(
          loadedCharacters.map((character) => ({
            ...character,
            name:
              (character.entityId
                ? entityNameById.get(character.entityId)
                : undefined) ?? character.name
          }))
        );
        setActorResolutions(loadedActorResolutions);
        const sheetCollisions = findCharacterSheetCollisions(loadedSheets);
        if (sheetCollisions.length > 0) {
          setFeedback({
            tone: 'error',
            message: `${sheetCollisions.length} World Bible character ${
              sheetCollisions.length === 1 ? 'has' : 'have'
            } more than one sheet. Keep one sheet per character before recording new state.`
          });
        }
        setSettlementState(loadedSettlementState);
        setSettlementModules(loadedSettlementModules);
        setCompendiumEntries(loadedCompendiumEntries);
        setDocuments(loadedDocuments);
        setStateMutationEvents(loadedStateMutationEvents);
        setPlaceNames(placeNameSuggestions(loadedCategories, loadedEntities));
        const shodh = await getShodhService(shodhOptions);
        if (!cancelled) {
          setShodhService(shodh);
        }

        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject, setFeedback]);

  const activePartySynergies = useMemo(
    () =>
      getPartySynergySuggestions({
        characters,
        rules: DEFAULT_PARTY_SYNERGY_RULES
      }),
    [characters]
  );
  const runtimeModifiers = useMemo(
    () =>
      deriveCharacterRuntimeModifiers({
        settlementState,
        settlementModules,
        activePartySynergies
      }),
    [settlementState, settlementModules, activePartySynergies]
  );

  return {
    sheets, setSheets, ruleset, characters, actorResolutions, compendiumEntries,
    documents, stateMutationEvents, setStateMutationEvents, placeNames, shodhService,
    isLoaded, runtimeModifiers
  };
};
