import {useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useAppStore} from '../store/appStore';
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
  PartySynergySuggestion,
  SettlementModule,
  SettlementState,
  UnlockableRecipe,
  WorldEntity,
  ZoneAffinityProfile,
  ZoneAffinityProgress
} from '../entityTypes';
import {
  DEFAULT_FORTRESS_TIERS,
  DEFAULT_PARTY_SYNERGY_RULES,
  canCraftRecipe,
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
  getZoneAffinityPercent,
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

// activeProject and projectSettings read from store below

const DOMAIN_OPTIONS: Array<{value: CompendiumDomain; label: string}> = [
  {value: 'beast', label: 'Beast'},
  {value: 'flora', label: 'Flora'},
  {value: 'mineral', label: 'Mineral'},
  {value: 'artifact', label: 'Artifact'},
  {value: 'recipe', label: 'Recipe'},
  {value: 'custom', label: 'Custom'}
];

const RECIPE_CATEGORY_OPTIONS: UnlockableRecipe['category'][] = [
  'food',
  'crafting',
  'alchemy',
  'custom'
];
const SETTLEMENT_SOURCE_OPTIONS: SettlementModule['sourceType'][] = [
  'trophy',
  'structure',
  'station',
  'totem',
  'custom'
];
const SETTLEMENT_EFFECT_TARGET_OPTIONS: SettlementModule['effects'][number]['targetType'][] = [
  'resistance',
  'stat',
  'resource',
  'custom'
];
const SETTLEMENT_EFFECT_OPERATION_OPTIONS: SettlementModule['effects'][number]['operation'][] = [
  'add',
  'multiply',
  'set'
];
const MECHANICS_SCOPE_OPTIONS: Array<{
  value: MechanicsProgressScope;
  label: string;
}> = [
  {value: 'character', label: 'Per character'},
  {value: 'global', label: 'Shared / global'}
];
const MECHANIC_KIND_OPTIONS: Array<{
  value: CompendiumMechanicKind;
  label: string;
}> = [
  {value: 'discovery', label: 'Discovery'},
  {value: 'zone', label: 'Zone'},
  {value: 'settlement', label: 'Settlement'},
  {value: 'general', label: 'General'}
];
type BaseStatKey = keyof NonNullable<SettlementState['baseStats']>;
type CompendiumTab = 'overview' | 'entries' | 'progression' | 'world-systems';

const COMPENDIUM_TABS: Array<{
  id: CompendiumTab;
  label: string;
  subtitle: string;
  advanced?: boolean;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'Start here: current progression status and next actions.'
  },
  {
    id: 'entries',
    label: 'Entries',
    subtitle: 'Create/import mechanics entries and record progression actions.'
  },
  {
    id: 'progression',
    label: 'Progression',
    subtitle: 'Manage milestones, recipes, and craftability checks.'
  },
  {
    id: 'world-systems',
    label: 'World Systems',
    subtitle: 'Advanced systems: zone, settlement, and party synergy.',
    advanced: true
  }
];

const BASE_STAT_KEYS: BaseStatKey[] = [
  'defense',
  'storageCapacity',
  'craftingThroughput',
  'morale'
];
const BASE_STAT_LIMITS: Record<BaseStatKey, {min: number; max: number}> = {
  defense: {min: 0, max: 100000},
  storageCapacity: {min: 0, max: 100000},
  craftingThroughput: {min: 0, max: 100000},
  morale: {min: 0, max: 100000}
};

function formatSettlementEffectLabel(
  effect: SettlementModule['effects'][number]
): string {
  const opText =
    effect.operation === 'add'
      ? '+'
      : effect.operation === 'multiply'
        ? 'x'
        : '=';
  return `${effect.targetType}:${effect.targetId} ${opText}${String(effect.value)}`;
}

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

function getCharacterRole(character: Character): string {
  return String(character.fields.role ?? '').trim();
}

function formatSynergyStatus(
  suggestion: PartySynergySuggestion,
  characterById: Map<string, Character>
): string {
  const matchedNames = suggestion.matchedCharacterIds
    .map((id) => characterById.get(id)?.name)
    .filter(Boolean)
    .join(', ');
  if (suggestion.missingRoles.length === 0) {
    return matchedNames ? `Active via ${matchedNames}.` : 'Active.';
  }
  const missing = suggestion.missingRoles.join(', ');
  return matchedNames
    ? `Need ${missing}. Current: ${matchedNames}.`
    : `Need ${missing}.`;
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
      getCharacterSheetsByProject(activeProject.id)
    ])
      .then(([loadedEntries, loadedMilestones, loadedRecipes, loadedZoneProfiles, loadedZoneProgress, loadedSettlementState, loadedSettlementModules, loadedGlobalLogs, loadedEntities, loadedCharacters, loadedCharacterSheets]) => {
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
    updates: Partial<Pick<CompendiumEntry, 'mechanicKind' | 'progressScope'>>
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
  const nextStepItems: Array<{
    id: string;
    done: boolean;
    label: string;
    tab: CompendiumTab;
  }> = [
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

  const CompendiumOverviewSection = () => {
    return (
      <>
        <p style={{marginTop: 0, marginBottom: '0.9rem', color: 'var(--color-text-secondary)'}}>
          Use this snapshot to see progress at a glance, then jump into the next
          task without scanning every advanced system.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}
        >
          <article style={{padding: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
            <h3 style={{marginTop: 0, marginBottom: '0.45rem'}}>Total Points</h3>
            <div style={{fontSize: '1.1rem', fontWeight: 700}}>
              {isLoading || !progress ? '...' : progress.totalPoints}
            </div>
          </article>
          <article style={{padding: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
            <h3 style={{marginTop: 0, marginBottom: '0.45rem'}}>Milestones Unlocked</h3>
            <div style={{fontSize: '1.1rem', fontWeight: 700}}>
              {isLoading || !progress ? '...' : progress.unlockedMilestoneIds.length}
            </div>
          </article>
          <article style={{padding: '0.85rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
            <h3 style={{marginTop: 0, marginBottom: '0.45rem'}}>Recipes Unlocked</h3>
            <div style={{fontSize: '1.1rem', fontWeight: 700}}>
              {isLoading || !progress ? '...' : progress.unlockedRecipeIds.length}
            </div>
          </article>
        </div>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '1rem'}}>
          <h2 style={{marginTop: 0}}>What To Do Next</h2>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {nextStepItems.map((step) => (
              <li key={step.id} style={{marginBottom: '0.45rem'}}>
                {step.done ? 'Done' : 'Next'}: {step.label}{' '}
                {!step.done && (
                  <button
                    type='button'
                    onClick={() => openTabWithSmartDefaults(step.tab, step.id)}
                  >
                    Open {COMPENDIUM_TABS.find((tab) => tab.id === step.tab)?.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Recent Actions</h2>
          {logs.length === 0 ? (
            <>
              <p style={{marginBottom: '0.65rem'}}>No actions logged yet.</p>
              <button
                type='button'
                onClick={() => openTabWithSmartDefaults('entries', 'log-action')}
              >
                Go to Entries to log your first action
              </button>
            </>
          ) : (
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              {logs.slice(0, 12).map((log) => (
                <li key={log.id} style={{marginBottom: '0.35rem'}}>
                  {(() => {
                    const entry = entryById.get(log.entryId);
                    const actionLabel =
                      entry?.actions.find((action) => action.id === log.actionId)
                        ?.label ?? log.actionId;
                    const entryLabel = entry?.name ?? log.entryId;
                    return (
                      <>
                        +{log.pointsAwarded} pts · {entryLabel} · {actionLabel} ·{' '}
                        {new Date(log.createdAt).toLocaleString()}
                      </>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    );
  };

  const CompendiumEntriesSection = () => (
    <>
      <p style={{marginTop: 0, marginBottom: '0.9rem', color: 'var(--color-text-secondary)'}}>
        Create new mechanics records or import from World Bible, then log actions
        from each entry card.
      </p>
      <section
        style={{
          marginBottom: '1rem',
          padding: '0.85rem',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          backgroundColor: 'var(--color-bg-secondary)'
        }}
      >
        <strong>Discovery Scope</strong>
        <div style={{fontSize: '0.84rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', marginBottom: '0.55rem'}}>
          Character-scoped discovery and progression use the selected actor below.
        </div>
        <label style={{display: 'block', maxWidth: '320px'}}>
          Active character sheet
          <select
            value={activeMechanicsCharacterSheetId}
            onChange={(e) => setActiveMechanicsCharacterSheetId(e.target.value)}
            style={{width: '100%'}}
          >
            <option value=''>No character selected</option>
            {characterSheets.map((sheet) => (
              <option key={sheet.id} value={sheet.id}>
                {sheet.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}
      >
        <article style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Add Entry</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Use this for custom creatures, resources, or artifacts not yet in the
            World Bible.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Name
            <input
              type='text'
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Domain
            <select
              value={entryDomain}
              onChange={(e) => setEntryDomain(e.target.value as CompendiumDomain)}
              style={{width: '100%'}}
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type='button' onClick={() => void handleCreateEntry()}>
            Create Entry
          </button>
        </article>

        <article style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Import from World Bible</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Best for existing entities so names stay aligned across tools. Choose what kind of mechanics this record should gain.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Entity
            <select
              value={entityToImportId}
              onChange={(e) => setEntityToImportId(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>Select an entity</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Mechanics type
            <select
              value={importMechanicKind}
              onChange={(e) =>
                setImportMechanicKind(e.target.value as CompendiumMechanicKind)
              }
              style={{width: '100%'}}
            >
              {MECHANIC_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {importMechanicKind !== 'settlement' && (
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Progress scope
              <select
                value={importProgressScope === 'party' ? 'global' : importProgressScope}
                onChange={(e) =>
                  setImportProgressScope(e.target.value as MechanicsProgressScope)
                }
                style={{width: '100%'}}
              >
                {MECHANICS_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {importProgressScope === 'character' && importMechanicKind !== 'settlement' && (
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Active character sheet
              <select
                value={activeMechanicsCharacterSheetId}
                onChange={(e) => setActiveMechanicsCharacterSheetId(e.target.value)}
                style={{width: '100%'}}
              >
                <option value=''>No character selected</option>
                {characterSheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Domain
            <select
              value={importDomain}
              onChange={(e) => setImportDomain(e.target.value as CompendiumDomain)}
              style={{width: '100%'}}
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type='button'
            onClick={() => void handleImportEntity()}
            disabled={!entityToImportId}
          >
            Link Mechanics
          </button>
        </article>
      </div>

      <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
        <h2 style={{marginTop: 0}}>Entries</h2>
        {reviewEntries.length > 0 && (
          <div
            style={{
              marginBottom: '0.85rem',
              padding: '0.85rem',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-secondary)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '0.75rem',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong>Review Queue</strong>
                <div style={{fontSize: '0.84rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem'}}>
                  Finish imported or placeholder entries before treating mechanics as
                  complete.
                </div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}
              >
                {reviewEntries.length} open
              </span>
            </div>
            <div style={{display: 'grid', gap: '0.6rem', marginTop: '0.75rem'}}>
              {reviewEntries.slice(0, 8).map((entry) => (
                <div
                  key={`review-${entry.id}`}
                  style={{
                    border: '1px solid var(--color-bg-tertiary)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-primary)',
                    padding: '0.7rem'
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', gap: '0.5rem'}}>
                    <strong>{entry.name}</strong>
                    <span style={{fontSize: '0.78rem', color: 'var(--color-text-secondary)'}}>[{entry.domain}]</span>
                  </div>
                  <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '0.35rem'}}>
                    {entry.sourceEntityId
                      ? 'Linked from World Bible. Add or adjust the optional mechanics details, then mark complete when ready.'
                      : 'Created directly in mechanics. Fill out the entry intent and mark complete when ready.'}
                  </div>
                  <div style={{display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.6rem'}}>
                    {entry.sourceEntityId && (
                      <button
                        type='button'
                        onClick={() =>
                          navigate('/world-bible', {state: {focusEntityId: entry.sourceEntityId}})
                        }
                      >
                        Open source record
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => void handleMarkEntryComplete(entry)}
                    >
                      Mark complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {entries.length === 0 && (
          <div
            style={{
              marginBottom: '0.85rem',
              padding: '0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-secondary)'
            }}
          >
            <p style={{marginTop: 0, marginBottom: '0.6rem'}}>
              No mechanics entries yet.
            </p>
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              <button
                type='button'
                onClick={() => {
                  if (!entryName.trim()) setEntryName('First Entry');
                }}
              >
                Create your first entry
              </button>
              <button
                type='button'
                onClick={() => {
                  if (!entityToImportId && worldEntities.length > 0) {
                    setEntityToImportId(worldEntities[0].id);
                  }
                }}
                disabled={worldEntities.length === 0}
              >
                Link your first World Bible record
              </button>
            </div>
          </div>
        )}
        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
          {entries.map((entry) => {
            const sourceEntity = entry.sourceEntityId
              ? worldEntityById.get(entry.sourceEntityId) ?? null
              : null;
            const linkedZoneProfile = entry.sourceEntityId
              ? zoneProfileBySourceEntityId.get(entry.sourceEntityId) ?? null
              : null;
            const isLinkedSettlement =
              Boolean(entry.sourceEntityId) &&
              settlementState?.sourceEntityId === entry.sourceEntityId;
            return (
            <li
              key={entry.id}
              id={`compendium-entry-${entry.id}`}
              style={{
                border:
                  highlightedEntryId === entry.id
                    ? '1px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '0.75rem',
                backgroundColor:
                  highlightedEntryId === entry.id ? 'var(--color-accent-soft-bg)' : 'transparent',
                boxShadow:
                  highlightedEntryId === entry.id
                    ? '0 0 0 1px color-mix(in oklab, var(--color-accent) 10%, transparent)'
                    : 'none'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <strong>{entry.name}</strong>
                <span style={{fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>[{entry.domain}]</span>
                {entry.needsCompletion && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.18rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: 'var(--color-warning-soft-bg)',
                      border: '1px solid var(--color-warning-soft-border)',
                      color: 'var(--color-warning)',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    Needs completion
                  </span>
                )}
              </div>
              {entry.sourceEntityId && (
                <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                  Linked to World Bible entity
                </div>
              )}
              {entry.sourceEntityId && (
                <div
                  style={{
                    marginTop: '0.55rem',
                    marginBottom: '0.55rem',
                    padding: '0.75rem',
                    border: '1px solid var(--color-accent-soft-bg)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-secondary)'
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap'}}>
                    <div>
                      <strong>Location Mechanics Summary</strong>
                      <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem'}}>
                        {sourceEntity?.name ?? entry.name}
                        {' · '}
                        {entry.mechanicKind === 'zone'
                          ? 'Zone-linked'
                          : entry.mechanicKind === 'settlement'
                            ? 'Settlement-linked'
                            : entry.mechanicKind === 'discovery'
                              ? 'Discovery-tracked'
                              : 'General mechanics'}
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '0.45rem', flexWrap: 'wrap'}}>
                      <button
                        type='button'
                        onClick={() =>
                          setEditingMechanicsEntryId((current) =>
                            current === entry.id ? null : entry.id
                          )
                        }
                      >
                        {editingMechanicsEntryId === entry.id
                          ? 'Hide Mechanics Settings'
                          : 'Edit Mechanics'}
                      </button>
                      <button
                        type='button'
                        onClick={() => void handleOpenEntryMechanicsEditor(entry)}
                      >
                        {entry.mechanicKind === 'zone'
                          ? linkedZoneProfile
                            ? 'Open Zone Editor'
                            : 'Create Zone Link'
                          : entry.mechanicKind === 'settlement'
                            ? 'Open Settlement Editor'
                            : 'Open Mechanics'}
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          navigate('/world-bible', {
                            state: {focusEntityId: entry.sourceEntityId}
                          })
                        }
                      >
                        Open World Record
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.5rem',
                      marginTop: '0.65rem',
                      fontSize: '0.82rem',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    <div>
                      <strong>Scope:</strong>{' '}
                      {entry.progressScope === 'character'
                        ? activeMechanicsCharacterSheet?.name
                          ? `Per character (${activeMechanicsCharacterSheet.name})`
                          : 'Per character'
                        : 'Shared / global'}
                    </div>
                    <div>
                      <strong>Zone:</strong>{' '}
                      {linkedZoneProfile
                        ? `${linkedZoneProfile.name} (${linkedZoneProfile.progressScope ?? 'character'})`
                        : 'Not linked'}
                    </div>
                    <div>
                      <strong>Settlement:</strong>{' '}
                      {isLinkedSettlement
                        ? settlementLocationName ?? 'Linked'
                        : 'Not linked'}
                    </div>
                  </div>
                </div>
              )}
              {editingMechanicsEntryId === entry.id && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.5rem',
                    marginTop: '0.55rem',
                    marginBottom: '0.55rem',
                    padding: '0.75rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-secondary)'
                  }}
                >
                  <label style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                    Mechanics type
                    <select
                      value={entry.mechanicKind ?? 'discovery'}
                      onChange={(e) =>
                        void handleUpdateEntryMechanics(entry, {
                          mechanicKind: e.target.value as CompendiumEntry['mechanicKind']
                        })
                      }
                      style={{width: '100%'}}
                    >
                      <option value='discovery'>Discovery</option>
                      <option value='zone'>Zone</option>
                      <option value='settlement'>Settlement</option>
                      <option value='general'>General</option>
                    </select>
                  </label>
                  <label style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                    Progress scope
                    <select
                      value={
                        entry.progressScope === 'party'
                          ? 'global'
                          : entry.progressScope ?? 'character'
                      }
                      onChange={(e) =>
                        void handleUpdateEntryMechanics(entry, {
                          progressScope: e.target.value as MechanicsProgressScope
                        })
                      }
                      style={{width: '100%'}}
                    >
                      {MECHANICS_SCOPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {entry.progressScope === 'character' && (
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)', gridColumn: '1 / -1'}}>
                      Recording for:{' '}
                      {activeMechanicsCharacterSheet?.name ?? 'No character sheet selected'}
                    </div>
                  )}
                </div>
              )}
              {entry.needsCompletion && (
                <div style={{marginTop: '0.5rem'}}>
                  <button
                    type='button'
                    onClick={() => void handleMarkEntryComplete(entry)}
                  >
                    Mark complete
                  </button>
                </div>
              )}
              <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                {entry.actions.map((action) => {
                  const key = `${entry.id}:${action.id}`;
                  const alreadyDone =
                    entry.progressScope === 'character'
                      ? completedActionSet.has(key)
                      : globalCompletedActionSet.has(key);
                  const disabled =
                    isRecordingKey === key || (!action.repeatable && alreadyDone);
                  const quantity = Math.max(1, Math.floor(quantityByActionKey[key] || 1));
                  return (
                    <div key={key} style={{display: 'flex', alignItems: 'center', gap: '0.35rem'}}>
                      {action.repeatable && (
                        <input
                          type='number'
                          min={1}
                          value={quantity}
                          onChange={(e) =>
                            setQuantityByActionKey((prev) => ({
                              ...prev,
                              [key]: Number(e.target.value)
                            }))
                          }
                          style={{width: '58px'}}
                        />
                      )}
                      <button
                        type='button'
                        onClick={() => void handleRecordAction(entry, action)}
                        disabled={disabled}
                      >
                        {isRecordingKey === key
                          ? 'Logging...'
                          : !action.repeatable && alreadyDone
                            ? `${action.label} complete`
                            : `${action.label} (+${action.points * quantity})`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </li>
            );
          })}
        </ul>
      </section>
    </>
  );

  const CompendiumProgressionSection = () => (
    <>
      <p style={{marginTop: 0, marginBottom: '0.9rem', color: 'var(--color-text-secondary)'}}>
        Define unlock rules first, then validate craftability using current
        progression and runtime modifiers.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1rem',
          alignItems: 'start'
        }}
      >
      <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
        <h2 style={{marginTop: 0}}>Recipes</h2>
        <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
          Recipes define what can be unlocked and what requirements must be met.
        </p>
        <label style={{display: 'block', marginBottom: '0.5rem'}}>
          Name
          <input
            type='text'
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            style={{width: '100%'}}
          />
        </label>
        <label style={{display: 'block', marginBottom: '0.75rem'}}>
          Category
          <select
            value={recipeCategory}
            onChange={(e) =>
              setRecipeCategory(e.target.value as UnlockableRecipe['category'])
            }
            style={{width: '100%'}}
          >
            {RECIPE_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label style={{display: 'block', marginBottom: '0.5rem'}}>
          Min Character Level
          <input
            type='number'
            min={1}
            value={recipeMinLevel}
            onChange={(e) => setRecipeMinLevel(Number(e.target.value))}
            style={{width: '100%'}}
          />
        </label>
        <label style={{display: 'block', marginBottom: '0.75rem'}}>
          Required Milestone IDs (comma-separated)
          <input
            type='text'
            value={recipeRequiredMilestones}
            onChange={(e) => setRecipeRequiredMilestones(e.target.value)}
            style={{width: '100%'}}
          />
        </label>
        <button type='button' onClick={() => void handleCreateRecipe()}>
          Add Recipe
        </button>
        {recipes.length === 0 && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-secondary)'
            }}
          >
            <p style={{marginTop: 0, marginBottom: '0.5rem'}}>
              No recipes yet. Create one to test unlock and craftability flow.
            </p>
            <button
              type='button'
              onClick={() => {
                if (!recipeName.trim()) setRecipeName('First Recipe');
              }}
            >
              Create a starter recipe
            </button>
          </div>
        )}
        <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
          {recipes.map((recipe) => (
            <li key={recipe.id} style={{marginBottom: '0.35rem'}}>
              {unlockedRecipeSet.has(recipe.id) ? 'Unlocked' : 'Locked'}: {recipe.name}
              {recipe.requirements?.minCharacterLevel ? (
                <> (lvl {recipe.requirements.minCharacterLevel}+)</>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <div style={{display: 'grid', gap: '1rem'}}>
        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Milestones</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Milestones convert point totals into explicit progression beats.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Name
            <input
              type='text'
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Points Required
            <input
              type='number'
              min={0}
              value={milestonePoints}
              onChange={(e) => setMilestonePoints(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Description
            <input
              type='text'
              value={milestoneDescription}
              onChange={(e) => setMilestoneDescription(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Unlock Recipe IDs (comma-separated)
            <input
              type='text'
              value={milestoneRecipeIds}
              onChange={(e) => setMilestoneRecipeIds(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <button type='button' onClick={() => void handleCreateMilestone()}>
            Add Milestone
          </button>
          {milestones.length === 0 && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.65rem',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-secondary)'
              }}
            >
              <p style={{marginTop: 0, marginBottom: '0.5rem'}}>
                No milestones yet. Add a threshold to make progression visible.
              </p>
              <button
                type='button'
                onClick={() => {
                  if (!milestoneName.trim()) setMilestoneName('First Milestone');
                }}
              >
                Create a milestone threshold
              </button>
            </div>
          )}
          <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
            {milestones.map((milestone) => (
              <li key={milestone.id} style={{marginBottom: '0.35rem'}}>
                {unlockedMilestoneSet.has(milestone.id) ? 'Unlocked' : 'Locked'}:{' '}
                {milestone.name} ({milestone.pointsRequired} pts)
              </li>
            ))}
          </ul>
        </section>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Craftability Preview</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Check if recipes are craftable for a sample character and material loadout.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Character Level
            <input
              type='number'
              min={1}
              value={previewLevel}
              onChange={(e) => setPreviewLevel(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Materials (one per line: <code>itemId:quantity</code>)
            <textarea
              rows={5}
              value={previewMaterialsText}
              onChange={(e) => setPreviewMaterialsText(e.target.value)}
              placeholder={'wolf_pelt:4\niron_ore:12'}
              style={{width: '100%'}}
            />
          </label>
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--color-text-secondary)',
              marginBottom: '0.65rem',
              padding: '0.5rem',
              border: '1px solid var(--color-border)',
              borderRadius: '6px'
            }}
          >
            Runtime modifiers: +{craftingRuntimeModifiers.levelBonus} effective level,
            material cost x{craftingRuntimeModifiers.materialCostMultiplier.toFixed(2)}
            {craftingRuntimeModifiers.notes.length > 0 && (
              <div style={{marginTop: '0.3rem'}}>
                {craftingRuntimeModifiers.notes.join(' ')}
              </div>
            )}
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {recipes.map((recipe) => {
              const check = canCraftRecipe(recipe, {
                progress,
                characterLevel: Math.max(1, Math.floor(previewLevel || 1)),
                availableMaterials: parsedPreviewMaterials,
                runtime: craftingRuntimeModifiers
              });
              return (
                <li
                  key={`preview-${recipe.id}`}
                  style={{
                    marginBottom: '0.5rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--color-border)'
                  }}
                >
                  <strong>{recipe.name}</strong>{' '}
                  <span
                    style={{
                      color: check.craftable ? 'var(--color-success)' : 'var(--color-error)'
                    }}
                  >
                    {check.craftable ? 'craftable' : 'not craftable'}
                  </span>
                  <div style={{fontSize: '0.78rem', color: 'var(--color-text-secondary)'}}>
                    Effective level: {check.effectiveCharacterLevel}
                    {' · '}Material multiplier: x{check.materialCostMultiplier.toFixed(2)}
                  </div>
                  {!check.craftable && check.reasons.length > 0 && (
                    <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                      {check.reasons.join(' ')}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      </div>
    </>
  );

  const CompendiumWorldSystemsSection = () => {
    if (!enableWorldSystems) {
      return (
        <section
          style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}
        >
          <p style={{margin: 0, color: 'var(--color-text-secondary)'}}>
            Settlement and zone systems are hidden for this project. Enable
            <strong> Settlement/Zone Systems</strong> in Settings to access them.
          </p>
        </section>
      );
    }

    return (
      <div style={{display: 'grid', gap: '1rem'}}>
        <p style={{marginTop: 0, marginBottom: 0, color: 'var(--color-text-secondary)'}}>
          Advanced systems are optional. Enable and tune only when you need
          simulation depth for progression balancing.
        </p>
        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Zone Affinity</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Track zone exposure and unlock biome-specific milestones over time.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Linked location
            <select
              value={zoneSourceEntityId}
              onChange={(e) => setZoneSourceEntityId(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>No linked location</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Progress scope
            <select
              value={zoneProgressScope === 'party' ? 'global' : zoneProgressScope}
              onChange={(e) =>
                setZoneProgressScope(e.target.value as MechanicsProgressScope)
              }
              style={{width: '100%'}}
            >
              {MECHANICS_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {zoneProgressScope === 'character' && (
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Active character sheet
              <select
                value={activeMechanicsCharacterSheetId}
                onChange={(e) => setActiveMechanicsCharacterSheetId(e.target.value)}
                style={{width: '100%'}}
              >
                <option value=''>No character selected</option>
                {characterSheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Zone Name
            <input
              type='text'
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder='Bee Cave'
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Zone Key
            <input
              type='text'
              value={zoneKey}
              onChange={(e) => setZoneKey(e.target.value)}
              placeholder='bee_cave'
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Max Affinity Points
            <input
              type='number'
              min={1}
              value={zoneMaxPoints}
              onChange={(e) => setZoneMaxPoints(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <button type='button' onClick={() => void handleCreateZoneProfile()}>
            Add Zone Profile
          </button>
          {zoneProfiles.length === 0 && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.65rem',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-secondary)'
              }}
            >
              <p style={{marginTop: 0, marginBottom: '0.5rem'}}>
                No zone profiles yet.
              </p>
              <button
                type='button'
                onClick={() => {
                  if (!zoneName.trim()) setZoneName('Starter Zone');
                  if (!zoneKey.trim()) setZoneKey('starter_zone');
                }}
              >
                Create your first zone profile
              </button>
            </div>
          )}
          <hr style={{margin: '0.9rem 0'}} />
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Active Zone
            <select
              value={selectedZoneKey}
              onChange={(e) => setSelectedZoneKey(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>Select zone</option>
              {zoneProfiles.map((profile) => (
                <option key={profile.id} value={profile.biomeKey}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Exposure Minutes
            <input
              type='number'
              min={1}
              value={zoneExposureMinutes}
              onChange={(e) => setZoneExposureMinutes(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <button
            type='button'
            onClick={() => void handleRecordZoneExposure()}
            disabled={!selectedZoneKey || isRecordingZone}
          >
            {isRecordingZone ? 'Recording...' : 'Record Exposure'}
          </button>
          <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
            {zoneProfiles.map((profile) => {
              const progressKey = `${profile.biomeKey}:${
                profile.progressScope === 'character'
                  ? activeMechanicsCharacterSheetId || 'global'
                  : 'global'
              }`;
              const progressItem = zoneProgressByKey.get(progressKey) ?? {
                id: '',
                projectId: profile.projectId,
                biomeKey: profile.biomeKey,
                characterSheetId:
                  profile.progressScope === 'character'
                    ? activeMechanicsCharacterSheetId || undefined
                    : undefined,
                affinityPoints: 0,
                totalExposureSeconds: 0,
                unlockedMilestoneIds: [],
                updatedAt: profile.updatedAt
              };
              const percent = getZoneAffinityPercent(progressItem, profile);
              const unlocked = new Set(progressItem.unlockedMilestoneIds);
              return (
                <li
                  key={`zone-${profile.id}`}
                  style={{
                    marginBottom: '0.65rem',
                    paddingBottom: '0.55rem',
                    borderBottom: '1px solid var(--color-border)'
                  }}
                >
                  <strong>{profile.name}</strong> ({percent.toFixed(1)}%)
                  {profile.sourceEntityId && (
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      Linked location:{' '}
                      {worldEntityById.get(profile.sourceEntityId)?.name ?? profile.sourceEntityId}
                    </div>
                  )}
                  <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                    Scope: {profile.progressScope ?? 'character'}
                    {' · '}
                    Exposure: {(progressItem.totalExposureSeconds / 60).toFixed(1)} minutes
                  </div>
                  <div style={{fontSize: '0.82rem'}}>
                    {profile.milestones.map((milestone) => (
                      <div key={milestone.id}>
                        {unlocked.has(milestone.id) ? 'Unlocked' : 'Locked'}{' '}
                        {milestone.thresholdPercent}%: {milestone.name}
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Community / Logistics</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Shared party synergy buffs driven by role combinations. Select the
            currently active party to preview concrete in-scene combo effects.
          </p>
          <div style={{fontSize: '0.85rem', marginBottom: '0.5rem'}}>
            <strong>Active Party Members</strong>
          </div>
          <div style={{display: 'grid', gap: '0.35rem', marginBottom: '0.8rem'}}>
            {characters.length === 0 ? (
              <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No characters yet. Add role-tagged characters to enable synergy.
              </div>
            ) : (
              characters.map((character) => (
                <label
                  key={character.id}
                  style={{display: 'flex', alignItems: 'center', gap: '0.45rem'}}
                >
                  <input
                    type='checkbox'
                    checked={activePartyCharacterIds.includes(character.id)}
                    onChange={() => togglePartyCharacter(character.id)}
                  />
                  <span>
                    {character.name}
                    <span style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      {' '}
                      ({getCharacterRole(character) || 'no role'})
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.45rem'}}>
            <strong>Active Combo Buffs</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, marginTop: 0}}>
            {activePartySynergies.filter((item) => item.missingRoles.length === 0).length ===
            0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No active combos for the current party selection.
              </li>
            ) : (
              activePartySynergies
                .filter((item) => item.missingRoles.length === 0)
                .map((suggestion) => (
                  <li key={suggestion.ruleId} style={{marginBottom: '0.55rem'}}>
                    <strong>{suggestion.ruleName}</strong>
                    {suggestion.maxDistanceMeters ? (
                      <span style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                        {' '}
                        ({suggestion.maxDistanceMeters}m proximity)
                      </span>
                    ) : null}
                    <div style={{fontSize: '0.82rem'}}>{suggestion.effectDescription}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      {formatSynergyStatus(suggestion, characterById)}
                    </div>
                  </li>
                ))
            )}
          </ul>
          <div style={{fontSize: '0.85rem', marginBottom: '0.45rem'}}>
            <strong>Roster Opportunities</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, marginTop: 0, marginBottom: 0}}>
            {rosterSynergyOpportunities.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                Full roster can already satisfy all default synergy rules.
              </li>
            ) : (
              rosterSynergyOpportunities.map((suggestion) => (
                <li key={`roster-${suggestion.ruleId}`} style={{marginBottom: '0.55rem'}}>
                  <strong>{suggestion.ruleName}</strong>
                  <div style={{fontSize: '0.82rem'}}>{suggestion.effectDescription}</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                    {formatSynergyStatus(suggestion, characterById)}
                  </div>
                  {suggestion.questPrompt && (
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      Prompt seed: {suggestion.questPrompt}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Settlement Progression</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Generalized settlement buffs. Trophies are one source type, alongside
            structures, stations, totems, and custom modules.
          </p>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Linked location
            <select
              value={selectedSettlementLocationId}
              onChange={(e) => setSelectedSettlementLocationId(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>No linked location</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          {settlementState?.sourceEntityId && (
            <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '0.65rem'}}>
              Settlement systems are currently attached to{' '}
              <strong>
                {worldEntityById.get(settlementState.sourceEntityId)?.name ??
                  settlementState.sourceEntityId}
              </strong>
              .
            </div>
          )}
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Module Name
            <input
              type='text'
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder='Cave Worm Trophy'
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Source Type
            <select
              value={moduleSourceType}
              onChange={(e) =>
                setModuleSourceType(e.target.value as SettlementModule['sourceType'])
              }
              style={{width: '100%'}}
            >
              {SETTLEMENT_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Target Type
              <select
                value={moduleTargetType}
                onChange={(e) =>
                  setModuleTargetType(
                    e.target.value as SettlementModule['effects'][number]['targetType']
                  )
                }
                style={{width: '100%'}}
              >
                {SETTLEMENT_EFFECT_TARGET_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Target ID
              <input
                type='text'
                value={moduleTargetId}
                onChange={(e) => setModuleTargetId(e.target.value)}
                placeholder='poison'
                style={{width: '100%'}}
              />
            </label>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Operation
              <select
                value={moduleOperation}
                onChange={(e) =>
                  setModuleOperation(
                    e.target.value as SettlementModule['effects'][number]['operation']
                  )
                }
                style={{width: '100%'}}
              >
                {SETTLEMENT_EFFECT_OPERATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Value
              <input
                type='text'
                value={moduleValue}
                onChange={(e) => setModuleValue(e.target.value)}
                placeholder='5'
                style={{width: '100%'}}
              />
            </label>
          </div>
          <button
            type='button'
            onClick={() => void handleAddSettlementModule()}
            disabled={isSavingModule || !settlementState || !moduleName.trim()}
          >
            {isSavingModule ? 'Adding...' : 'Add Settlement Module'}
          </button>
          <hr style={{margin: '0.9rem 0'}} />
          <div style={{fontSize: '0.85rem', marginBottom: '0.5rem'}}>
            <strong>Settlement Tier Level:</strong> {settlementState?.fortressLevel ?? 1}
          </div>
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.65rem'}}>
            <button
              type='button'
              onClick={() => void handleAdjustFortressLevel(-1)}
              disabled={!settlementState || settlementState.fortressLevel <= 1 || isSavingFortress}
            >
              - Tier
            </button>
            <button
              type='button'
              onClick={() => void handleAdjustFortressLevel(1)}
              disabled={!settlementState || isSavingFortress}
            >
              + Tier
            </button>
          </div>
          <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '0.6rem'}}>
            {nextFortressTier
              ? `Next tier at level ${nextFortressTier.levelRequired}: ${nextFortressTier.name}`
              : 'All configured settlement tiers unlocked.'}
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.35rem'}}>
            <strong>Base Stats</strong>
          </div>
          {settlementState && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.45rem',
                marginBottom: '0.65rem'
              }}
            >
              {BASE_STAT_KEYS.map((key) => (
                <label key={`base-${key}`} style={{fontSize: '0.82rem'}}>
                  {key}
                  <input
                    type='number'
                    min={BASE_STAT_LIMITS[key].min}
                    max={BASE_STAT_LIMITS[key].max}
                    step={1}
                    value={baseStatsDraft[key]}
                    onChange={(e) => handleBaseStatDraftChange(key, e.target.value)}
                    style={{width: '100%'}}
                  />
                </label>
              ))}
            </div>
          )}
          <div style={{display: 'flex', gap: '0.45rem', marginBottom: '0.7rem'}}>
            <button
              type='button'
              onClick={() => void handleSaveBaseStats()}
              disabled={!settlementState || !isBaseStatsDraftDirty || isSavingFortress}
            >
              {isSavingFortress ? 'Saving...' : 'Save Base Stats'}
            </button>
            <button
              type='button'
              onClick={() =>
                settlementState && setBaseStatsDraft(toBaseStatsDraft(settlementState.baseStats))
              }
              disabled={!settlementState || !isBaseStatsDraftDirty || isSavingFortress}
            >
              Reset
            </button>
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.5rem'}}>
            <strong>Settlement Tier Effects:</strong>{' '}
            {settlementComputedEffects.fortressEffects.length}
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {settlementComputedEffects.fortressEffects.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No tier effects unlocked yet.
              </li>
            ) : (
              settlementComputedEffects.fortressEffects.map((effect, index) => (
                <li
                  key={`tier-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  style={{marginBottom: '0.35rem'}}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <div style={{fontSize: '0.85rem', marginTop: '0.65rem', marginBottom: '0.5rem'}}>
            <strong>Active Aura Effects:</strong> {activeSettlementEffects.length}
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {activeSettlementEffects.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No active module effects yet.
              </li>
            ) : (
              activeSettlementEffects.map((effect, index) => (
                <li
                  key={`active-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  style={{marginBottom: '0.35rem'}}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <div style={{fontSize: '0.85rem', marginTop: '0.65rem', marginBottom: '0.5rem'}}>
            <strong>Total Active Effects:</strong> {settlementComputedEffects.allEffects.length}
          </div>
          <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '0.65rem'}}>
            Includes settlement progression + aura modules.
          </div>
          <div style={{fontSize: '0.85rem', marginBottom: '0.35rem'}}>
            <strong>Unlocked Settlement Tiers</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {unlockedFortressTiers.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>None yet.</li>
            ) : (
              unlockedFortressTiers.map((tier) => (
                <li key={tier.id} style={{marginBottom: '0.45rem'}}>
                  <strong>
                    L{tier.levelRequired} {tier.name}
                  </strong>
                  {tier.description && (
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                      {tier.description}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
          <div style={{fontSize: '0.82rem', marginTop: '0.75rem'}}>
            <strong>Installed Modules:</strong>
          </div>
          <ul style={{listStyle: 'none', padding: 0, marginTop: '0.35rem', marginBottom: 0}}>
            {settlementModules.length === 0 ? (
              <li style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                No modules installed.
              </li>
            ) : (
              settlementModules.map((module) => (
                <li key={module.id} style={{marginBottom: '0.45rem'}}>
                  <strong>{module.name}</strong>{' '}
                  <span style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>
                    [{module.sourceType}]
                  </span>
                  {module.effects.map((effect, effectIndex) => (
                    <div
                      key={`${module.id}-effect-${effectIndex}`}
                      style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}
                    >
                      {formatSettlementEffectLabel(effect)}
                    </div>
                  ))}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    );
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

      {currentTab.id === 'overview' && <CompendiumOverviewSection />}
      {currentTab.id === 'entries' && <CompendiumEntriesSection />}
      {currentTab.id === 'progression' && <CompendiumProgressionSection />}
      {currentTab.id === 'world-systems' && <CompendiumWorldSystemsSection />}
    </section>
  );
}

export default CompendiumRoute;
