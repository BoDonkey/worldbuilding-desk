import {useCallback, useEffect, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {
  Character,
  CharacterSheet,
  EntityCategory,
  ProjectSettings,
  StateMutationEvent,
  StatBlockGroup,
  StatBlockInsertMode,
  StatBlockScopePreset,
  StatBlockSourceType,
  StatBlockStyle,
  StoredRuleset,
  WorkspaceImportMode,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import type {EditorConfig} from '../config/editorConfig';
import {createEditorConfigWithStyles} from '../config/editorConfig';
import {getDocumentsByProject} from '../writingStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getCategoriesByProject, initializeDefaultCategories} from '../categoryStorage';
import {getCharactersByProject} from '../characterStorage';
import {getCharacterSheetsByProject} from '../services/characters';
import {getOrCreateSettings, getResolvedConsistencyActionCues} from '../settingsStorage';
import {getRulesetByProjectId} from '../services/rules';
import {
  getCompendiumActionLogs,
  getCompendiumEntriesByProject,
  getCompendiumProgress,
  getOrCreateSettlementState,
  getSettlementModulesByProject
} from '../services/compendium';
import {
  getSeriesBibleConfig,
  getCanonSyncState
} from '../services/seriesBible/SeriesBibleService';
import {getAliasesByProject, type ConsistencyAlias} from '../services/consistency';
import {appendSystemHistoryEntry} from '../services/system';
import {getStateMutationEventsByProject} from '../services/state/stateMutationLedger';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import type {Project} from '../entityTypes';

interface UseWorkspaceProjectDataParams {
  activeProject: Project | null;
  initializeEditorState: (doc: WritingDocument | null) => void;
  setDocuments: Dispatch<SetStateAction<WritingDocument[]>>;
  setImportMode: (mode: WorkspaceImportMode) => void;
  setSkipImportSuggestions: (val: boolean) => void;
  refreshSystemHistory: () => void;
  onProjectReset: () => void;
}

export function useWorkspaceProjectData({
  activeProject,
  initializeEditorState,
  setDocuments,
  setImportMode,
  setSkipImportSuggestions,
  refreshSystemHistory,
  onProjectReset
}: UseWorkspaceProjectDataParams) {
  const [editorConfig, setEditorConfig] = useState<EditorConfig | null>(null);
  const [toolbarButtons, setToolbarButtons] = useState<
    Array<{id: string; label: string; markName: string}>
  >([]);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [aliases, setAliases] = useState<ConsistencyAlias[]>([]);
  const [resolvedActionCues, setResolvedActionCues] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const [settlementState, setSettlementState] = useState<Awaited<
    ReturnType<typeof getOrCreateSettlementState>
  > | null>(null);
  const [settlementModules, setSettlementModules] = useState<Awaited<
    ReturnType<typeof getSettlementModulesByProject>
  >>([]);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [canonState, setCanonState] = useState<{
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  }>({});
  const [stateMutationEvents, setStateMutationEvents] = useState<StateMutationEvent[]>([]);

  // StatBlock preference state — owned here, loaded from settings, also mutated by
  // useWorkspaceStatBlocks at runtime (user selections).
  const [statBlockSourceType, setStatBlockSourceType] =
    useState<StatBlockSourceType>('character');
  const [statBlockStyle, setStatBlockStyle] = useState<StatBlockStyle>('full');
  const [statBlockInsertMode, setStatBlockInsertMode] =
    useState<StatBlockInsertMode>('block');
  const [statBlockScopePreset, setStatBlockScopePreset] =
    useState<StatBlockScopePreset>('all');
  const [selectedStatGroupId, setSelectedStatGroupId] = useState('');
  const [selectedStatIds, setSelectedStatIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [statBlockGroups, setStatBlockGroups] = useState<StatBlockGroup[]>([]);
  const [newStatGroupName, setNewStatGroupName] = useState('');
  const [selectedStatCharacterId, setSelectedStatCharacterId] = useState('');
  const [selectedStatEntityId, setSelectedStatEntityId] = useState('');
  const [statBlockInsertContent, setStatBlockInsertContent] = useState<string | null>(null);
  const [pendingStatBlockRebindToken, setPendingStatBlockRebindToken] = useState<
    string | null
  >(null);
  const [isStatPreferencesHydrated, setStatPreferencesHydrated] = useState(false);

  const syncCompendiumSystemSignals = useCallback(async () => {
    if (!activeProject) return;
    const [logs, entries, progress] = await Promise.all([
      getCompendiumActionLogs(activeProject.id),
      getCompendiumEntriesByProject(activeProject.id),
      getCompendiumProgress(activeProject.id)
    ]);
    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));

    logs.slice(0, 80).forEach((log) => {
      const entry = entryMap.get(log.entryId);
      const action = entry?.actions.find((item) => item.id === log.actionId);
      const message = `Compendium action: ${entry?.name ?? 'Unknown entry'} · ${
        action?.label ?? log.actionId
      } (+${log.pointsAwarded} pts${log.quantity > 1 ? ` x${log.quantity}` : ''}).`;
      appendSystemHistoryEntry(activeProject.id, {
        category: 'resource',
        message,
        insertText: `System Update: ${message}`,
        sourceKey: `compendium-log:${log.id}`,
        createdAt: log.createdAt
      });
    });

    appendSystemHistoryEntry(activeProject.id, {
      category: 'quest',
      message:
        `Compendium progress: ${progress.totalPoints} total points, ` +
        `${progress.unlockedMilestoneIds.length} milestone(s), ` +
        `${progress.unlockedRecipeIds.length} recipe(s) unlocked.`,
      insertText:
        `Quest Progress: ${progress.totalPoints} points · ` +
        `${progress.unlockedMilestoneIds.length} milestones · ` +
        `${progress.unlockedRecipeIds.length} recipes.`,
      sourceKey: `compendium-progress:${progress.updatedAt}`,
      createdAt: progress.updatedAt
    });

    refreshSystemHistory();
  }, [activeProject, refreshSystemHistory]);

  // Load all project-scoped data when the active project changes.
  useEffect(() => {
    if (!activeProject) {
      setEditorConfig(null);
      setToolbarButtons([]);
      setProjectSettings(null);
      setEntities([]);
      setCategories([]);
      setAliases([]);
      setResolvedActionCues([]);
      setCharacters([]);
      setCharacterSheets([]);
      setRuleset(null);
      setSettlementState(null);
      setSettlementModules([]);
      setStateMutationEvents([]);
      setSelectedStatCharacterId('');
      setSelectedStatEntityId('');
      setStatBlockSourceType('character');
      setStatBlockStyle('full');
      setStatBlockInsertMode('block');
      setStatBlockScopePreset('all');
      setSelectedStatGroupId('');
      setSelectedStatIds([]);
      setSelectedResourceIds([]);
      setStatBlockGroups([]);
      setNewStatGroupName('');
      setStatPreferencesHydrated(false);
      onProjectReset();
      return;
    }

    let cancelled = false;

    (async () => {
      await initializeDefaultCategories(activeProject.id);
      const [
        docs,
        settings,
        resolvedCues,
        loadedEntities,
        loadedCategories,
        loadedAliases,
        loadedCharacters,
        loadedSheets,
        loadedRuleset,
        loadedSettlementState,
        loadedSettlementModules,
        loadedStateMutationEvents
      ] = await Promise.all([
        getDocumentsByProject(activeProject.id),
        getOrCreateSettings(activeProject.id),
        getResolvedConsistencyActionCues(activeProject),
        getEntitiesByProject(activeProject.id),
        getCategoriesByProject(activeProject.id),
        getAliasesByProject(activeProject.id),
        getCharactersByProject(activeProject.id),
        getCharacterSheetsByProject(activeProject.id),
        getRulesetByProjectId(activeProject.id),
        getOrCreateSettlementState(activeProject.id),
        getSettlementModulesByProject(activeProject.id),
        getStateMutationEventsByProject(activeProject.id)
      ]);

      if (cancelled) return;

      setDocuments(docs);
      setEditorConfig(createEditorConfigWithStyles(settings.characterStyles));
      setProjectSettings(settings);
      setImportMode(settings.defaultImportMode ?? 'balanced');
      setSkipImportSuggestions(settings.defaultSkipImportSuggestions ?? false);
      setResolvedActionCues(resolvedCues);
      setCategories(loadedCategories);
      setAliases(loadedAliases);
      setStatBlockSourceType(settings.statBlockPreferences?.sourceType ?? 'character');
      setStatBlockStyle(settings.statBlockPreferences?.style ?? 'full');
      setStatBlockInsertMode(settings.statBlockPreferences?.insertMode ?? 'block');
      setStatBlockScopePreset(settings.statBlockPreferences?.scopePreset ?? 'all');
      setSelectedStatGroupId(settings.statBlockPreferences?.selectedGroupId ?? '');
      setSelectedStatIds(settings.statBlockPreferences?.selectedStatIds ?? []);
      setSelectedResourceIds(settings.statBlockPreferences?.selectedResourceIds ?? []);
      setStatBlockGroups(settings.statBlockPreferences?.groups ?? []);
      setEntities(loadedEntities);
      setCharacters(loadedCharacters);
      setCharacterSheets(loadedSheets);
      setRuleset(loadedRuleset);
      setSettlementState(loadedSettlementState);
      setSettlementModules(loadedSettlementModules);
      setStateMutationEvents(loadedStateMutationEvents);
      setSelectedStatCharacterId(loadedSheets[0]?.id ?? '');
      setSelectedStatEntityId(loadedEntities[0]?.id ?? '');
      setStatPreferencesHydrated(true);

      const buttons = settings.characterStyles.map((style) => ({
        id: style.id,
        label: style.name,
        markName: style.markName
      }));
      setToolbarButtons(buttons);

      refreshSystemHistory();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeProject,
    initializeEditorState,
    setDocuments,
    setImportMode,
    setSkipImportSuggestions,
    refreshSystemHistory,
    onProjectReset
  ]);

  // Sync canon state when parent project relationship changes.
  useEffect(() => {
    let cancelled = false;
    const seriesBibleConfig = activeProject ? getSeriesBibleConfig(activeProject) : null;
    if (!activeProject || !seriesBibleConfig?.parentProjectId) {
      setCanonState({});
      return;
    }
    getCanonSyncState(activeProject).then((state) => {
      if (!cancelled) {
        setCanonState(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  // Initialize RAG service when project changes.
  useEffect(() => {
    if (!activeProject) {
      setRagService(null);
      return;
    }

    const bibleConfig = getSeriesBibleConfig(activeProject);
    const ragOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritRag
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};
    let cancelled = false;

    getRAGService(ragOptions).then((service) => {
      if (!cancelled) {
        setRagService(service);
      }
    });

    return () => {
      cancelled = true;
      setRagService(null);
    };
  }, [activeProject]);

  // Sync compendium data into system history on mount and window focus.
  useEffect(() => {
    if (!activeProject) return;
    void syncCompendiumSystemSignals().catch(() => {
      // Compendium data is optional for some projects.
    });

    const onFocus = () => {
      void syncCompendiumSystemSignals().catch(() => {
        // Ignore sync errors from optional stores.
      });
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [activeProject, syncCompendiumSystemSignals]);

  // Keep RAG entity vocabulary up-to-date when entities or characters change.
  useEffect(() => {
    if (!activeProject || !ragService) return;

    const vocabulary = [
      ...entities.map((entity) => ({
        id: entity.id,
        terms: [
          entity.name,
          ...Object.values(entity.fields).filter(
            (value): value is string => typeof value === 'string'
          )
        ]
      })),
      ...characters.map((character) => ({
        id: character.id,
        terms: [
          character.name,
          character.fields?.role ?? '',
          character.fields?.notes ?? ''
        ].filter(Boolean) as string[]
      }))
    ];

    ragService.setEntityVocabulary(vocabulary);
  }, [activeProject, ragService, entities, characters]);

  useEffect(() => {
    if (!activeProject) return;
    const refresh = () => {
      void getStateMutationEventsByProject(activeProject.id).then((events) => {
        setStateMutationEvents(events);
      });
    };
    window.addEventListener('wbd:state-mutation-events-changed', refresh);
    return () => {
      window.removeEventListener('wbd:state-mutation-events-changed', refresh);
    };
  }, [activeProject]);

  return {
    // Editor
    editorConfig,
    toolbarButtons,

    // Project settings (setter needed by useWorkspaceStatBlocks)
    projectSettings,
    setProjectSettings,

    // World data (setters needed by useWorkspaceConsistency)
    entities,
    setEntities,
    categories,
    setCategories,
    aliases,
    setAliases,
    resolvedActionCues,
    characters,
    setCharacters,
    characterSheets,
    ruleset,

    // Game systems
    settlementState,
    settlementModules,

    // RAG
    ragService,

    // Canon sync (setter needed by handleCanonSync in route)
    canonState,
    setCanonState,
    stateMutationEvents,

    // StatBlock preferences (all setters needed by useWorkspaceStatBlocks)
    statBlockSourceType,
    setStatBlockSourceType,
    statBlockStyle,
    setStatBlockStyle,
    statBlockInsertMode,
    setStatBlockInsertMode,
    statBlockScopePreset,
    setStatBlockScopePreset,
    selectedStatGroupId,
    setSelectedStatGroupId,
    selectedStatIds,
    setSelectedStatIds,
    selectedResourceIds,
    setSelectedResourceIds,
    statBlockGroups,
    setStatBlockGroups,
    newStatGroupName,
    setNewStatGroupName,
    selectedStatCharacterId,
    setSelectedStatCharacterId,
    selectedStatEntityId,
    setSelectedStatEntityId,
    statBlockInsertContent,
    setStatBlockInsertContent,
    pendingStatBlockRebindToken,
    setPendingStatBlockRebindToken,
    isStatPreferencesHydrated
  };
}
