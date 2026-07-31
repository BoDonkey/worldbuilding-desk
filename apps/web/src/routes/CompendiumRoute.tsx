import {useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate} from 'react-router';
import {useAppStore} from '../store/appStore';
import {EntriesTab} from '../components/Compendium/EntriesTab';
import {OverviewTab} from '../components/Compendium/OverviewTab';
import {ProgressionTab} from '../components/Compendium/ProgressionTab';
import {WorldSystemsTab} from '../components/Compendium/WorldSystemsTab';
import {
  BASE_STAT_KEYS,
  BASE_STAT_LIMITS,
  COMPENDIUM_TABS,
  type BaseStatKey,
  type CompendiumNextStepItem,
  type CompendiumTab
} from '../components/Compendium/constants';
import type {
  Character,
  CharacterSheet,
  CompendiumMechanicKind,
  CompendiumActionDefinition,
  CompendiumDomain,
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
  attachModuleToSettlement,
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
  recordZoneExposure,
  recordCompendiumAction,
  saveCompendiumEntry,
  saveCompendiumMilestone,
  saveSettlementModule,
  updateSettlementLocation,
  updateSettlementBaseStats,
  updateSettlementFortressLevel,
  saveUnlockableRecipe,
  upsertZoneAffinityProfile,
  upsertCompendiumEntryFromEntity
} from '../services/compendium';
import {getCharacterSheetsByProject} from '../services/characters';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getProjectCapabilities} from '../projectMode';
import {getRulesetByProjectId} from '../services/rules';

// activeProject and projectSettings read from store below

function toBaseStatsDraft(
  baseStats: NonNullable<SettlementState['baseStats']>
): Record<BaseStatKey, string> {
  return {
    defense: String(baseStats.defense),
    storageCapacity: String(baseStats.storageCapacity),
    craftingThroughput: String(baseStats.craftingThroughput),
    morale: String(baseStats.morale)
  };
}

function clampBaseStatValue(key: BaseStatKey, value: number): number {
  const limits = BASE_STAT_LIMITS[key];
  return Math.min(limits.max, Math.max(limits.min, Math.floor(value)));
}

function getDefaultActions(domain: CompendiumDomain): CompendiumActionDefinition[] {
  if (domain === 'beast') {
    return [
      {id: 'discover', label: 'Discover', points: 1, repeatable: false},
      {id: 'kill', label: 'Kill', points: 3, repeatable: true},
      {id: 'skin', label: 'Skin', points: 2, repeatable: true}
    ];
  }
  if (domain === 'flora' || domain === 'mineral') {
    return [
      {id: 'discover', label: 'Discover', points: 1, repeatable: false},
      {id: 'harvest', label: 'Harvest', points: 2, repeatable: true}
    ];
  }
  return [{id: 'discover', label: 'Discover', points: 1, repeatable: false}];
}

const toBiomeKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'zone';

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

  const [entryName, setEntryName] = useState('');
  const [entryDomain, setEntryDomain] = useState<CompendiumDomain>('beast');
  const [entityToImportId, setEntityToImportId] = useState('');
  const [importDomain, setImportDomain] = useState<CompendiumDomain>('beast');
  const [importMechanicKind, setImportMechanicKind] =
    useState<CompendiumMechanicKind>('discovery');
  const [importProgressScope, setImportProgressScope] =
    useState<MechanicsProgressScope>('character');

  const [recipeName, setRecipeName] = useState('');
  const [recipeCategory, setRecipeCategory] =
    useState<UnlockableRecipe['category']>('food');
  const [recipeMinLevel, setRecipeMinLevel] = useState<number>(1);
  const [recipeRequiredMilestones, setRecipeRequiredMilestones] = useState('');

  const [milestoneName, setMilestoneName] = useState('');
  const [milestonePoints, setMilestonePoints] = useState(10);
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneRecipeIds, setMilestoneRecipeIds] = useState('');
  const [previewLevel, setPreviewLevel] = useState(1);
  const [previewMaterialsText, setPreviewMaterialsText] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneKey, setZoneKey] = useState('');
  const [zoneMaxPoints, setZoneMaxPoints] = useState(100);
  const [zoneSourceEntityId, setZoneSourceEntityId] = useState('');
  const [zoneProgressScope, setZoneProgressScope] =
    useState<MechanicsProgressScope>('character');
  const [selectedZoneKey, setSelectedZoneKey] = useState('');
  const [zoneExposureMinutes, setZoneExposureMinutes] = useState(10);
  const [isRecordingZone, setIsRecordingZone] = useState(false);
  const [selectedSettlementLocationId, setSelectedSettlementLocationId] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [moduleSourceType, setModuleSourceType] =
    useState<SettlementModule['sourceType']>('trophy');
  const [moduleTargetType, setModuleTargetType] =
    useState<SettlementModule['effects'][number]['targetType']>('resistance');
  const [moduleTargetId, setModuleTargetId] = useState('poison');
  const [moduleOperation, setModuleOperation] =
    useState<SettlementModule['effects'][number]['operation']>('add');
  const [moduleValue, setModuleValue] = useState('5');
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [isSavingFortress, setIsSavingFortress] = useState(false);
  const [baseStatsDraft, setBaseStatsDraft] = useState<Record<BaseStatKey, string>>({
    defense: '10',
    storageCapacity: '100',
    craftingThroughput: '100',
    morale: '50'
  });

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

  useEffect(() => {
    if (!activeProject) {
      setEntries([]);
      setMilestones([]);
      setRecipes([]);
      setZoneProfiles([]);
      setZoneProgress([]);
      setSettlementState(null);
      setSettlementModules([]);
      setSelectedSettlementLocationId('');
      setProgress(null);
      setLogs([]);
      setGlobalLogs([]);
      setWorldEntities([]);
      setCharacters([]);
      setCharacterSheets([]);
      setActivePartyCharacterIds([]);
      setActiveMechanicsCharacterSheetId('');
      setRuleset(null);
      setBaseStatsDraft({
        defense: '10',
        storageCapacity: '100',
        craftingThroughput: '100',
        morale: '50'
      });
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
          error instanceof Error
            ? error.message
            : 'Unable to load compendium data.';
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
  }, [activeProject]);

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
          error instanceof Error ? error.message : 'Unable to load mechanics progress.';
        setFeedback({tone: 'error', message});
      });

    return () => {
      cancelled = true;
    };
  }, [activeMechanicsCharacterSheetId, activeProject]);

  useEffect(() => {
    if (!settlementState) return;
    setBaseStatsDraft(toBaseStatsDraft(settlementState.baseStats));
  }, [settlementState]);
  useEffect(() => {
    if (activeTab === 'world-systems' && !enableWorldSystems) {
      setActiveTab('overview');
    }
  }, [activeTab, enableWorldSystems]);

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
  }, [location.key, location.state]);

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
  const selectedZoneProfile =
    selectedZoneKey
      ? zoneProfiles.find((profile) => profile.biomeKey === selectedZoneKey) ?? null
      : null;
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
          error instanceof Error ? error.message : 'Unable to load settlement state.';
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
  const isBaseStatsDraftDirty = useMemo(() => {
    if (!settlementState) return false;
    return BASE_STAT_KEYS.some(
      (key) => baseStatsDraft[key] !== String(settlementState.baseStats[key])
    );
  }, [baseStatsDraft, settlementState]);
  const parsedPreviewMaterials = useMemo(() => {
    const result: Record<string, number> = {};
    for (const rawLine of previewMaterialsText.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const [itemIdRaw, qtyRaw] = line.split(':');
      const itemId = itemIdRaw?.trim();
      const qty = Number(qtyRaw?.trim() ?? '');
      if (!itemId || !Number.isFinite(qty) || qty < 0) {
        continue;
      }
      result[itemId] = qty;
    }
    return result;
  }, [previewMaterialsText]);
  const reviewEntries = useMemo(
    () => entries.filter((entry) => entry.needsCompletion),
    [entries]
  );

  const handleCreateEntry = async () => {
    if (!activeProject || !entryName.trim()) return;
    const now = Date.now();
    const next: CompendiumEntry = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: entryName.trim(),
      domain: entryDomain,
      needsCompletion: false,
      actions: getDefaultActions(entryDomain),
      createdAt: now,
      updatedAt: now
    };

    setFeedback(null);
    try {
      await saveCompendiumEntry(next);
      setEntries((prev) => [...prev, next].sort((a, b) => a.name.localeCompare(b.name)));
      setEntryName('');
      setFeedback({tone: 'success', message: 'Compendium entry created.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create entry.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleImportEntity = async () => {
    if (!activeProject || !entityToImportId) return;
    const entity = worldEntityById.get(entityToImportId);
    if (!entity) return;
    if (importProgressScope === 'character' && !activeMechanicsCharacterSheetId) {
      setFeedback({
        tone: 'error',
        message: 'Choose a character sheet before linking character-scoped mechanics.'
      });
      return;
    }
    setFeedback(null);
    try {
      const entry = await upsertCompendiumEntryFromEntity({
        projectId: activeProject.id,
        entity,
        domain: importDomain,
        defaultActions: getDefaultActions(importDomain),
        needsCompletion: entity.needsCompletion ?? false,
        mechanicKind: importMechanicKind,
        progressScope: importProgressScope
      });
      setEntries((prev) => {
        const idx = prev.findIndex((item) => item.id === entry.id);
        if (idx === -1) return [...prev, entry].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...prev];
        next[idx] = entry;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      if (importMechanicKind === 'zone') {
        const biomeKey = toBiomeKey(entity.name);
        const profile = await upsertZoneAffinityProfile({
          projectId: activeProject.id,
          biomeKey,
          name: entity.name,
          sourceEntityId: entity.id,
          progressScope: importProgressScope,
          maxAffinityPoints: 100,
          milestones: [
            {
              id: `${biomeKey}-25`,
              thresholdPercent: 25,
              name: '25% Affinity',
              description: 'Biome familiarity unlocked.'
            },
            {
              id: `${biomeKey}-50`,
              thresholdPercent: 50,
              name: '50% Affinity',
              description: 'Biome resistance unlocked.'
            },
            {
              id: `${biomeKey}-100`,
              thresholdPercent: 100,
              name: '100% Affinity',
              description: 'Biome mastery unlocked.'
            }
          ]
        });
        setZoneProfiles((prev) => {
          const idx = prev.findIndex((item) => item.id === profile.id);
          if (idx === -1) return [...prev, profile].sort((a, b) => a.name.localeCompare(b.name));
          const next = [...prev];
          next[idx] = profile;
          return next.sort((a, b) => a.name.localeCompare(b.name));
        });
        setSelectedZoneKey(profile.biomeKey);
        setShowAdvancedSetup(true);
        setActiveTab('world-systems');
        setFeedback({tone: 'success', message: 'Location linked as a zone profile.'});
        return;
      }
      if (importMechanicKind === 'settlement') {
        const nextState = await updateSettlementLocation({
          projectId: activeProject.id,
          sourceEntityId: entity.id,
          name: entity.name
        });
        setSelectedSettlementLocationId(entity.id);
        setSettlementState(nextState);
        setShowAdvancedSetup(true);
        setActiveTab('world-systems');
        setFeedback({tone: 'success', message: 'Location linked to settlement/community systems.'});
        return;
      }
      setFeedback({tone: 'success', message: 'World Bible entity linked to mechanics.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import entity.';
      setFeedback({tone: 'error', message});
    }
  };

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
        error instanceof Error ? error.message : 'Unable to update mechanics settings.';
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
        error instanceof Error ? error.message : 'Unable to update entry.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleCreateRecipe = async () => {
    if (!activeProject || !recipeName.trim()) return;
    const now = Date.now();
    const recipe: UnlockableRecipe = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: recipeName.trim(),
      category: recipeCategory,
      requirements: {
        minCharacterLevel: Math.max(1, Math.floor(recipeMinLevel)),
        requiredMilestoneIds: recipeRequiredMilestones
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      },
      createdAt: now,
      updatedAt: now
    };
    setFeedback(null);
    try {
      await saveUnlockableRecipe(recipe);
      setRecipes((prev) => [...prev, recipe].sort((a, b) => a.name.localeCompare(b.name)));
      setRecipeName('');
      setRecipeMinLevel(1);
      setRecipeRequiredMilestones('');
      setFeedback({tone: 'success', message: 'Unlockable recipe added.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save recipe.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleCreateMilestone = async () => {
    if (!activeProject || !milestoneName.trim()) return;
    const recipeIds = milestoneRecipeIds
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const milestone: CompendiumMilestone = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: milestoneName.trim(),
      description: milestoneDescription.trim() || undefined,
      pointsRequired: Math.max(0, Math.floor(milestonePoints)),
      unlockRecipeIds: recipeIds,
      permanentEffects: [],
      createdAt: Date.now()
    };
    setFeedback(null);
    try {
      await saveCompendiumMilestone(milestone);
      setMilestones((prev) =>
        [...prev, milestone].sort((a, b) => a.pointsRequired - b.pointsRequired)
      );
      setMilestoneName('');
      setMilestoneDescription('');
      setMilestonePoints(10);
      setMilestoneRecipeIds('');
      setFeedback({tone: 'success', message: 'Milestone added.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save milestone.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleCreateZoneProfile = async () => {
    if (!activeProject || !zoneName.trim() || !zoneKey.trim()) return;
    setFeedback(null);
    try {
      const profile = await upsertZoneAffinityProfile({
        projectId: activeProject.id,
        biomeKey: zoneKey.trim().toLowerCase(),
        name: zoneName.trim(),
        sourceEntityId: zoneSourceEntityId || undefined,
        progressScope: zoneProgressScope,
        maxAffinityPoints: Math.max(1, Math.floor(zoneMaxPoints)),
        milestones: [
          {
            id: `${zoneKey.trim().toLowerCase()}-25`,
            thresholdPercent: 25,
            name: '25% Affinity',
            description: 'Biome familiarity unlocked.'
          },
          {
            id: `${zoneKey.trim().toLowerCase()}-50`,
            thresholdPercent: 50,
            name: '50% Affinity',
            description: 'Biome resistance unlocked.'
          },
          {
            id: `${zoneKey.trim().toLowerCase()}-100`,
            thresholdPercent: 100,
            name: '100% Affinity',
            description: 'Biome mastery unlocked.'
          }
        ]
      });
      setZoneProfiles((prev) => {
        const idx = prev.findIndex((item) => item.id === profile.id);
        if (idx === -1) return [...prev, profile].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...prev];
        next[idx] = profile;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedZoneKey(profile.biomeKey);
      setZoneName('');
      setZoneKey('');
      setZoneMaxPoints(100);
      setZoneSourceEntityId('');
      setZoneProgressScope('character');
      setFeedback({tone: 'success', message: 'Zone affinity profile created.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create zone profile.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleRecordZoneExposure = async () => {
    if (!activeProject || !selectedZoneKey) return;
    if (
      selectedZoneProfile?.progressScope === 'character' &&
      !activeMechanicsCharacterSheetId
    ) {
      setFeedback({
        tone: 'error',
        message: 'Choose a character sheet before recording character-scoped zone exposure.'
      });
      return;
    }
    setIsRecordingZone(true);
    setFeedback(null);
    try {
      const result = await recordZoneExposure({
        projectId: activeProject.id,
        biomeKey: selectedZoneKey,
        exposureSeconds: Math.max(1, Math.floor(zoneExposureMinutes * 60)),
        characterSheetId:
          selectedZoneProfile?.progressScope === 'character'
            ? activeMechanicsCharacterSheetId || undefined
            : undefined
      });
      setZoneProgress((prev) => {
        const idx = prev.findIndex((item) => item.id === result.progress.id);
        if (idx === -1) return [...prev, result.progress].sort((a, b) => b.affinityPoints - a.affinityPoints);
        const next = [...prev];
        next[idx] = result.progress;
        return next.sort((a, b) => b.affinityPoints - a.affinityPoints);
      });
      if (result.unlockedMilestoneIds.length > 0) {
        setFeedback({
          tone: 'success',
          message: `Exposure recorded. Unlocked ${result.unlockedMilestoneIds.length} zone milestone(s).`
        });
      } else {
        setFeedback({tone: 'success', message: 'Zone exposure recorded.'});
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to record zone exposure.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsRecordingZone(false);
    }
  };

  const handleAddSettlementModule = async () => {
    if (!activeProject || !settlementState || !moduleName.trim()) return;
    setIsSavingModule(true);
    setFeedback(null);
    try {
      const parsedValue = Number(moduleValue);
      const normalizedValue =
        Number.isFinite(parsedValue) && moduleValue.trim() !== ''
          ? parsedValue
          : moduleValue;

      const module: SettlementModule = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        name: moduleName.trim(),
        sourceType: moduleSourceType,
        auraRadiusMeters: 30,
        active: true,
        effects: [
          {
            targetType: moduleTargetType,
            targetId: moduleTargetId.trim() || 'custom',
            operation: moduleOperation,
            value: normalizedValue
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await saveSettlementModule(module);
      const nextState = await attachModuleToSettlement({
        projectId: activeProject.id,
        moduleId: module.id,
        sourceEntityId: selectedSettlementLocationId || undefined
      });
      setSettlementModules((prev) =>
        [...prev, module].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSettlementState(nextState);
      setModuleName('');
      setModuleValue('5');
      setFeedback({tone: 'success', message: 'Settlement module added.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to add settlement module.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingModule(false);
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
        error instanceof Error ? error.message : 'Unable to record action.';
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

  const handleAdjustFortressLevel = async (delta: number) => {
    if (!activeProject || !settlementState) return;
    const nextLevel = Math.max(1, settlementState.fortressLevel + delta);
    setIsSavingFortress(true);
    setFeedback(null);
    try {
      const nextState = await updateSettlementFortressLevel({
        projectId: activeProject.id,
        level: nextLevel,
        sourceEntityId: selectedSettlementLocationId || undefined
      });
      setSettlementState(nextState);
      setFeedback({
        tone: 'success',
        message: `Settlement tier level set to ${nextState.fortressLevel}.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update settlement tier level.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingFortress(false);
    }
  };

  const handleBaseStatDraftChange = (statKey: BaseStatKey, value: string): void => {
    setBaseStatsDraft((prev) => ({
      ...prev,
      [statKey]: value
    }));
  };

  const handleResetBaseStatsDraft = (): void => {
    if (!settlementState) return;
    setBaseStatsDraft(toBaseStatsDraft(settlementState.baseStats));
  };

  const handleSaveBaseStats = async () => {
    if (!activeProject || !settlementState) return;
    const nextBaseStats: Partial<SettlementState['baseStats']> = {};
    for (const key of BASE_STAT_KEYS) {
      const parsed = Number(baseStatsDraft[key].trim());
      if (!Number.isFinite(parsed)) {
        setFeedback({
          tone: 'error',
          message: `Base stat "${key}" must be a valid number.`
        });
        return;
      }
      nextBaseStats[key] = clampBaseStatValue(key, parsed);
    }

    setIsSavingFortress(true);
    setFeedback(null);
    try {
      const nextState = await updateSettlementBaseStats({
        projectId: activeProject.id,
        baseStats: nextBaseStats,
        sourceEntityId: selectedSettlementLocationId || undefined
      });
      setSettlementState(nextState);
      setBaseStatsDraft(toBaseStatsDraft(nextState.baseStats));
      setFeedback({tone: 'success', message: 'Base stats saved.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update base stats.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSavingFortress(false);
    }
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

  return (
    <section>
      <h1>Mechanics</h1>
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.tone === 'error' ? 'var(--color-error-soft-border)' : 'var(--color-success-soft-border)'
            }`,
            backgroundColor:
              feedback.tone === 'error' ? 'var(--color-error-soft-bg)' : 'var(--color-success-soft-bg)',
            color: feedback.tone === 'error' ? 'var(--color-error)' : 'var(--color-success)'
          }}
        >
          {feedback.message}
        </p>
      )}
      <details
        style={{
          marginBottom: '1rem',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '0.7rem 0.85rem',
          backgroundColor: 'var(--color-bg-secondary)'
        }}
      >
        <summary style={{cursor: 'pointer', fontWeight: 600}}>
          Mechanics Setup Help
        </summary>
        <div style={{marginTop: '0.6rem', fontSize: '0.9rem', color: 'var(--color-text-primary)'}}>
          <p style={{margin: '0 0 0.4rem 0'}}>
            Step 1: link a world record only when it truly needs mechanics.
          </p>
          <p style={{margin: '0 0 0.4rem 0'}}>
            Step 2: stay in Entries for lightweight setup.
          </p>
          <p style={{margin: 0}}>
            Step 3: open advanced setup only when you need progression, recipes, zones, or simulation.
          </p>
        </div>
      </details>
      {!showAdvancedSetup && (
        <section
          style={{
            marginBottom: '0.85rem',
            padding: '0.85rem',
            border: '1px solid var(--color-accent-soft-bg)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-secondary)'
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap'}}>
            <div>
              <strong>Start Small</strong>
              <div style={{fontSize: '0.88rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem'}}>
                You only need the <strong>Entries</strong> tab right now unless this project truly needs progression or world simulation.
              </div>
            </div>
            <button type='button' onClick={() => setShowAdvancedSetup(true)}>
              Show advanced setup
            </button>
          </div>
        </section>
      )}
      <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem'}}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type='button'
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '999px',
              border:
                activeTab === tab.id
                  ? '1px solid var(--color-text-primary)'
                  : '1px solid var(--color-border)',
              backgroundColor:
                activeTab === tab.id
                  ? 'var(--color-bg-secondary)'
                  : 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem'}}>
        {currentTab.subtitle}
      </div>
      <section
        style={{
          marginBottom: '0.85rem',
          padding: '0.75rem 0.85rem',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          backgroundColor: 'var(--color-bg-secondary)'
        }}
      >
        <h2 style={{marginTop: 0, marginBottom: '0.45rem', fontSize: '1rem'}}>
          Next Steps For {currentTab.label}
        </h2>
        {activeTab !== 'overview' && activeTabTotalCount > 0 && (
          <p style={{marginTop: 0, marginBottom: '0.55rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
            Completed in this section: {activeTabDoneCount}/{activeTabTotalCount}
          </p>
        )}
        {compactNextSteps.length === 0 ? (
          <p style={{margin: 0, fontSize: '0.88rem', color: 'var(--color-text-primary)'}}>
            This section is in good shape. Move to another tab for additional setup.
          </p>
        ) : (
          <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
            {compactNextSteps.slice(0, 3).map((item) => (
              <li key={`tab-next-${item.id}`} style={{marginBottom: '0.35rem'}}>
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
      <div style={{display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
        <span
          style={{
            fontSize: '0.75rem',
            border: '1px solid var(--color-border)',
            borderRadius: '999px',
            padding: '0.15rem 0.45rem'
          }}
        >
          Game Systems: {enableGameSystems ? 'On' : 'Off'}
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            border: '1px solid var(--color-border)',
            borderRadius: '999px',
            padding: '0.15rem 0.45rem'
          }}
        >
          Runtime Modifiers: {enableRuntimeModifiers ? 'On' : 'Off'}
        </span>
      </div>
      {!showAdvancedSetup &&
        milestones.length === 0 &&
        recipes.length === 0 &&
        zoneProfiles.length === 0 &&
        settlementModules.length === 0 && (
          <p style={{marginTop: 0, marginBottom: '0.85rem', fontSize: '0.84rem', color: 'var(--color-text-secondary)'}}>
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
          activeMechanicsCharacterSheet={activeMechanicsCharacterSheet}
          activeMechanicsCharacterSheetId={activeMechanicsCharacterSheetId}
          characterSheets={characterSheets}
          completedActionSet={completedActionSet}
          editingMechanicsEntryId={editingMechanicsEntryId}
          entries={entries}
          entryDomain={entryDomain}
          entryName={entryName}
          entityToImportId={entityToImportId}
          globalCompletedActionSet={globalCompletedActionSet}
          handleCreateEntry={handleCreateEntry}
          handleImportEntity={handleImportEntity}
          handleMarkEntryComplete={handleMarkEntryComplete}
          handleOpenEntryMechanicsEditor={handleOpenEntryMechanicsEditor}
          handleRecordAction={handleRecordAction}
          handleUpdateEntryMechanics={handleUpdateEntryMechanics}
          highlightedEntryId={highlightedEntryId}
          importDomain={importDomain}
          importMechanicKind={importMechanicKind}
          importProgressScope={importProgressScope}
          isRecordingKey={isRecordingKey}
          navigate={navigate}
          quantityByActionKey={quantityByActionKey}
          reviewEntries={reviewEntries}
          ruleset={ruleset}
          setActiveMechanicsCharacterSheetId={setActiveMechanicsCharacterSheetId}
          setEditingMechanicsEntryId={setEditingMechanicsEntryId}
          setEntryDomain={setEntryDomain}
          setEntryName={setEntryName}
          setEntityToImportId={setEntityToImportId}
          setImportDomain={setImportDomain}
          setImportMechanicKind={setImportMechanicKind}
          setImportProgressScope={setImportProgressScope}
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
          craftingRuntimeModifiers={craftingRuntimeModifiers}
          handleCreateMilestone={handleCreateMilestone}
          handleCreateRecipe={handleCreateRecipe}
          milestoneDescription={milestoneDescription}
          milestoneName={milestoneName}
          milestonePoints={milestonePoints}
          milestoneRecipeIds={milestoneRecipeIds}
          milestones={milestones}
          parsedPreviewMaterials={parsedPreviewMaterials}
          previewLevel={previewLevel}
          previewMaterialsText={previewMaterialsText}
          progress={progress}
          recipeCategory={recipeCategory}
          recipeMinLevel={recipeMinLevel}
          recipeName={recipeName}
          recipeRequiredMilestones={recipeRequiredMilestones}
          recipes={recipes}
          setMilestoneDescription={setMilestoneDescription}
          setMilestoneName={setMilestoneName}
          setMilestonePoints={setMilestonePoints}
          setMilestoneRecipeIds={setMilestoneRecipeIds}
          setPreviewLevel={setPreviewLevel}
          setPreviewMaterialsText={setPreviewMaterialsText}
          setRecipeCategory={setRecipeCategory}
          setRecipeMinLevel={setRecipeMinLevel}
          setRecipeName={setRecipeName}
          setRecipeRequiredMilestones={setRecipeRequiredMilestones}
          unlockedMilestoneSet={unlockedMilestoneSet}
          unlockedRecipeSet={unlockedRecipeSet}
        />
      )}
      {currentTab.id === 'world-systems' && (
        <WorldSystemsTab
          activeMechanicsCharacterSheetId={activeMechanicsCharacterSheetId}
          activePartyCharacterIds={activePartyCharacterIds}
          activePartySynergies={activePartySynergies}
          activeSettlementEffects={activeSettlementEffects}
          baseStatsDraft={baseStatsDraft}
          characterById={characterById}
          characterSheets={characterSheets}
          characters={characters}
          enableWorldSystems={enableWorldSystems}
          handleAddSettlementModule={handleAddSettlementModule}
          handleAdjustFortressLevel={handleAdjustFortressLevel}
          handleBaseStatDraftChange={handleBaseStatDraftChange}
          handleCreateZoneProfile={handleCreateZoneProfile}
          handleRecordZoneExposure={handleRecordZoneExposure}
          handleResetBaseStatsDraft={handleResetBaseStatsDraft}
          handleSaveBaseStats={handleSaveBaseStats}
          isBaseStatsDraftDirty={isBaseStatsDraftDirty}
          isRecordingZone={isRecordingZone}
          isSavingFortress={isSavingFortress}
          isSavingModule={isSavingModule}
          moduleName={moduleName}
          moduleOperation={moduleOperation}
          moduleSourceType={moduleSourceType}
          moduleTargetId={moduleTargetId}
          moduleTargetType={moduleTargetType}
          moduleValue={moduleValue}
          nextFortressTier={nextFortressTier}
          rosterSynergyOpportunities={rosterSynergyOpportunities}
          selectedSettlementLocationId={selectedSettlementLocationId}
          selectedZoneKey={selectedZoneKey}
          setActiveMechanicsCharacterSheetId={setActiveMechanicsCharacterSheetId}
          setModuleName={setModuleName}
          setModuleOperation={setModuleOperation}
          setModuleSourceType={setModuleSourceType}
          setModuleTargetId={setModuleTargetId}
          setModuleTargetType={setModuleTargetType}
          setModuleValue={setModuleValue}
          setSelectedSettlementLocationId={setSelectedSettlementLocationId}
          setSelectedZoneKey={setSelectedZoneKey}
          setZoneExposureMinutes={setZoneExposureMinutes}
          setZoneKey={setZoneKey}
          setZoneMaxPoints={setZoneMaxPoints}
          setZoneName={setZoneName}
          setZoneProgressScope={setZoneProgressScope}
          setZoneSourceEntityId={setZoneSourceEntityId}
          settlementComputedEffects={settlementComputedEffects}
          settlementModules={settlementModules}
          settlementState={settlementState}
          togglePartyCharacter={togglePartyCharacter}
          unlockedFortressTiers={unlockedFortressTiers}
          worldEntities={worldEntities}
          worldEntityById={worldEntityById}
          zoneExposureMinutes={zoneExposureMinutes}
          zoneKey={zoneKey}
          zoneMaxPoints={zoneMaxPoints}
          zoneName={zoneName}
          zoneProfiles={zoneProfiles}
          zoneProgressByKey={zoneProgressByKey}
          zoneProgressScope={zoneProgressScope}
          zoneSourceEntityId={zoneSourceEntityId}
        />
      )}
    </section>
  );
}

export default CompendiumRoute;
