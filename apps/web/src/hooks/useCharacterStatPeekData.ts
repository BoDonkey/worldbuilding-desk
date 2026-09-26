import {useCallback, useEffect, useMemo, useState} from 'react';
import type {
  Character,
  CharacterSheet,
  CompendiumEntry,
  SettlementModule,
  SettlementState,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity
} from '../entityTypes';
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
import {buildCharacterSnapshot} from '../services/state/characterSnapshot';
import {buildCharacterPeekTargets} from '../services/state/characterPeek';

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
}

const RELOAD_EVENTS = [
  'wbd:character-sheet-records-changed',
  'wbd:character-records-changed',
  'wbd:entity-records-changed',
  'wbd:alias-records-changed',
  'wbd:state-mutation-events-changed',
  'wbd:compendium-records-changed'
];

/**
 * Read-only project state for the stat peek outside Workspace: every sheet as
 * a peek target and its snapshot at the latest point. Loads only while
 * `enabled`, and never creates or migrates records.
 */
export function useCharacterStatPeekData(projectId: string | null, enabled: boolean) {
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
        settlementModules
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
        getSettlementModulesByProject(projectId)
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
        settlementModules
      });
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

  const getLatestSnapshot = useCallback(
    (sheetId: string) => {
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
        position: {kind: 'latest'},
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

  return {isLoaded: Boolean(current), targets, getLatestSnapshot};
}
