import {useCallback, useEffect, useMemo, useState} from 'react';
import type {
  CanonicalFact,
  ChapterCard,
  Character,
  CharacterSheet,
  CompendiumEntry,
  EntityCategory,
  LoreFactProposal,
  ProjectSettings,
  SettlementModule,
  SettlementState,
  StateMutationEvent,
  StoredRuleset,
  WorldCanvasOpenThread,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {getChapterCardsByProjectId} from '../corkboardStorage';
import {getWorldCanvasByProjectId} from '../worldCanvasStorage';
import {getCategoriesByProject} from '../categoryStorage';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getProjectSettings} from '../settingsStorage';
import {getDocumentsByProject, sortWritingDocuments} from '../writingStorage';
import {getProjectCapabilities} from '../projectMode';
import {getCharacterSheetsByProject} from '../services/characters';
import {getActorResolutionsByProject} from '../services/characters/characterIdentityStorage';
import {isCharacterCategory, type ActorResolution} from '../services/characters/characterIdentity';
import {getRulesetByProjectId} from '../services/rules';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getCompendiumEntriesByProject,
  getPartySynergySuggestions,
  getSettlementModulesByProject,
  getSettlementState
} from '../services/compendium';
import {getAliasesByProject, type ConsistencyAlias} from '../services/consistency';
import {getCanonicalFactsByProject, getLoreFactProposalsByProject} from '../services/lore/loreFactStorage';
import {getStateMutationEventsByProject} from '../services/state/stateMutationLedger';
import {
  buildCharacterVoiceContext,
  findCharacterNameCollisions,
  type CharacterNameCollision,
  type CharacterVoiceContext,
  type CharacterVoicePosition
} from '../services/characterLab';
import {describeError} from '../services/errors';

interface CharacterLabProjectData {
  projectId: string;
  settings: ProjectSettings | null;
  categories: EntityCategory[];
  entities: WorldEntity[];
  characters: Character[];
  sheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  aliases: ConsistencyAlias[];
  canonicalFacts: CanonicalFact[];
  factProposals: LoreFactProposal[];
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  compendiumEntries: CompendiumEntry[];
  settlementState: SettlementState | null;
  settlementModules: SettlementModule[];
  documents: WritingDocument[];
  chapterCards: ChapterCard[];
  openThreads: WorldCanvasOpenThread[];
}

export type CharacterLabContextResult =
  | {context: CharacterVoiceContext; error: null}
  | {context: null; error: string};

const EMPTY_DOCUMENTS: WritingDocument[] = [];
const EMPTY_CARDS: ChapterCard[] = [];
const EMPTY_THREADS: WorldCanvasOpenThread[] = [];

const RELOAD_EVENTS = [
  'wbd:character-sheet-records-changed',
  'wbd:character-records-changed',
  'wbd:entity-records-changed',
  'wbd:alias-records-changed',
  'wbd:state-mutation-events-changed',
  'wbd:compendium-records-changed',
  'wbd:writing-records-changed'
];

/**
 * Read-only project records for the character lab, loaded only while the lab
 * is open. `buildContext` grounds one character at one position from the
 * latest load; it never creates, migrates, or saves records.
 */
export function useCharacterLabData(projectId: string | null, enabled: boolean) {
  const [data, setData] = useState<CharacterLabProjectData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [
          settings,
          categories,
          entities,
          characters,
          sheets,
          actorResolutions,
          aliases,
          canonicalFacts,
          factProposals,
          ruleset,
          events,
          compendiumEntries,
          settlementState,
          settlementModules,
          documents,
          chapterCards,
          canvas
        ] = await Promise.all([
          getProjectSettings(projectId),
          getCategoriesByProject(projectId),
          getEntitiesByProject(projectId),
          getCharactersByProject(projectId),
          getCharacterSheetsByProject(projectId),
          getActorResolutionsByProject(projectId),
          getAliasesByProject(projectId),
          getCanonicalFactsByProject(projectId),
          getLoreFactProposalsByProject(projectId),
          getRulesetByProjectId(projectId),
          getStateMutationEventsByProject(projectId),
          getCompendiumEntriesByProject(projectId),
          getSettlementState(projectId),
          getSettlementModulesByProject(projectId),
          getDocumentsByProject(projectId),
          getChapterCardsByProjectId(projectId),
          getWorldCanvasByProjectId(projectId)
        ]);
        if (cancelled) return;
        setLoadError(null);
        setData({
          projectId,
          settings,
          categories,
          entities,
          characters,
          sheets,
          actorResolutions,
          aliases,
          canonicalFacts,
          factProposals,
          ruleset,
          events,
          compendiumEntries,
          settlementState,
          settlementModules,
          documents: sortWritingDocuments(documents),
          chapterCards,
          openThreads: canvas?.openThreads ?? []
        });
      } catch (error) {
        if (!cancelled) setLoadError(describeError(error, 'Unable to load this character.'));
      }
    };
    void load();
    const reload = () => void load();
    RELOAD_EVENTS.forEach((name) => window.addEventListener(name, reload));
    return () => {
      cancelled = true;
      RELOAD_EVENTS.forEach((name) => window.removeEventListener(name, reload));
    };
  }, [enabled, projectId]);

  const current = data && data.projectId === projectId ? data : null;

  const characterOptions = useMemo(() => {
    if (!current) return [];
    const characterCategoryIds = new Set(
      current.categories.filter((category) => isCharacterCategory(category)).map((category) => category.id)
    );
    return current.entities
      .filter((entity) => characterCategoryIds.has(entity.categoryId))
      .map((entity) => ({id: entity.id, name: entity.name}))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [current]);

  const buildContext = useCallback(
    (entityId: string, position: CharacterVoicePosition): CharacterLabContextResult | null => {
      if (!current) return null;
      // Same runtime-modifier derivation as the Workspace, Sheets, and stat peek.
      const runtimeModifiers = deriveCharacterRuntimeModifiers({
        settlementState: current.settlementState,
        settlementModules: current.settlementModules,
        activePartySynergies: getPartySynergySuggestions({
          characters: current.characters,
          rules: DEFAULT_PARTY_SYNERGY_RULES
        })
      });
      try {
        return {
          error: null,
          context: buildCharacterVoiceContext({
            entityId,
            position,
            categories: current.categories,
            entities: current.entities,
            characters: current.characters,
            sheets: current.sheets,
            actorResolutions: current.actorResolutions,
            aliases: current.aliases,
            canonicalFacts: current.canonicalFacts,
            factProposals: current.factProposals,
            characterStyles: current.settings?.characterStyles ?? [],
            documents: current.documents,
            state: {
              ruleset: current.ruleset,
              events: current.events,
              runtimeModifiers,
              statDefinitionNameById: new Map(
                (current.ruleset?.statDefinitions ?? []).map((definition) => [definition.id, definition.name])
              ),
              resourceDefinitionNameById: new Map(
                (current.ruleset?.resourceDefinitions ?? []).map((definition) => [
                  definition.id,
                  definition.name
                ])
              ),
              compendiumEntries: current.compendiumEntries
            }
          })
        };
      } catch (error) {
        return {context: null, error: describeError(error, 'Unable to ground this character.')};
      }
    },
    [current]
  );

  const findNameCollisions = useCallback(
    (name: string): CharacterNameCollision[] =>
      current
        ? findCharacterNameCollisions({
            name,
            categories: current.categories,
            entities: current.entities,
            characters: current.characters,
            sheets: current.sheets,
            aliases: current.aliases
          })
        : [],
    [current]
  );

  return {
    isLoaded: Boolean(current),
    loadError,
    aiConfig: current?.settings?.aiSettings,
    canUseGameSystems: getProjectCapabilities(current?.settings).canUseGameSystems,
    characterOptions,
    documents: current?.documents ?? EMPTY_DOCUMENTS,
    chapterCards: current?.chapterCards ?? EMPTY_CARDS,
    openThreads: current?.openThreads ?? EMPTY_THREADS,
    buildContext,
    findNameCollisions
  };
}
