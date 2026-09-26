import {useCallback, useEffect, useMemo, useState} from 'react';
import type {
  ChapterCard,
  Character,
  CharacterSheet,
  CompendiumEntry,
  SettlementModule,
  SettlementState,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import {getDocumentsByProject} from '../writingStorage';
import {getChapterCardsByProjectId} from '../corkboardStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getCharactersByProject} from '../characterStorage';
import {
  deriveCharacterSheetNames,
  getCharacterSheetsByProject
} from '../services/characters';
import {getActorResolutionsByProject} from '../services/characters/characterIdentityStorage';
import type {ActorResolution} from '../services/characters/characterIdentity';
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
import {getStateMutationEventsByProject} from '../services/state/stateMutationLedger';
import {
  buildCharacterSnapshot,
  type CharacterSnapshotPosition
} from '../services/state/characterSnapshot';
import {buildCharacterPeekTargets} from '../services/state/characterPeek';

const EMPTY_DOCUMENTS: WritingDocument[] = [];
const EMPTY_CARDS: ChapterCard[] = [];

interface StatPeekProjectData {
  projectId: string;
  sheets: CharacterSheet[];
  entities: WorldEntity[];
  aliases: ConsistencyAlias[];
  characters: Character[];
  ruleset: StoredRuleset | null;
  events: StateMutationEvent[];
  actorResolutions: ActorResolution[];
  compendiumEntries: CompendiumEntry[];
  settlementState: SettlementState | null;
  settlementModules: SettlementModule[];
  documents: WritingDocument[];
  chapterCards: ChapterCard[];
}

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
 * Read-only project state for stat cards outside Workspace: every sheet as a
 * peek target, its snapshot at any point, and the scenes and chapter cards
 * that positions refer to. Loads only while `enabled` (and again when
 * `reloadKey` changes), and never creates or migrates records.
 */
export function useCharacterStatPeekData(
  projectId: string | null,
  enabled: boolean,
  reloadKey?: string
) {
  const [data, setData] = useState<StatPeekProjectData | null>(null);

  useEffect(() => {
    if (!projectId || !enabled) return;
    let cancelled = false;
    const load = async () => {
      const [
        sheets,
        entities,
        aliases,
        characters,
        ruleset,
        events,
        actorResolutions,
        compendiumEntries,
        settlementState,
        settlementModules,
        documents,
        chapterCards
      ] = await Promise.all([
        getCharacterSheetsByProject(projectId),
        getEntitiesByProject(projectId),
        getAliasesByProject(projectId),
        getCharactersByProject(projectId),
        getRulesetByProjectId(projectId),
        getStateMutationEventsByProject(projectId),
        getActorResolutionsByProject(projectId),
        getCompendiumEntriesByProject(projectId),
        getSettlementState(projectId),
        getSettlementModulesByProject(projectId),
        getDocumentsByProject(projectId),
        getChapterCardsByProjectId(projectId)
      ]);
      if (cancelled) return;
      setData({
        projectId,
        sheets: deriveCharacterSheetNames(sheets, entities),
        entities,
        aliases,
        characters,
        ruleset,
        events,
        actorResolutions,
        compendiumEntries,
        settlementState,
        settlementModules,
        documents,
        chapterCards
      });
    };
    void load();
    const reload = () => void load();
    RELOAD_EVENTS.forEach((name) => window.addEventListener(name, reload));
    return () => {
      cancelled = true;
      RELOAD_EVENTS.forEach((name) => window.removeEventListener(name, reload));
    };
  }, [enabled, projectId, reloadKey]);

  const current = data && data.projectId === projectId ? data : null;

  const targets = useMemo(
    () =>
      current
        ? buildCharacterPeekTargets({
            sheets: current.sheets,
            entities: current.entities,
            aliases: current.aliases
          })
        : [],
    [current]
  );

  const getSnapshotAt = useCallback(
    (sheetId: string, position: CharacterSnapshotPosition) => {
      const sheet = current?.sheets.find((candidate) => candidate.id === sheetId);
      if (!current || !sheet) return null;
      // Same derivation as the Workspace and Sheets routes.
      const runtimeModifiers = deriveCharacterRuntimeModifiers({
        settlementState: current.settlementState,
        settlementModules: current.settlementModules,
        activePartySynergies: getPartySynergySuggestions({
          characters: current.characters,
          rules: DEFAULT_PARTY_SYNERGY_RULES
        })
      });
      return buildCharacterSnapshot({
        sheet,
        ruleset: current.ruleset,
        events: current.events,
        actorResolutions: current.actorResolutions,
        position,
        runtimeModifiers,
        statDefinitionNameById: new Map(
          (current.ruleset?.statDefinitions ?? []).map((definition) => [
            definition.id,
            definition.name
          ])
        ),
        resourceDefinitionNameById: new Map(
          (current.ruleset?.resourceDefinitions ?? []).map((definition) => [
            definition.id,
            definition.name
          ])
        ),
        compendiumEntries: current.compendiumEntries,
        entityById: new Map(current.entities.map((entity) => [entity.id, entity]))
      });
    },
    [current]
  );

  const getLatestSnapshot = useCallback(
    (sheetId: string) => getSnapshotAt(sheetId, {kind: 'latest'}),
    [getSnapshotAt]
  );

  return {
    isLoaded: Boolean(current),
    targets,
    documents: current?.documents ?? EMPTY_DOCUMENTS,
    chapterCards: current?.chapterCards ?? EMPTY_CARDS,
    getSnapshotAt,
    getLatestSnapshot
  };
}
