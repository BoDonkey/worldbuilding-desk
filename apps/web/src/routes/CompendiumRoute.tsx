import {useCompendiumEntryForm} from '../components/Compendium/useCompendiumEntryForm';
import {useCompendiumImportForm} from '../components/Compendium/useCompendiumImportForm';
import {useCompendiumRecipeForm} from '../components/Compendium/useCompendiumRecipeForm';
import {useCompendiumMilestoneForm} from '../components/Compendium/useCompendiumMilestoneForm';
import {useCompendiumCraftPreview} from '../components/Compendium/useCompendiumCraftPreview';
import {useCompendiumZoneForm} from '../components/Compendium/useCompendiumZoneForm';
import {useCompendiumModuleForm} from '../components/Compendium/useCompendiumModuleForm';
import {useCompendiumSettlementForm} from '../components/Compendium/useCompendiumSettlementForm';
import {toBiomeKey} from '../services/compendium/compendiumFormValues';
import styles from '../assets/components/CompendiumRoute.module.css';
import {useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {useAppStore} from '../store/appStore';
import {EntriesTab} from '../components/Compendium/EntriesTab';
import {OverviewTab} from '../components/Compendium/OverviewTab';
import {ProgressionTab} from '../components/Compendium/ProgressionTab';
import {WorldSystemsTab} from '../components/Compendium/WorldSystemsTab';
import {
  COMPENDIUM_TABS,
  type CompendiumNextStepItem,
  type CompendiumTab
} from '../components/Compendium/constants';
import type {
  Character,
  CharacterSheet,
  CompendiumMechanicKind,
  CompendiumActionDefinition,
  CompendiumEntry,
  MechanicsProgressScope,
  CompendiumMilestone,
  CompendiumProgress,
  SettlementModule,
  SettlementState,
  StoredRuleset,
  UnlockableRecipe,
  WorldEntity,
  ZoneAffinityProfile,
  ZoneAffinityProgress
} from '../entityTypes';
import {
  DEFAULT_FORTRESS_TIERS,
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCraftingRuntimeModifiers,
  getNextFortressTier,
  getPartySynergySuggestions,
  getSettlementComputedEffects,
  getUnlockedFortressTiers,
  getActiveSettlementAuraEffects,
  getCompendiumActionLogs,
  getCompendiumEntriesByProject,
  getCompendiumMilestonesByProject,
  getCompendiumProgress,
  getRecipesByProject,
  getOrCreateSettlementState,
  getSettlementModulesByProject,
  getZoneAffinityProfilesByProject,
  getZoneAffinityProgressByProject,
  recordCompendiumAction,
  saveCompendiumEntry
} from '../services/compendium';
import {getCharacterSheetsByProject} from '../services/characters';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getProjectCapabilities} from '../projectMode';
import {getRulesetByProjectId} from '../services/rules';
import {describeError} from '../services/errors';
import {RouteFeedback} from '../components/common';

function CompendiumRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CompendiumEntry[]>([]);
  const [milestones, setMilestones] = useState<CompendiumMilestone[]>([]);
  const [recipes, setRecipes] = useState<UnlockableRecipe[]>([]);
  const [zoneProfiles, setZoneProfiles] = useState<ZoneAffinityProfile[]>([]);
  const [zoneProgress, setZoneProgress] = useState<ZoneAffinityProgress[]>([]);
  const [settlementState, setSettlementState] = useState<SettlementState | null>(null);
  const [settlementModules, setSettlementModules] = useState<SettlementModule[]>([]);
  const [progress, setProgress] = useState<CompendiumProgress | null>(null);
  const [logs, setLogs] = useState<Awaited<
    ReturnType<typeof getCompendiumActionLogs>
  >>([]);
  const [globalLogs, setGlobalLogs] = useState<Awaited<
    ReturnType<typeof getCompendiumActionLogs>
  >>([]);
  const [worldEntities, setWorldEntities] = useState<WorldEntity[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [activePartyCharacterIds, setActivePartyCharacterIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const [quantityByActionKey, setQuantityByActionKey] = useState<
    Record<string, number>
  >({});
  const [activeTab, setActiveTab] = useState<CompendiumTab>('overview');
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [activeMechanicsCharacterSheetId, setActiveMechanicsCharacterSheetId] = useState('');
  const [editingMechanicsEntryId, setEditingMechanicsEntryId] = useState<string | null>(null);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const capabilities = getProjectCapabilities(projectSettings);
  const enableGameSystems = capabilities.canUseGameSystems;
  const enableRuntimeModifiers = capabilities.canUseRuntimeModifiers;
  const enableWorldSystems = capabilities.canUseSettlementAndZoneSystems;

  const context = {activeProject, setFeedback};
  const entryForm = useCompendiumEntryForm({...context, setEntries});
  const recipeForm = useCompendiumRecipeForm({...context, setRecipes});
  const milestoneForm = useCompendiumMilestoneForm({...context, setMilestones});
  const craftPreview = useCompendiumCraftPreview();
  const zoneForm = useCompendiumZoneForm({
    ...context, zoneProfiles, activeMechanicsCharacterSheetId, setZoneProfiles, setZoneProgress
  });
  const settlementForm = useCompendiumSettlementForm({...context, settlementState, setSettlementState});
  const {selectedSettlementLocationId, setSelectedSettlementLocationId} = settlementForm;
  const moduleForm = useCompendiumModuleForm({
    ...context, settlementState, selectedSettlementLocationId, setSettlementState, setSettlementModules
  });
  const {setSelectedZoneKey, setZoneSourceEntityId, setZoneName, setZoneKey, setZoneProgressScope} = zoneForm;
  const {entryName, setEntryName} = entryForm;
  const {milestoneName, setMilestoneName} = milestoneForm;
  const {recipeName, setRecipeName} = recipeForm;
  const {zoneName, zoneKey} = zoneForm;
  useEffect(() => {
    if (!activeProject) {
      setEntries([]);
      setMilestones([]);
      setRecipes([]);
      setZoneProfiles([]);
      setZoneProgress([]);
      setSettlementState(null);
      setSettlementModules([]);
      setProgress(null);
      setLogs([]);
      setGlobalLogs([]);
      setWorldEntities([]);
      setCharacters([]);
      setCharacterSheets([]);
      setActivePartyCharacterIds([]);
      setActiveMechanicsCharacterSheetId('');
      setRuleset(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      getCompendiumEntriesByProject(activeProject.id),
      getCompendiumMilestonesByProject(activeProject.id),
      getRecipesByProject(activeProject.id),
      getZoneAffinityProfilesByProject(activeProject.id),
      getZoneAffinityProgressByProject(activeProject.id),
      getOrCreateSettlementState(activeProject.id),
      getSettlementModulesByProject(activeProject.id),
      getCompendiumActionLogs(activeProject.id),
      getEntitiesByProject(activeProject.id),
      getCharactersByProject(activeProject.id),
      getCharacterSheetsByProject(activeProject.id),
      getRulesetByProjectId(activeProject.id)
    ])
      .then(([loadedEntries, loadedMilestones, loadedRecipes, loadedZoneProfiles, loadedZoneProgress, loadedSettlementState, loadedSettlementModules, loadedGlobalLogs, loadedEntities, loadedCharacters, loadedCharacterSheets, loadedRuleset]) => {
        if (cancelled) return;
        setEntries(loadedEntries);
        setMilestones(loadedMilestones);
        setRecipes(loadedRecipes);
        setZoneProfiles(loadedZoneProfiles);
        setZoneProgress(loadedZoneProgress);
        setSettlementState(loadedSettlementState);
        setSettlementModules(loadedSettlementModules);
        setSelectedSettlementLocationId(loadedSettlementState.sourceEntityId ?? '');
        setGlobalLogs(loadedGlobalLogs);
        setWorldEntities(loadedEntities);
        setCharacters(loadedCharacters);
        setCharacterSheets(loadedCharacterSheets);
        setRuleset(loadedRuleset);
        setActiveMechanicsCharacterSheetId((prev) => {
          if (prev && loadedCharacterSheets.some((sheet) => sheet.id === prev)) {
            return prev;
          }
          return loadedCharacterSheets[0]?.id ?? '';
        });
        setActivePartyCharacterIds((prev) => {
          if (prev.length === 0) {
            return loadedCharacters.map((character) => character.id);
          }
          const loadedIdSet = new Set(loadedCharacters.map((character) => character.id));
          const intersected = prev.filter((id) => loadedIdSet.has(id));
          return intersected.length > 0
            ? intersected
            : loadedCharacters.map((character) => character.id);
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          describeError(error, 'Unable to load compendium data.');
        setFeedback({tone: 'error', message});
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, setSelectedSettlementLocationId]);

  useEffect(() => {
    if (!activeProject) {
      setProgress(null);
      setLogs([]);
      return;
    }

    let cancelled = false;
    const scopedCharacterSheetId = activeMechanicsCharacterSheetId || undefined;
    Promise.all([
      getCompendiumProgress(activeProject.id, scopedCharacterSheetId),
      getCompendiumActionLogs(activeProject.id, scopedCharacterSheetId)
    ])
      .then(([loadedProgress, loadedLogs]) => {
        if (cancelled) return;
        setProgress(loadedProgress);
        setLogs(loadedLogs);
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          describeError(error, 'Unable to load mechanics progress.');
        setFeedback({tone: 'error', message});
      });

    return () => {
      cancelled = true;
    };
  }, [activeMechanicsCharacterSheetId, activeProject]);

  useEffect(() => {
    if (activeTab === 'world-systems' && !enableWorldSystems) {
      setActiveTab('overview');
    }
  }, [activeTab, enableWorldSystems]);

  useEffect(() => {
    if (!highlightedEntryId) return;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(`compendium-entry-${highlightedEntryId}`);
      element?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 50);
    return () => window.clearTimeout(timer);
  }, [highlightedEntryId, entries]);

  const completedActionSet = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      set.add(`${log.entryId}:${log.actionId}`);
    }
    return set;
  }, [logs]);
  const globalCompletedActionSet = useMemo(() => {
    const set = new Set<string>();
    for (const log of globalLogs) {
      set.add(`${log.entryId}:${log.actionId}`);
    }
    return set;
  }, [globalLogs]);

  const unlockedMilestoneSet = new Set(progress?.unlockedMilestoneIds ?? []);
  const unlockedRecipeSet = new Set(progress?.unlockedRecipeIds ?? []);
  const activeMechanicsCharacterSheet =
    activeMechanicsCharacterSheetId
      ? characterSheets.find((sheet) => sheet.id === activeMechanicsCharacterSheetId) ?? null
      : null;
  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries]
  );
  const worldEntityById = useMemo(
    () => new Map(worldEntities.map((entity) => [entity.id, entity])),
    [worldEntities]
  );
  const importForm = useCompendiumImportForm({
    ...context, worldEntityById, activeMechanicsCharacterSheetId, setEntries, setZoneProfiles,
    setSelectedZoneKey, setSelectedSettlementLocationId, setSettlementState,
    setShowAdvancedSetup, setActiveTab
  });
  const {entityToImportId, setEntityToImportId, setImportMechanicKind, setImportProgressScope} = importForm;
  useEffect(() => {
    const state = location.state as
      | {
          focusEntryId?: string;
          activeTab?: CompendiumTab;
          flashMessage?: string;
          importEntityId?: string;
          importMechanicKind?: CompendiumMechanicKind;
          importProgressScope?: MechanicsProgressScope;
        }
      | null;
    if (!state) return;

    if (state.activeTab) {
      setActiveTab(state.activeTab);
      if (state.activeTab === 'progression' || state.activeTab === 'world-systems') {
        setShowAdvancedSetup(true);
      }
    }
    if (state.flashMessage) {
      setFeedback({tone: 'success', message: state.flashMessage});
    }
    if (state.focusEntryId) {
      setHighlightedEntryId(state.focusEntryId);
    }
    if (state.importEntityId) {
      setEntityToImportId(state.importEntityId);
    }
    if (state.importMechanicKind) {
      setImportMechanicKind(state.importMechanicKind);
    }
    if (state.importProgressScope) {
      setImportProgressScope(state.importProgressScope);
    }
  }, [location.key, location.state, setEntityToImportId, setImportMechanicKind, setImportProgressScope]);

  const zoneProfileBySourceEntityId = useMemo(
    () =>
      new Map(
        zoneProfiles
          .filter((profile): profile is ZoneAffinityProfile & {sourceEntityId: string} =>
            Boolean(profile.sourceEntityId)
          )
          .map((profile) => [profile.sourceEntityId, profile])
      ),
    [zoneProfiles]
  );
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );
  const activePartyCharacters = useMemo(() => {
    const selectedSet = new Set(activePartyCharacterIds);
    return characters.filter((character) => selectedSet.has(character.id));
  }, [characters, activePartyCharacterIds]);
  const settlementLocationName =
    settlementState?.sourceEntityId
      ? worldEntityById.get(settlementState.sourceEntityId)?.name ?? settlementState.sourceEntityId
      : null;
  const activePartySynergies = useMemo(
    () => {
      if (!enableWorldSystems) return [];
      return getPartySynergySuggestions({
        characters: activePartyCharacters
      });
    },
    [activePartyCharacters, enableWorldSystems]
  );
  const rosterSynergyOpportunities = useMemo(
    () => {
      if (!enableWorldSystems) return [];
      return getPartySynergySuggestions({
        characters,
        rules: DEFAULT_PARTY_SYNERGY_RULES
      }).filter((suggestion) => suggestion.missingRoles.length > 0);
    },
    [characters, enableWorldSystems]
  );
  const craftingRuntimeModifiers = useMemo(
    () => {
      if (!enableRuntimeModifiers || !enableWorldSystems) {
        return {
          levelBonus: 0,
          materialCostMultiplier: 1,
          notes: ['Runtime modifiers disabled in Project Settings.']
        };
      }
      return deriveCraftingRuntimeModifiers({
        settlementState,
        settlementModules,
        activePartySynergies
      });
    },
    [
      enableRuntimeModifiers,
      enableWorldSystems,
      settlementState,
      settlementModules,
      activePartySynergies
    ]
  );
  const zoneProgressByKey = useMemo(
    () =>
      new Map(
        zoneProgress.map((progressItem) => [
          `${progressItem.biomeKey}:${progressItem.characterSheetId ?? 'global'}`,
          progressItem
        ])
      ),
    [zoneProgress]
  );
  const activeSettlementEffects = useMemo(() => {
    if (!enableWorldSystems || !settlementState) return [];
    return getActiveSettlementAuraEffects({
      settlementState,
      modules: settlementModules
    });
  }, [enableWorldSystems, settlementState, settlementModules]);

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    const locationName =
      worldEntities.find((entity) => entity.id === selectedSettlementLocationId)?.name ??
      'Main Base';
    void getOrCreateSettlementState(
      activeProject.id,
      locationName,
      selectedSettlementLocationId || undefined
    )
      .then((nextState) => {
        if (!cancelled) {
          setSettlementState(nextState);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          describeError(error, 'Unable to load settlement state.');
        setFeedback({tone: 'error', message});
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject, selectedSettlementLocationId, worldEntities]);
  const settlementComputedEffects = useMemo(() => {
    if (!enableWorldSystems || !settlementState) {
      return {auraEffects: [], fortressEffects: [], allEffects: []};
    }
    return getSettlementComputedEffects({
      settlementState,
      modules: settlementModules
    });
  }, [enableWorldSystems, settlementState, settlementModules]);
  const unlockedFortressTiers = useMemo(() => {
    if (!enableWorldSystems || !settlementState) return [];
    return getUnlockedFortressTiers({
      fortressLevel: settlementState.fortressLevel,
      tiers: DEFAULT_FORTRESS_TIERS
    });
  }, [enableWorldSystems, settlementState]);
  const nextFortressTier = useMemo(() => {
    if (!enableWorldSystems || !settlementState) return null;
    return getNextFortressTier({
      fortressLevel: settlementState.fortressLevel,
      tiers: DEFAULT_FORTRESS_TIERS
    });
  }, [enableWorldSystems, settlementState]);
  const reviewEntries = useMemo(
    () => entries.filter((entry) => entry.needsCompletion),
    [entries]
  );

  const handleUpdateEntryMechanics = async (
    entry: CompendiumEntry,
    updates: Partial<Pick<CompendiumEntry, 'mechanicKind' | 'progressScope' | 'consumable'>>
  ) => {
    const next: CompendiumEntry = {
      ...entry,
      ...updates,
      updatedAt: Date.now()
    };
    setFeedback(null);
    try {
      await saveCompendiumEntry(next);
      setEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? next : item))
      );
      setFeedback({tone: 'success', message: 'Mechanics settings saved.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to update mechanics settings.');
      setFeedback({tone: 'error', message});
    }
  };

  const handleOpenEntryMechanicsEditor = async (entry: CompendiumEntry) => {
    if (!entry.sourceEntityId) return;
    if (entry.mechanicKind === 'zone') {
      const existingProfile = zoneProfileBySourceEntityId.get(entry.sourceEntityId);
      if (existingProfile) {
        setSelectedZoneKey(existingProfile.biomeKey);
      } else {
        const sourceEntity = worldEntityById.get(entry.sourceEntityId);
        setZoneSourceEntityId(entry.sourceEntityId);
        setZoneName(sourceEntity?.name ?? entry.name);
        setZoneKey(toBiomeKey(sourceEntity?.name ?? entry.name));
        setZoneProgressScope(
          entry.progressScope === 'party' ? 'global' : entry.progressScope ?? 'character'
        );
      }
      setShowAdvancedSetup(true);
      setActiveTab('world-systems');
      return;
    }

    if (entry.mechanicKind === 'settlement') {
      setSelectedSettlementLocationId(entry.sourceEntityId);
      setShowAdvancedSetup(true);
      setActiveTab('world-systems');
      return;
    }

    setActiveTab('entries');
  };

  const handleMarkEntryComplete = async (entry: CompendiumEntry) => {
    const next: CompendiumEntry = {
      ...entry,
      needsCompletion: false,
      updatedAt: Date.now()
    };

    setFeedback(null);
    try {
      await saveCompendiumEntry(next);
      setEntries((prev) =>
        prev
          .map((item) => (item.id === entry.id ? next : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setFeedback({tone: 'success', message: `"${entry.name}" marked complete.`});
    } catch (error) {
      const message =
        describeError(error, 'Unable to update entry.');
      setFeedback({tone: 'error', message});
    }
  };

  const handleRecordAction = async (
    entry: CompendiumEntry,
    action: CompendiumActionDefinition
  ) => {
    if (!activeProject) return;
    if (entry.progressScope === 'character' && !activeMechanicsCharacterSheetId) {
      setFeedback({
        tone: 'error',
        message: 'Choose a character sheet before recording character-scoped discovery.'
      });
      return;
    }
    const key = `${entry.id}:${action.id}`;
    const quantity = action.repeatable
      ? Math.max(1, Math.floor(quantityByActionKey[key] || 1))
      : 1;

    setIsRecordingKey(key);
    setFeedback(null);
    try {
      const result = await recordCompendiumAction({
        projectId: activeProject.id,
        entryId: entry.id,
        actionId: action.id,
        quantity,
        characterSheetId:
          entry.progressScope === 'character'
            ? activeMechanicsCharacterSheetId || undefined
            : undefined
      });
      setProgress(result.progress);
      if (result.log) {
        if (entry.progressScope === 'character') {
          setLogs((prev) => [result.log!, ...prev]);
        } else {
          setGlobalLogs((prev) => [result.log!, ...prev]);
        }
      }
      if (!result.log) {
        setFeedback({
          tone: 'success',
          message: 'Action already recorded (non-repeatable).'
        });
      } else if (
        result.unlockedMilestoneIds.length > 0 ||
        result.unlockedRecipeIds.length > 0
      ) {
        setFeedback({
          tone: 'success',
          message: `Action recorded. Unlocked ${result.unlockedMilestoneIds.length} milestone(s) and ${result.unlockedRecipeIds.length} recipe(s).`
        });
      } else {
        setFeedback({tone: 'success', message: 'Action recorded.'});
      }
    } catch (error) {
      const message =
        describeError(error, 'Unable to record action.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsRecordingKey(null);
    }
  };

  const togglePartyCharacter = (characterId: string): void => {
    setActivePartyCharacterIds((prev) =>
      prev.includes(characterId)
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    );
  };

  if (!activeProject) {
    return (
      <section>
        <h1>Mechanics</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  if (!enableGameSystems) {
    return (
      <section>
        <h1>Mechanics</h1>
        <p>
          Mechanics are hidden because <strong>Enable Game Systems</strong> is
          turned off for this project.
        </p>
        <p>Re-enable game systems when you want progression, crafting, discovery, or runtime mechanics.</p>
      </section>
    );
  }

  const visibleTabs = COMPENDIUM_TABS.filter((tab) => {
    if (tab.id === 'overview' || tab.id === 'entries') {
      return true;
    }
    if (tab.id === 'progression') {
      return showAdvancedSetup || milestones.length > 0 || recipes.length > 0;
    }
    if (tab.id === 'world-systems') {
      return (
        enableWorldSystems &&
        (showAdvancedSetup || zoneProfiles.length > 0 || settlementModules.length > 0)
      );
    }
    return !tab.advanced || enableWorldSystems;
  });
  const currentTab =
    visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];
  const hasImportedEntity = entries.some((entry) => Boolean(entry.sourceEntityId));
  const nextStepItems: CompendiumNextStepItem[] = [
    {
      id: 'import-entity',
      done: hasImportedEntity,
      label: 'Link your first World Bible record into mechanics.',
      tab: 'entries'
    },
    {
      id: 'create-entry',
      done: entries.length > 0,
      label: 'Create at least one compendium entry.',
      tab: 'entries'
    },
    {
      id: 'create-milestone',
      done: milestones.length > 0,
      label: 'Create a milestone threshold.',
      tab: 'progression'
    },
    {
      id: 'define-recipe',
      done: recipes.length > 0,
      label: 'Define at least one recipe unlock.',
      tab: 'progression'
    },
    {
      id: 'log-action',
      done: logs.length > 0,
      label: 'Record an action to advance progression.',
      tab: 'entries'
    },
    {
      id: 'create-zone',
      done: !enableWorldSystems || zoneProfiles.length > 0,
      label: 'Add a zone profile if you need advanced simulation.',
      tab: 'world-systems'
    }
  ];
  const tabAwareNextSteps = nextStepItems.filter((item) => {
    if (activeTab === 'overview') return !item.done;
    return item.tab === activeTab && !item.done;
  });
  const compactNextSteps = tabAwareNextSteps.filter(
    (item) =>
      item.tab === 'entries' ||
      (showAdvancedSetup && (item.tab === 'progression' || item.tab === 'world-systems'))
  );
  const activeTabDoneCount = nextStepItems.filter(
    (item) => item.tab === activeTab && item.done
  ).length;
  const activeTabTotalCount = nextStepItems.filter(
    (item) => item.tab === activeTab
  ).length;
  const openTabWithSmartDefaults = (
    tab: CompendiumTab,
    stepId?: string
  ): void => {
    setActiveTab(tab);
    if (tab === 'entries') {
      if (!entryName.trim() && stepId === 'create-entry') {
        setEntryName('First Entry');
      }
      if (!entityToImportId && stepId === 'import-entity' && worldEntities.length > 0) {
        setEntityToImportId(worldEntities[0].id);
      }
      return;
    }
    if (tab === 'progression') {
      if (!milestoneName.trim() && stepId === 'create-milestone') {
        setMilestoneName('First Milestone');
      }
      if (!recipeName.trim() && stepId === 'define-recipe') {
        setRecipeName('First Recipe');
      }
      return;
    }
    if (tab === 'world-systems') {
      if (!zoneName.trim() && stepId === 'create-zone') {
        setZoneName('Starter Zone');
      }
      if (!zoneKey.trim() && stepId === 'create-zone') {
        setZoneKey('starter_zone');
      }
    }
  };

  if (!showAdvancedSetup) {
    return (
      <section>
        <h1>Mechanics</h1>
        <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
        <section className={`${styles.marginBottom085rem} ${styles.padding085rem} ${styles.border1pxSolidVarColorAccentSoftBg} ${styles.borderRadius8px} ${styles.backgroundColorVarColorBgSecondary}`}>
          <strong>Character tracking starts in the World Bible</strong>
          <p className={`${styles.fontSize088rem} ${styles.colorVarColorTextSecondary}`}>
            Open a character’s Mechanics section to add a stat or resource and record scene changes. This destination is for advanced compendium entries, progression, recipes, milestones, zones, and settlement systems.
          </p>
          <div className={`${styles.displayFlex} ${styles.gap05rem} ${styles.flexWrapWrap}`}>
            <button type='button' onClick={() => navigate('/world-bible')}>Open World Bible</button>
            <button type='button' onClick={() => setShowAdvancedSetup(true)}>Advanced mechanics</button>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section>
      <h1>Mechanics</h1>
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      <details
        className={`${styles.marginBottom1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px} ${styles.padding07rem085rem} ${styles.backgroundColorVarColorBgSecondary}`}
      >
        <summary className={`${styles.cursorPointer} ${styles.fontWeight600}`}>
          Mechanics Setup Help
        </summary>
        <div className={`${styles.marginTop06rem} ${styles.fontSize09rem} ${styles.colorVarColorTextPrimary}`}>
          <p className={styles.margin0004rem0}>
            Step 1: link a world record only when it truly needs mechanics.
          </p>
          <p className={styles.margin0004rem0}>
            Step 2: stay in Entries for lightweight setup.
          </p>
          <p className={styles.margin0}>
            Step 3: open advanced setup only when you need progression, recipes, zones, or simulation.
          </p>
        </div>
      </details>
      <button type='button' className={styles.marginBottom085rem} onClick={() => setShowAdvancedSetup(false)}>
        Hide advanced mechanics
      </button>
      <div className={`${styles.displayFlex} ${styles.gap05rem} ${styles.flexWrapWrap} ${styles.marginBottom08rem}`}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type='button'
            onClick={() => setActiveTab(tab.id)}
            className={`${styles.tabButton} ${
              activeTab === tab.id ? styles.tabButtonActive : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={`${styles.fontSize09rem} ${styles.colorVarColorTextSecondary} ${styles.marginBottom05rem}`}>
        {currentTab.subtitle}
      </div>
      <section
        className={`${styles.marginBottom085rem} ${styles.padding075rem085rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px} ${styles.backgroundColorVarColorBgSecondary}`}
      >
        <h2 className={`${styles.marginTop0} ${styles.marginBottom045rem} ${styles.fontSize1rem}`}>
          Next Steps For {currentTab.label}
        </h2>
        {activeTab !== 'overview' && activeTabTotalCount > 0 && (
          <p className={`${styles.marginTop0} ${styles.marginBottom055rem} ${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
            Completed in this section: {activeTabDoneCount}/{activeTabTotalCount}
          </p>
        )}
        {compactNextSteps.length === 0 ? (
          <p className={`${styles.margin0} ${styles.fontSize088rem} ${styles.colorVarColorTextPrimary}`}>
            This section is in good shape. Move to another tab for additional setup.
          </p>
        ) : (
          <ul className={`${styles.listStyleNone} ${styles.margin0} ${styles.padding0}`}>
            {compactNextSteps.slice(0, 3).map((item) => (
              <li key={`tab-next-${item.id}`} className={styles.marginBottom035rem}>
                Next: {item.label}
                {activeTab === 'overview' && (
                  <>
                    {' '}
                    <button
                      type='button'
                      onClick={() => openTabWithSmartDefaults(item.tab, item.id)}
                    >
                      Open {COMPENDIUM_TABS.find((tab) => tab.id === item.tab)?.label}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className={`${styles.displayFlex} ${styles.gap04rem} ${styles.flexWrapWrap} ${styles.marginBottom1rem}`}>
        <span
          className={`${styles.fontSize075rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius999px} ${styles.padding015rem045rem}`}
        >
          Game Systems: {enableGameSystems ? 'On' : 'Off'}
        </span>
        <span
          className={`${styles.fontSize075rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius999px} ${styles.padding015rem045rem}`}
        >
          Runtime Modifiers: {enableRuntimeModifiers ? 'On' : 'Off'}
        </span>
      </div>
      {!showAdvancedSetup &&
        milestones.length === 0 &&
        recipes.length === 0 &&
        zoneProfiles.length === 0 &&
        settlementModules.length === 0 && (
          <p className={`${styles.marginTop0} ${styles.marginBottom085rem} ${styles.fontSize084rem} ${styles.colorVarColorTextSecondary}`}>
            Advanced mechanics are hidden until you ask for them.
          </p>
        )}

      {currentTab.id === 'overview' && (
        <OverviewTab
          entryById={entryById}
          isLoading={isLoading}
          logs={logs}
          nextStepItems={nextStepItems}
          openTabWithSmartDefaults={openTabWithSmartDefaults}
          progress={progress}
        />
      )}
      {currentTab.id === 'entries' && (
        <EntriesTab
          {...importForm}
          {...entryForm}
          activeMechanicsCharacterSheet={activeMechanicsCharacterSheet}
          activeMechanicsCharacterSheetId={activeMechanicsCharacterSheetId}
          characterSheets={characterSheets}
          completedActionSet={completedActionSet}
          editingMechanicsEntryId={editingMechanicsEntryId}
          entries={entries}
          globalCompletedActionSet={globalCompletedActionSet}
          handleMarkEntryComplete={handleMarkEntryComplete}
          handleOpenEntryMechanicsEditor={handleOpenEntryMechanicsEditor}
          handleRecordAction={handleRecordAction}
          handleUpdateEntryMechanics={handleUpdateEntryMechanics}
          highlightedEntryId={highlightedEntryId}
          isRecordingKey={isRecordingKey}
          navigate={navigate}
          quantityByActionKey={quantityByActionKey}
          reviewEntries={reviewEntries}
          ruleset={ruleset}
          setActiveMechanicsCharacterSheetId={setActiveMechanicsCharacterSheetId}
          setEditingMechanicsEntryId={setEditingMechanicsEntryId}
          setQuantityByActionKey={setQuantityByActionKey}
          settlementLocationName={settlementLocationName}
          settlementState={settlementState}
          worldEntities={worldEntities}
          worldEntityById={worldEntityById}
          zoneProfileBySourceEntityId={zoneProfileBySourceEntityId}
        />
      )}
      {currentTab.id === 'progression' && (
        <ProgressionTab
          {...craftPreview}
          {...milestoneForm}
          {...recipeForm}
          craftingRuntimeModifiers={craftingRuntimeModifiers}
          milestones={milestones}
          progress={progress}
          recipes={recipes}
          unlockedMilestoneSet={unlockedMilestoneSet}
          unlockedRecipeSet={unlockedRecipeSet}
        />
      )}
      {currentTab.id === 'world-systems' && (
        <WorldSystemsTab
          {...settlementForm}
          {...moduleForm}
          {...zoneForm}
          activeMechanicsCharacterSheetId={activeMechanicsCharacterSheetId}
          activePartyCharacterIds={activePartyCharacterIds}
          activePartySynergies={activePartySynergies}
          activeSettlementEffects={activeSettlementEffects}
          characterById={characterById}
          characterSheets={characterSheets}
          characters={characters}
          enableWorldSystems={enableWorldSystems}
          nextFortressTier={nextFortressTier}
          rosterSynergyOpportunities={rosterSynergyOpportunities}
          setActiveMechanicsCharacterSheetId={setActiveMechanicsCharacterSheetId}
          settlementComputedEffects={settlementComputedEffects}
          settlementModules={settlementModules}
          settlementState={settlementState}
          togglePartyCharacter={togglePartyCharacter}
          unlockedFortressTiers={unlockedFortressTiers}
          worldEntities={worldEntities}
          worldEntityById={worldEntityById}
          zoneProfiles={zoneProfiles}
          zoneProgressByKey={zoneProgressByKey}
        />
      )}
    </section>
  );
}

export default CompendiumRoute;
