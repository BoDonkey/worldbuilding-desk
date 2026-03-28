import {useEffect, useMemo, useRef, useState} from 'react';
import type {
  Character,
  CompendiumActionDefinition,
  CompendiumActionLog,
  CompendiumDomain,
  CompendiumEntry,
  CompendiumMilestone,
  CompendiumProgress,
  PartySynergySuggestion,
  Project,
  ProjectSettings,
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
  saveCompendiumActionLog,
  saveCompendiumMilestone,
  saveCompendiumProgress,
  saveSettlementModule,
  saveSettlementState,
  saveZoneAffinityProfile,
  updateSettlementBaseStats,
  updateSettlementFortressLevel,
  saveUnlockableRecipe,
  upsertZoneAffinityProfile,
  upsertCompendiumEntryFromEntity,
  saveZoneAffinityProgress
} from '../services/compendiumService';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';
import {exportCompendiumJson} from '../utils/exportCompendium';
import {readJsonFile} from '../services/jsonTransfer';
import styles from '../styles/CompendiumRoute.module.css';

interface CompendiumRouteProps {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
}

interface CompendiumImportPreviewState {
  fileName: string;
  projectName?: string;
  entries: CompendiumEntry[];
  milestones: CompendiumMilestone[];
  recipes: UnlockableRecipe[];
  progress: CompendiumProgress | null;
  actionLogs: CompendiumActionLog[];
  zoneProfiles: ZoneAffinityProfile[];
  zoneProgress: ZoneAffinityProgress[];
  settlementState: SettlementState | null;
  settlementModules: SettlementModule[];
  importEntries: boolean;
  importMilestones: boolean;
  importRecipes: boolean;
  importProgress: boolean;
  importActionLogs: boolean;
  importWorldSystems: boolean;
}

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
    subtitle: 'Create/import entries and record compendium actions.'
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

function CompendiumRoute({activeProject, projectSettings}: CompendiumRouteProps) {
  const [entries, setEntries] = useState<CompendiumEntry[]>([]);
  const [milestones, setMilestones] = useState<CompendiumMilestone[]>([]);
  const [recipes, setRecipes] = useState<UnlockableRecipe[]>([]);
  const [zoneProfiles, setZoneProfiles] = useState<ZoneAffinityProfile[]>([]);
  const [zoneProgress, setZoneProgress] = useState<ZoneAffinityProgress[]>([]);
  const [settlementState, setSettlementState] = useState<SettlementState | null>(null);
  const [settlementModules, setSettlementModules] = useState<SettlementModule[]>([]);
  const [progress, setProgress] = useState<CompendiumProgress | null>(null);
  const [logs, setLogs] = useState<CompendiumActionLog[]>([]);
  const [worldEntities, setWorldEntities] = useState<WorldEntity[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activePartyCharacterIds, setActivePartyCharacterIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [compendiumImportPreview, setCompendiumImportPreview] =
    useState<CompendiumImportPreviewState | null>(null);
  const [isImportPreviewOpen, setImportPreviewOpen] = useState(false);
  const [isImportingJson, setImportingJson] = useState(false);
  const compendiumImportInputRef = useRef<HTMLInputElement | null>(null);

  const [entryName, setEntryName] = useState('');
  const [entryDomain, setEntryDomain] = useState<CompendiumDomain>('beast');
  const [entityToImportId, setEntityToImportId] = useState('');
  const [importDomain, setImportDomain] = useState<CompendiumDomain>('beast');

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
  const [selectedZoneKey, setSelectedZoneKey] = useState('');
  const [zoneExposureMinutes, setZoneExposureMinutes] = useState(10);
  const [isRecordingZone, setIsRecordingZone] = useState(false);
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
  const enableGameSystems =
    projectSettings?.featureToggles.enableGameSystems !== false;
  const enableRuntimeModifiers =
    projectSettings?.featureToggles.enableRuntimeModifiers !== false;
  const enableWorldSystems =
    enableGameSystems &&
    projectSettings?.featureToggles.enableSettlementAndZoneSystems !== false;

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
      setWorldEntities([]);
      setCharacters([]);
      setActivePartyCharacterIds([]);
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
      getCompendiumProgress(activeProject.id),
      getCompendiumActionLogs(activeProject.id),
      getEntitiesByProject(activeProject.id),
      getCharactersByProject(activeProject.id)
    ])
      .then(([loadedEntries, loadedMilestones, loadedRecipes, loadedZoneProfiles, loadedZoneProgress, loadedSettlementState, loadedSettlementModules, loadedProgress, loadedLogs, loadedEntities, loadedCharacters]) => {
        if (cancelled) return;
        setEntries(loadedEntries);
        setMilestones(loadedMilestones);
        setRecipes(loadedRecipes);
        setZoneProfiles(loadedZoneProfiles);
        setZoneProgress(loadedZoneProgress);
        setSettlementState(loadedSettlementState);
        setSettlementModules(loadedSettlementModules);
        setProgress(loadedProgress);
        setLogs(loadedLogs);
        setWorldEntities(loadedEntities);
        setCharacters(loadedCharacters);
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
    if (!settlementState) return;
    setBaseStatsDraft(toBaseStatsDraft(settlementState.baseStats));
  }, [settlementState]);
  useEffect(() => {
    if (activeTab === 'world-systems' && !enableWorldSystems) {
      setActiveTab('overview');
    }
  }, [activeTab, enableWorldSystems]);

  const completedActionSet = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      set.add(`${log.entryId}:${log.actionId}`);
    }
    return set;
  }, [logs]);

  const unlockedMilestoneSet = new Set(progress?.unlockedMilestoneIds ?? []);
  const unlockedRecipeSet = new Set(progress?.unlockedRecipeIds ?? []);
  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries]
  );
  const worldEntityById = useMemo(
    () => new Map(worldEntities.map((entity) => [entity.id, entity])),
    [worldEntities]
  );
  const draftWorldEntityCount = useMemo(
    () =>
      worldEntities.filter((entity) => entity.completionStatus === 'draft').length,
    [worldEntities]
  );
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );
  const activePartyCharacters = useMemo(() => {
    const selectedSet = new Set(activePartyCharacterIds);
    return characters.filter((character) => selectedSet.has(character.id));
  }, [characters, activePartyCharacterIds]);
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
    () => new Map(zoneProgress.map((progressItem) => [progressItem.biomeKey, progressItem])),
    [zoneProgress]
  );
  const activeSettlementEffects = useMemo(() => {
    if (!enableWorldSystems || !settlementState) return [];
    return getActiveSettlementAuraEffects({
      settlementState,
      modules: settlementModules
    });
  }, [enableWorldSystems, settlementState, settlementModules]);
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

  const handleCreateEntry = async () => {
    if (!activeProject || !entryName.trim()) return;
    const now = Date.now();
    const next: CompendiumEntry = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: entryName.trim(),
      domain: entryDomain,
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
    setFeedback(null);
    try {
      const entry = await upsertCompendiumEntryFromEntity({
        projectId: activeProject.id,
        entity,
        domain: importDomain,
        defaultActions: getDefaultActions(importDomain)
      });
      setEntries((prev) => {
        const idx = prev.findIndex((item) => item.id === entry.id);
        if (idx === -1) return [...prev, entry].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...prev];
        next[idx] = entry;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setFeedback({tone: 'success', message: 'World Bible entity linked to compendium.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import entity.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleExportCompendium = () => {
    if (!activeProject) return;
    try {
      exportCompendiumJson({
        project: activeProject,
        entries,
        milestones,
        recipes,
        progress,
        actionLogs: logs,
        zoneProfiles,
        zoneProgress,
        settlementState,
        settlementModules,
        worldEntities
      });
      setFeedback({tone: 'success', message: 'Compendium exported to JSON.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to export compendium.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleImportCompendiumClick = () => {
    compendiumImportInputRef.current?.click();
  };

  const handleImportCompendiumJson = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await readJsonFile(file);
      if (
        !raw ||
        typeof raw !== 'object' ||
        (raw as {schemaVersion?: unknown}).schemaVersion !== 1 ||
        !('compendium' in raw) ||
        !('worldSystems' in raw)
      ) {
        throw new Error('This JSON file is not a valid compendium export.');
      }

      const payload = raw as {
        project?: {name?: string};
        compendium?: {
          entries?: CompendiumEntry[];
          milestones?: CompendiumMilestone[];
          recipes?: UnlockableRecipe[];
          progress?: CompendiumProgress | null;
          actionLogs?: CompendiumActionLog[];
        };
        worldSystems?: {
          zoneProfiles?: ZoneAffinityProfile[];
          zoneProgress?: ZoneAffinityProgress[];
          settlementState?: SettlementState | null;
          settlementModules?: SettlementModule[];
        };
      };

      setCompendiumImportPreview({
        fileName: file.name,
        projectName: payload.project?.name,
        entries: Array.isArray(payload.compendium?.entries) ? payload.compendium!.entries : [],
        milestones: Array.isArray(payload.compendium?.milestones)
          ? payload.compendium!.milestones
          : [],
        recipes: Array.isArray(payload.compendium?.recipes) ? payload.compendium!.recipes : [],
        progress: payload.compendium?.progress ?? null,
        actionLogs: Array.isArray(payload.compendium?.actionLogs)
          ? payload.compendium!.actionLogs
          : [],
        zoneProfiles: Array.isArray(payload.worldSystems?.zoneProfiles)
          ? payload.worldSystems!.zoneProfiles
          : [],
        zoneProgress: Array.isArray(payload.worldSystems?.zoneProgress)
          ? payload.worldSystems!.zoneProgress
          : [],
        settlementState: payload.worldSystems?.settlementState ?? null,
        settlementModules: Array.isArray(payload.worldSystems?.settlementModules)
          ? payload.worldSystems!.settlementModules
          : [],
        importEntries: true,
        importMilestones: true,
        importRecipes: true,
        importProgress: Boolean(payload.compendium?.progress),
        importActionLogs:
          Array.isArray(payload.compendium?.actionLogs) &&
          payload.compendium!.actionLogs.length > 0,
        importWorldSystems:
          (Array.isArray(payload.worldSystems?.zoneProfiles) &&
            payload.worldSystems!.zoneProfiles.length > 0) ||
          (Array.isArray(payload.worldSystems?.zoneProgress) &&
            payload.worldSystems!.zoneProgress.length > 0) ||
          Boolean(payload.worldSystems?.settlementState) ||
          (Array.isArray(payload.worldSystems?.settlementModules) &&
            payload.worldSystems!.settlementModules.length > 0)
      });
      setImportPreviewOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to read compendium JSON.';
      setFeedback({tone: 'error', message});
    } finally {
      event.target.value = '';
    }
  };

  const closeImportPreview = () => {
    setImportPreviewOpen(false);
    setCompendiumImportPreview(null);
  };

  const toggleImportSection = (
    key:
      | 'importEntries'
      | 'importMilestones'
      | 'importRecipes'
      | 'importProgress'
      | 'importActionLogs'
      | 'importWorldSystems'
  ) => {
    setCompendiumImportPreview((prev) =>
      prev ? {...prev, [key]: !prev[key]} : prev
    );
  };

  const handleConfirmCompendiumImport = async () => {
    if (!activeProject || !compendiumImportPreview) return;
    setImportingJson(true);
    setFeedback(null);
    try {
      if (compendiumImportPreview.importEntries) {
        const importedEntries = compendiumImportPreview.entries.map((entry) => ({
          ...entry,
          projectId: activeProject.id
        }));
        await Promise.all(importedEntries.map((entry) => saveCompendiumEntry(entry)));
        setEntries((prev) => {
          const map = new Map(prev.map((entry) => [entry.id, entry]));
          importedEntries.forEach((entry) => map.set(entry.id, entry));
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
      }

      if (compendiumImportPreview.importMilestones) {
        const importedMilestones = compendiumImportPreview.milestones.map((milestone) => ({
          ...milestone,
          projectId: activeProject.id
        }));
        await Promise.all(
          importedMilestones.map((milestone) => saveCompendiumMilestone(milestone))
        );
        setMilestones((prev) => {
          const map = new Map(prev.map((milestone) => [milestone.id, milestone]));
          importedMilestones.forEach((milestone) => map.set(milestone.id, milestone));
          return Array.from(map.values()).sort((a, b) => a.pointsRequired - b.pointsRequired);
        });
      }

      if (compendiumImportPreview.importRecipes) {
        const importedRecipes = compendiumImportPreview.recipes.map((recipe) => ({
          ...recipe,
          projectId: activeProject.id
        }));
        await Promise.all(importedRecipes.map((recipe) => saveUnlockableRecipe(recipe)));
        setRecipes((prev) => {
          const map = new Map(prev.map((recipe) => [recipe.id, recipe]));
          importedRecipes.forEach((recipe) => map.set(recipe.id, recipe));
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
      }

      if (compendiumImportPreview.importProgress && compendiumImportPreview.progress) {
        const importedProgress = {
          ...compendiumImportPreview.progress,
          projectId: activeProject.id
        };
        await saveCompendiumProgress(importedProgress);
        setProgress(importedProgress);
      }

      if (compendiumImportPreview.importActionLogs) {
        const importedLogs = compendiumImportPreview.actionLogs.map((log) => ({
          ...log,
          projectId: activeProject.id
        }));
        await Promise.all(importedLogs.map((log) => saveCompendiumActionLog(log)));
        setLogs((prev) => {
          const map = new Map(prev.map((log) => [log.id, log]));
          importedLogs.forEach((log) => map.set(log.id, log));
          return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
        });
      }

      if (compendiumImportPreview.importWorldSystems) {
        const importedZoneProfiles = compendiumImportPreview.zoneProfiles.map((profile) => ({
          ...profile,
          projectId: activeProject.id
        }));
        const importedZoneProgress = compendiumImportPreview.zoneProgress.map((progressItem) => ({
          ...progressItem,
          projectId: activeProject.id
        }));
        const importedSettlementModules = compendiumImportPreview.settlementModules.map(
          (module) => ({
            ...module,
            projectId: activeProject.id
          })
        );
        const importedSettlementState = compendiumImportPreview.settlementState
          ? {
              ...compendiumImportPreview.settlementState,
              projectId: activeProject.id
            }
          : null;

        await Promise.all(importedZoneProfiles.map((profile) => saveZoneAffinityProfile(profile)));
        await Promise.all(
          importedZoneProgress.map((progressItem) =>
            saveZoneAffinityProgress(progressItem)
          )
        );
        await Promise.all(
          importedSettlementModules.map((module) => saveSettlementModule(module))
        );
        if (importedSettlementState) {
          await saveSettlementState(importedSettlementState);
        }

        setZoneProfiles((prev) => {
          const map = new Map(prev.map((profile) => [profile.id, profile]));
          importedZoneProfiles.forEach((profile) => map.set(profile.id, profile));
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
        setZoneProgress((prev) => {
          const map = new Map(prev.map((progressItem) => [progressItem.id, progressItem]));
          importedZoneProgress.forEach((progressItem) =>
            map.set(progressItem.id, progressItem)
          );
          return Array.from(map.values()).sort((a, b) => b.affinityPoints - a.affinityPoints);
        });
        setSettlementModules((prev) => {
          const map = new Map(prev.map((module) => [module.id, module]));
          importedSettlementModules.forEach((module) => map.set(module.id, module));
          return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
        if (importedSettlementState) {
          setSettlementState(importedSettlementState);
        }
      }

      setFeedback({tone: 'success', message: 'Compendium JSON imported.'});
      closeImportPreview();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import compendium JSON.';
      setFeedback({tone: 'error', message});
    } finally {
      setImportingJson(false);
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
      setFeedback({tone: 'success', message: 'Zone affinity profile created.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create zone profile.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleRecordZoneExposure = async () => {
    if (!activeProject || !selectedZoneKey) return;
    setIsRecordingZone(true);
    setFeedback(null);
    try {
      const result = await recordZoneExposure({
        projectId: activeProject.id,
        biomeKey: selectedZoneKey,
        exposureSeconds: Math.max(1, Math.floor(zoneExposureMinutes * 60))
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
        moduleId: module.id
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
        quantity
      });
      setProgress(result.progress);
      if (result.log) {
        setLogs((prev) => [result.log!, ...prev]);
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
        level: nextLevel
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
        baseStats: nextBaseStats
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
        <h1>Compendium</h1>
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
        <h1>Compendium</h1>
        <p>
          Compendium is hidden because <strong>Enable Game Systems</strong> is
          turned off for this project.
        </p>
        <p>Go to Settings to re-enable it when needed.</p>
      </section>
    );
  }

  const visibleTabs = COMPENDIUM_TABS.filter(
    (tab) => !tab.advanced || enableWorldSystems
  );
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
      label: 'Import your first World Bible entity.',
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
        <p className={styles.sectionLead}>
          Use this snapshot to see progress at a glance, then jump into the next
          task without scanning every advanced system.
        </p>
        <div className={styles.metricsGrid}>
          <article className={styles.metricCard}>
            <h3 className={styles.metricTitle}>Total Points</h3>
            <div className={styles.metricValue}>
              {isLoading || !progress ? '...' : progress.totalPoints}
            </div>
          </article>
          <article className={styles.metricCard}>
            <h3 className={styles.metricTitle}>Milestones Unlocked</h3>
            <div className={styles.metricValue}>
              {isLoading || !progress ? '...' : progress.unlockedMilestoneIds.length}
            </div>
          </article>
          <article className={styles.metricCard}>
            <h3 className={styles.metricTitle}>Recipes Unlocked</h3>
            <div className={styles.metricValue}>
              {isLoading || !progress ? '...' : progress.unlockedRecipeIds.length}
            </div>
          </article>
        </div>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>What To Do Next</h2>
          <ul className={styles.plainList}>
            {nextStepItems.map((step) => (
              <li key={step.id} className={styles.listItem}>
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

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Recent Actions</h2>
          {logs.length === 0 ? (
            <>
              <p className={styles.emptyStateText}>No actions logged yet.</p>
              <button
                type='button'
                onClick={() => openTabWithSmartDefaults('entries', 'log-action')}
              >
                Go to Entries to log your first action
              </button>
            </>
          ) : (
            <ul className={styles.plainList}>
              {logs.slice(0, 12).map((log) => (
                <li key={log.id} className={styles.listItem}>
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
      <p className={styles.sectionLead}>
        Create new compendium records or import from World Bible, then log actions
        from each entry card.
      </p>
      <div className={styles.cardGrid}>
        <article className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Add Entry</h2>
          <p className={styles.sectionHint}>
            Use this for custom creatures, resources, or artifacts not yet in the
            World Bible.
          </p>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              type='text'
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Domain</span>
            <select
              value={entryDomain}
              onChange={(e) => setEntryDomain(e.target.value as CompendiumDomain)}
              className={styles.fullWidthInput}
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

        <article className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Import from World Bible</h2>
          <p className={styles.sectionHint}>
            Best for existing entities so names stay aligned across tools.
          </p>
          {draftWorldEntityCount > 0 && (
            <p className={styles.entryWarning}>
              {draftWorldEntityCount} World Bible entr
              {draftWorldEntityCount === 1 ? 'y is' : 'ies are'} marked needs
              completion.
            </p>
          )}
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Entity</span>
            <select
              value={entityToImportId}
              onChange={(e) => setEntityToImportId(e.target.value)}
              className={styles.fullWidthInput}
            >
              <option value=''>Select an entity</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                  {entity.completionStatus === 'draft' ? ' (Needs completion)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Domain</span>
            <select
              value={importDomain}
              onChange={(e) => setImportDomain(e.target.value as CompendiumDomain)}
              className={styles.fullWidthInput}
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
            Link Entity
          </button>
        </article>
      </div>

      <section className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>Entries</h2>
        {entries.length === 0 && (
          <div className={`${styles.emptyStateCard} ${styles.emptyStateCardTight}`}>
            <p className={styles.emptyStateText}>
              No compendium entries yet.
            </p>
            <div className={styles.inlineActions}>
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
                Import your first World Bible entity
              </button>
            </div>
          </div>
        )}
        <ul className={styles.plainList}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.entryCard}>
              <strong>{entry.name}</strong>{' '}
              <span className={styles.entryMeta}>[{entry.domain}]</span>
              {entry.sourceEntityId && (
                <div className={styles.entryMeta}>
                  Linked to World Bible entity
                </div>
              )}
              {entry.sourceEntityId &&
                worldEntityById.get(entry.sourceEntityId)?.completionStatus === 'draft' && (
                  <div className={styles.entryWarning}>
                    Source World Bible record still needs completion
                  </div>
                )}
              <div className={styles.entryActionRow}>
                {entry.actions.map((action) => {
                  const key = `${entry.id}:${action.id}`;
                  const alreadyDone = completedActionSet.has(key);
                  const disabled =
                    isRecordingKey === key || (!action.repeatable && alreadyDone);
                  const quantity = Math.max(1, Math.floor(quantityByActionKey[key] || 1));
                  return (
                    <div key={key} className={styles.entryActionGroup}>
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
                          className={styles.quantityInput}
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
          ))}
        </ul>
      </section>
    </>
  );

  const CompendiumProgressionSection = () => (
    <>
      <p className={styles.sectionLead}>
        Define unlock rules first, then validate craftability using current
        progression and runtime modifiers.
      </p>
      <div className={styles.splitGrid}>
      <section className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>Recipes</h2>
        <p className={styles.sectionHint}>
          Recipes define what can be unlocked and what requirements must be met.
        </p>
        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Name</span>
          <input
            type='text'
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            className={styles.fullWidthInput}
          />
        </label>
        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Category</span>
          <select
            value={recipeCategory}
            onChange={(e) =>
              setRecipeCategory(e.target.value as UnlockableRecipe['category'])
            }
            className={styles.fullWidthInput}
          >
            {RECIPE_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Min Character Level</span>
          <input
            type='number'
            min={1}
            value={recipeMinLevel}
            onChange={(e) => setRecipeMinLevel(Number(e.target.value))}
            className={styles.fullWidthInput}
          />
        </label>
        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Required Milestone IDs (comma-separated)</span>
          <input
            type='text'
            value={recipeRequiredMilestones}
            onChange={(e) => setRecipeRequiredMilestones(e.target.value)}
            className={styles.fullWidthInput}
          />
        </label>
        <button type='button' onClick={() => void handleCreateRecipe()}>
          Add Recipe
        </button>
        {recipes.length === 0 && (
          <div className={styles.emptyStateCard}>
            <p className={styles.emptyStateText}>
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
        <ul className={styles.plainListSpaced}>
          {recipes.map((recipe) => (
            <li key={recipe.id} className={styles.listItem}>
              {unlockedRecipeSet.has(recipe.id) ? 'Unlocked' : 'Locked'}: {recipe.name}
              {recipe.requirements?.minCharacterLevel ? (
                <> (lvl {recipe.requirements.minCharacterLevel}+)</>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.stackGrid}>
        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Milestones</h2>
          <p className={styles.sectionHint}>
            Milestones convert point totals into explicit progression beats.
          </p>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              type='text'
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Points Required</span>
            <input
              type='number'
              min={0}
              value={milestonePoints}
              onChange={(e) => setMilestonePoints(Number(e.target.value))}
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Description</span>
            <input
              type='text'
              value={milestoneDescription}
              onChange={(e) => setMilestoneDescription(e.target.value)}
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Unlock Recipe IDs (comma-separated)</span>
            <input
              type='text'
              value={milestoneRecipeIds}
              onChange={(e) => setMilestoneRecipeIds(e.target.value)}
              className={styles.fullWidthInput}
            />
          </label>
          <button type='button' onClick={() => void handleCreateMilestone()}>
            Add Milestone
          </button>
          {milestones.length === 0 && (
            <div className={styles.emptyStateCard}>
              <p className={styles.emptyStateText}>
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
          <ul className={styles.plainListSpaced}>
            {milestones.map((milestone) => (
              <li key={milestone.id} className={styles.listItem}>
                {unlockedMilestoneSet.has(milestone.id) ? 'Unlocked' : 'Locked'}:{' '}
                {milestone.name} ({milestone.pointsRequired} pts)
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Craftability Preview</h2>
          <p className={styles.sectionHint}>
            Check if recipes are craftable for a sample character and material loadout.
          </p>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Character Level</span>
            <input
              type='number'
              min={1}
              value={previewLevel}
              onChange={(e) => setPreviewLevel(Number(e.target.value))}
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Materials (one per line: <code>itemId:quantity</code>)</span>
            <textarea
              rows={5}
              value={previewMaterialsText}
              onChange={(e) => setPreviewMaterialsText(e.target.value)}
              placeholder={'wolf_pelt:4\niron_ore:12'}
              className={styles.fullWidthInput}
            />
          </label>
          <div className={styles.infoCard}>
            Runtime modifiers: +{craftingRuntimeModifiers.levelBonus} effective level,
            material cost x{craftingRuntimeModifiers.materialCostMultiplier.toFixed(2)}
            {craftingRuntimeModifiers.notes.length > 0 && (
              <div>
                {craftingRuntimeModifiers.notes.join(' ')}
              </div>
            )}
          </div>
          <ul className={styles.plainList}>
            {recipes.map((recipe) => {
              const check = canCraftRecipe(recipe, {
                progress,
                characterLevel: Math.max(1, Math.floor(previewLevel || 1)),
                availableMaterials: parsedPreviewMaterials,
                runtime: craftingRuntimeModifiers
              });
              return (
                <li key={`preview-${recipe.id}`} className={styles.ruleListItem}>
                  <strong>{recipe.name}</strong>{' '}
                  <span
                    className={`${styles.recipeStatus} ${
                      check.craftable
                        ? styles.recipeStatusCraftable
                        : styles.recipeStatusBlocked
                    }`}
                  >
                    {check.craftable ? 'craftable' : 'not craftable'}
                  </span>
                  <div className={styles.subtleMeta}>
                    Effective level: {check.effectiveCharacterLevel}
                    {' · '}Material multiplier: x{check.materialCostMultiplier.toFixed(2)}
                  </div>
                  {!check.craftable && check.reasons.length > 0 && (
                    <div className={styles.subtleMeta}>
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
        <section className={styles.settingsCallout}>
          <p className={styles.sectionLead}>
            Settlement and zone systems are hidden for this project. Enable
            <strong> Settlement/Zone Systems</strong> in Settings to access them.
          </p>
        </section>
      );
    }

    return (
      <div className={styles.stackGrid}>
        <p className={styles.sectionLead}>
          Advanced systems are optional. Enable and tune only when you need
          simulation depth for progression balancing.
        </p>
        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Zone Affinity</h2>
          <p className={styles.sectionHint}>
            Track zone exposure and unlock biome-specific milestones over time.
          </p>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Zone Name</span>
            <input
              type='text'
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder='Bee Cave'
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Zone Key</span>
            <input
              type='text'
              value={zoneKey}
              onChange={(e) => setZoneKey(e.target.value)}
              placeholder='bee_cave'
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Max Affinity Points</span>
            <input
              type='number'
              min={1}
              value={zoneMaxPoints}
              onChange={(e) => setZoneMaxPoints(Number(e.target.value))}
              className={styles.fullWidthInput}
            />
          </label>
          <button type='button' onClick={() => void handleCreateZoneProfile()}>
            Add Zone Profile
          </button>
          {zoneProfiles.length === 0 && (
            <div className={styles.emptyStateCard}>
              <p className={styles.emptyStateText}>No zone profiles yet.</p>
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
          <div className={styles.sectionDivider} />
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Active Zone</span>
            <select
              value={selectedZoneKey}
              onChange={(e) => setSelectedZoneKey(e.target.value)}
              className={styles.fullWidthInput}
            >
              <option value=''>Select zone</option>
              {zoneProfiles.map((profile) => (
                <option key={profile.id} value={profile.biomeKey}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Exposure Minutes</span>
            <input
              type='number'
              min={1}
              value={zoneExposureMinutes}
              onChange={(e) => setZoneExposureMinutes(Number(e.target.value))}
              className={styles.fullWidthInput}
            />
          </label>
          <button
            type='button'
            onClick={() => void handleRecordZoneExposure()}
            disabled={!selectedZoneKey || isRecordingZone}
          >
            {isRecordingZone ? 'Recording...' : 'Record Exposure'}
          </button>
          <ul className={styles.plainListSpaced}>
            {zoneProfiles.map((profile) => {
              const progressItem = zoneProgressByKey.get(profile.biomeKey) ?? {
                id: '',
                projectId: profile.projectId,
                biomeKey: profile.biomeKey,
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
                  className={styles.ruleListItem}
                >
                  <div className={styles.worldSystemRowHeader}>
                    <strong>{profile.name}</strong>
                    <span className={styles.worldSystemBadge}>
                      {percent.toFixed(1)}% affinity
                    </span>
                  </div>
                  <div className={styles.subtleMeta}>
                    Exposure: {(progressItem.totalExposureSeconds / 60).toFixed(1)} minutes
                  </div>
                  <div className={styles.worldSystemList}>
                    {profile.milestones.map((milestone) => (
                      <div key={milestone.id} className={styles.subtleMeta}>
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

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Community / Logistics</h2>
          <p className={styles.sectionHint}>
            Shared party synergy buffs driven by role combinations. Select the
            currently active party to preview concrete in-scene combo effects.
          </p>
          <h3 className={styles.sectionMinorHeading}>Active Party Members</h3>
          <div className={styles.selectionList}>
            {characters.length === 0 ? (
              <div className={styles.subtleMeta}>
                No characters yet. Add role-tagged characters to enable synergy.
              </div>
            ) : (
              characters.map((character) => (
                <label
                  key={character.id}
                  className={styles.selectionRow}
                >
                  <input
                    type='checkbox'
                    checked={activePartyCharacterIds.includes(character.id)}
                    onChange={() => togglePartyCharacter(character.id)}
                  />
                  <span>
                    {character.name}
                    <span className={styles.subtleMetaInline}>
                      {' '}
                      ({getCharacterRole(character) || 'no role'})
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <h3 className={styles.sectionMinorHeading}>Active Combo Buffs</h3>
          <ul className={styles.plainList}>
            {activePartySynergies.filter((item) => item.missingRoles.length === 0).length ===
            0 ? (
              <li className={styles.subtleMeta}>
                No active combos for the current party selection.
              </li>
            ) : (
              activePartySynergies
                .filter((item) => item.missingRoles.length === 0)
                .map((suggestion) => (
                  <li key={suggestion.ruleId} className={styles.ruleListItem}>
                    <div className={styles.worldSystemRowHeader}>
                      <strong>{suggestion.ruleName}</strong>
                    {suggestion.maxDistanceMeters ? (
                        <span className={styles.worldSystemBadge}>
                        {' '}
                        ({suggestion.maxDistanceMeters}m proximity)
                      </span>
                    ) : null}
                    </div>
                    <div>{suggestion.effectDescription}</div>
                    <div className={styles.subtleMeta}>
                      {formatSynergyStatus(suggestion, characterById)}
                    </div>
                  </li>
                ))
            )}
          </ul>
          <h3 className={styles.sectionMinorHeading}>Roster Opportunities</h3>
          <ul className={styles.plainList}>
            {rosterSynergyOpportunities.length === 0 ? (
              <li className={styles.subtleMeta}>
                Full roster can already satisfy all default synergy rules.
              </li>
            ) : (
              rosterSynergyOpportunities.map((suggestion) => (
                <li key={`roster-${suggestion.ruleId}`} className={styles.ruleListItem}>
                  <strong>{suggestion.ruleName}</strong>
                  <div>{suggestion.effectDescription}</div>
                  <div className={styles.subtleMeta}>
                    {formatSynergyStatus(suggestion, characterById)}
                  </div>
                  {suggestion.questPrompt && (
                    <div className={styles.subtleMeta}>
                      Prompt seed: {suggestion.questPrompt}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Settlement Progression</h2>
          <p className={styles.sectionHint}>
            Generalized settlement buffs. Trophies are one source type, alongside
            structures, stations, totems, and custom modules.
          </p>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Module Name</span>
            <input
              type='text'
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder='Cave Worm Trophy'
              className={styles.fullWidthInput}
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Source Type</span>
            <select
              value={moduleSourceType}
              onChange={(e) =>
                setModuleSourceType(e.target.value as SettlementModule['sourceType'])
              }
              className={styles.fullWidthInput}
            >
              {SETTLEMENT_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.twoColumnCompact}>
            <label className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>Target Type</span>
              <select
                value={moduleTargetType}
                onChange={(e) =>
                  setModuleTargetType(
                    e.target.value as SettlementModule['effects'][number]['targetType']
                  )
                }
                className={styles.fullWidthInput}
              >
                {SETTLEMENT_EFFECT_TARGET_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>Target ID</span>
              <input
                type='text'
                value={moduleTargetId}
                onChange={(e) => setModuleTargetId(e.target.value)}
                placeholder='poison'
                className={styles.fullWidthInput}
              />
            </label>
          </div>
          <div className={styles.twoColumnCompact}>
            <label className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>Operation</span>
              <select
                value={moduleOperation}
                onChange={(e) =>
                  setModuleOperation(
                    e.target.value as SettlementModule['effects'][number]['operation']
                  )
                }
                className={styles.fullWidthInput}
              >
                {SETTLEMENT_EFFECT_OPERATION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>Value</span>
              <input
                type='text'
                value={moduleValue}
                onChange={(e) => setModuleValue(e.target.value)}
                placeholder='5'
                className={styles.fullWidthInput}
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
          <div className={styles.sectionDivider} />
          <div className={styles.infoCard}>
            <strong>Settlement Tier Level:</strong> {settlementState?.fortressLevel ?? 1}
          </div>
          <div className={styles.inlineActions}>
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
          <div className={styles.subtleMeta}>
            {nextFortressTier
              ? `Next tier at level ${nextFortressTier.levelRequired}: ${nextFortressTier.name}`
              : 'All configured settlement tiers unlocked.'}
          </div>
          <h3 className={styles.sectionMinorHeading}>Base Stats</h3>
          {settlementState && (
            <div className={styles.twoColumnCompact}>
              {BASE_STAT_KEYS.map((key) => (
                <label key={`base-${key}`} className={styles.fieldBlock}>
                  <span className={styles.fieldLabel}>{key}</span>
                  <input
                    type='number'
                    min={BASE_STAT_LIMITS[key].min}
                    max={BASE_STAT_LIMITS[key].max}
                    step={1}
                    value={baseStatsDraft[key]}
                    onChange={(e) => handleBaseStatDraftChange(key, e.target.value)}
                    className={styles.fullWidthInput}
                  />
                </label>
              ))}
            </div>
          )}
          <div className={styles.inlineActions}>
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
          <h3 className={styles.sectionMinorHeading}>
            Settlement Tier Effects: {settlementComputedEffects.fortressEffects.length}
          </h3>
          <ul className={styles.plainList}>
            {settlementComputedEffects.fortressEffects.length === 0 ? (
              <li className={styles.subtleMeta}>
                No tier effects unlocked yet.
              </li>
            ) : (
              settlementComputedEffects.fortressEffects.map((effect, index) => (
                <li
                  key={`tier-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  className={styles.ruleListItem}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <h3 className={styles.sectionMinorHeading}>
            Active Aura Effects: {activeSettlementEffects.length}
          </h3>
          <ul className={styles.plainList}>
            {activeSettlementEffects.length === 0 ? (
              <li className={styles.subtleMeta}>
                No active module effects yet.
              </li>
            ) : (
              activeSettlementEffects.map((effect, index) => (
                <li
                  key={`active-effect-${effect.targetType}-${effect.targetId}-${index}`}
                  className={styles.ruleListItem}
                >
                  {formatSettlementEffectLabel(effect)}
                </li>
              ))
            )}
          </ul>
          <h3 className={styles.sectionMinorHeading}>
            Total Active Effects: {settlementComputedEffects.allEffects.length}
          </h3>
          <div className={styles.subtleMeta}>
            Includes settlement progression + aura modules.
          </div>
          <h3 className={styles.sectionMinorHeading}>Unlocked Settlement Tiers</h3>
          <ul className={styles.plainList}>
            {unlockedFortressTiers.length === 0 ? (
              <li className={styles.subtleMeta}>None yet.</li>
            ) : (
              unlockedFortressTiers.map((tier) => (
                <li key={tier.id} className={styles.ruleListItem}>
                  <div className={styles.worldSystemRowHeader}>
                    <strong>
                      L{tier.levelRequired} {tier.name}
                    </strong>
                  </div>
                  {tier.description && (
                    <div className={styles.subtleMeta}>{tier.description}</div>
                  )}
                </li>
              ))
            )}
          </ul>
          <h3 className={styles.sectionMinorHeading}>Installed Modules</h3>
          <ul className={styles.plainList}>
            {settlementModules.length === 0 ? (
              <li className={styles.subtleMeta}>
                No modules installed.
              </li>
            ) : (
              settlementModules.map((module) => (
                <li key={module.id} className={styles.ruleListItem}>
                  <div className={styles.worldSystemRowHeader}>
                    <strong>{module.name}</strong>
                    <span className={styles.worldSystemBadge}>{module.sourceType}</span>
                  </div>
                  {module.effects.map((effect, effectIndex) => (
                    <div
                      key={`${module.id}-effect-${effectIndex}`}
                      className={styles.subtleMeta}
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
    <section className={styles.container}>
      <h1>Compendium</h1>
      <div className={styles.actionRow}>
        <button type='button' onClick={handleExportCompendium}>
          Export Compendium JSON
        </button>
        <button type='button' onClick={handleImportCompendiumClick}>
          Import Compendium JSON
        </button>
        <input
          ref={compendiumImportInputRef}
          type='file'
          accept='.json,application/json'
          onChange={(event) => void handleImportCompendiumJson(event)}
          style={{display: 'none'}}
        />
      </div>
      {feedback && (
        <p
          role='status'
          className={`${styles.feedbackBanner} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {feedback.message}
        </p>
      )}
      {isImportPreviewOpen && compendiumImportPreview && (
        <div
          role='dialog'
          aria-modal='true'
          className={styles.modalOverlay}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Preview compendium JSON import</h2>
              <p className={styles.modalDescription}>
                Review the sections from <strong>{compendiumImportPreview.fileName}</strong>
                {compendiumImportPreview.projectName
                  ? ` exported from ${compendiumImportPreview.projectName}.`
                  : '.'}
              </p>
            </div>

            <div className={styles.importPreviewGrid}>
              <label className={styles.importOptionCard}>
                <span className={styles.importOptionLabel}>
                  <input
                    type='checkbox'
                    checked={compendiumImportPreview.importEntries}
                    onChange={() => toggleImportSection('importEntries')}
                  />{' '}
                  Entries
                </span>
                <span className={styles.importOptionMeta}>
                  {compendiumImportPreview.entries.length} item(s)
                </span>
              </label>
              <label className={styles.importOptionCard}>
                <span className={styles.importOptionLabel}>
                  <input
                    type='checkbox'
                    checked={compendiumImportPreview.importMilestones}
                    onChange={() => toggleImportSection('importMilestones')}
                  />{' '}
                  Milestones
                </span>
                <span className={styles.importOptionMeta}>
                  {compendiumImportPreview.milestones.length} item(s)
                </span>
              </label>
              <label className={styles.importOptionCard}>
                <span className={styles.importOptionLabel}>
                  <input
                    type='checkbox'
                    checked={compendiumImportPreview.importRecipes}
                    onChange={() => toggleImportSection('importRecipes')}
                  />{' '}
                  Recipes
                </span>
                <span className={styles.importOptionMeta}>
                  {compendiumImportPreview.recipes.length} item(s)
                </span>
              </label>
              <label className={styles.importOptionCard}>
                <span className={styles.importOptionLabel}>
                  <input
                    type='checkbox'
                    checked={compendiumImportPreview.importProgress}
                    onChange={() => toggleImportSection('importProgress')}
                    disabled={!compendiumImportPreview.progress}
                  />{' '}
                  Progress state
                </span>
                <span className={styles.importOptionMeta}>
                  {compendiumImportPreview.progress ? 'Available' : 'Not present'}
                </span>
              </label>
              <label className={styles.importOptionCard}>
                <span className={styles.importOptionLabel}>
                  <input
                    type='checkbox'
                    checked={compendiumImportPreview.importActionLogs}
                    onChange={() => toggleImportSection('importActionLogs')}
                    disabled={compendiumImportPreview.actionLogs.length === 0}
                  />{' '}
                  Action logs
                </span>
                <span className={styles.importOptionMeta}>
                  {compendiumImportPreview.actionLogs.length} item(s)
                </span>
              </label>
              <label className={styles.importOptionCard}>
                <span className={styles.importOptionLabel}>
                  <input
                    type='checkbox'
                    checked={compendiumImportPreview.importWorldSystems}
                    onChange={() => toggleImportSection('importWorldSystems')}
                    disabled={
                      compendiumImportPreview.zoneProfiles.length === 0 &&
                      compendiumImportPreview.zoneProgress.length === 0 &&
                      compendiumImportPreview.settlementModules.length === 0 &&
                      !compendiumImportPreview.settlementState
                    }
                  />{' '}
                  World systems
                </span>
                <span className={styles.importOptionMeta}>
                  {compendiumImportPreview.zoneProfiles.length} zones ·{' '}
                  {compendiumImportPreview.settlementModules.length} modules
                </span>
              </label>
            </div>

            <div className={styles.importBehaviorCard}>
              <strong className={styles.importBehaviorTitle}>Import behavior</strong>
              <p className={styles.importBehaviorText}>
                Imported records are written into the current project and overwrite
                local records with the same ids. Unchecked sections are skipped.
              </p>
            </div>

            <div className={styles.modalActions}>
              <button type='button' onClick={closeImportPreview} disabled={isImportingJson}>
                Cancel
              </button>
              <button
                type='button'
                onClick={() => void handleConfirmCompendiumImport()}
                disabled={isImportingJson}
              >
                {isImportingJson ? 'Importing...' : 'Import selected sections'}
              </button>
            </div>
          </div>
        </div>
      )}
      <details
        className={styles.helpPanel}
      >
        <summary className={styles.helpSummary}>
          Compendium Wizard Help
        </summary>
        <div className={styles.helpBody}>
          <p>
            Step 1: set up entries, milestones, and recipes.
          </p>
          <p>
            Step 2: record actions and verify progression unlocks.
          </p>
          <p>
            Step 3: use world systems and runtime previews for balancing.
          </p>
        </div>
      </details>
      <div className={styles.tabs}>
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
      <div className={styles.tabSubtitle}>
        {currentTab.subtitle}
      </div>
      <section className={styles.nextStepsPanel}>
        <h2 className={styles.nextStepsTitle}>
          Next Steps For {currentTab.label}
        </h2>
        {activeTab !== 'overview' && activeTabTotalCount > 0 && (
          <p className={styles.nextStepsProgress}>
            Completed in this section: {activeTabDoneCount}/{activeTabTotalCount}
          </p>
        )}
        {tabAwareNextSteps.length === 0 ? (
          <p className={styles.nextStepsEmpty}>
            This section is in good shape. Move to another tab for additional setup.
          </p>
        ) : (
          <ul className={styles.nextStepsList}>
            {tabAwareNextSteps.slice(0, 3).map((item) => (
              <li key={`tab-next-${item.id}`} className={styles.nextStepsItem}>
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
      <div className={styles.statusChips}>
        <span className={styles.statusChip}>
          Game Systems: {enableGameSystems ? 'On' : 'Off'}
        </span>
        <span className={styles.statusChip}>
          Runtime Modifiers: {enableRuntimeModifiers ? 'On' : 'Off'}
        </span>
      </div>

      {activeTab === 'overview' && <CompendiumOverviewSection />}
      {activeTab === 'entries' && <CompendiumEntriesSection />}
      {activeTab === 'progression' && <CompendiumProgressionSection />}
      {activeTab === 'world-systems' && <CompendiumWorldSystemsSection />}
    </section>
  );
}

export default CompendiumRoute;
