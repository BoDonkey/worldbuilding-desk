import {useEffect, useMemo, useState} from 'react';
import type {
  Character,
  CompendiumActionDefinition,
  CompendiumDomain,
  CompendiumEntry,
  CompendiumMilestone,
  CompendiumProgress,
  PartySynergySuggestion,
  Project,
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
  updateSettlementBaseStats,
  updateSettlementFortressLevel,
  saveUnlockableRecipe,
  upsertZoneAffinityProfile,
  upsertCompendiumEntryFromEntity
} from '../services/compendiumService';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';

interface CompendiumRouteProps {
  activeProject: Project | null;
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

function CompendiumRoute({activeProject}: CompendiumRouteProps) {
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
  const [worldEntities, setWorldEntities] = useState<WorldEntity[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
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
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );
  const activePartyCharacters = useMemo(() => {
    const selectedSet = new Set(activePartyCharacterIds);
    return characters.filter((character) => selectedSet.has(character.id));
  }, [characters, activePartyCharacterIds]);
  const activePartySynergies = useMemo(
    () =>
      getPartySynergySuggestions({
        characters: activePartyCharacters
      }),
    [activePartyCharacters]
  );
  const rosterSynergyOpportunities = useMemo(
    () =>
      getPartySynergySuggestions({
        characters,
        rules: DEFAULT_PARTY_SYNERGY_RULES
      }).filter((suggestion) => suggestion.missingRoles.length > 0),
    [characters]
  );
  const zoneProgressByKey = useMemo(
    () => new Map(zoneProgress.map((progressItem) => [progressItem.biomeKey, progressItem])),
    [zoneProgress]
  );
  const activeSettlementEffects = useMemo(() => {
    if (!settlementState) return [];
    return getActiveSettlementAuraEffects({
      settlementState,
      modules: settlementModules
    });
  }, [settlementState, settlementModules]);
  const settlementComputedEffects = useMemo(() => {
    if (!settlementState) {
      return {auraEffects: [], fortressEffects: [], allEffects: []};
    }
    return getSettlementComputedEffects({
      settlementState,
      modules: settlementModules
    });
  }, [settlementState, settlementModules]);
  const unlockedFortressTiers = useMemo(() => {
    if (!settlementState) return [];
    return getUnlockedFortressTiers({
      fortressLevel: settlementState.fortressLevel,
      tiers: DEFAULT_FORTRESS_TIERS
    });
  }, [settlementState]);
  const nextFortressTier = useMemo(() => {
    if (!settlementState) return null;
    return getNextFortressTier({
      fortressLevel: settlementState.fortressLevel,
      tiers: DEFAULT_FORTRESS_TIERS
    });
  }, [settlementState]);
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
      setFeedback({tone: 'success', message: `Fortress level set to ${nextState.fortressLevel}.`});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update fortress level.';
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

  return (
    <section>
      <h1>Compendium</h1>
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.tone === 'error' ? '#fecaca' : '#bbf7d0'
            }`,
            backgroundColor:
              feedback.tone === 'error' ? '#fef2f2' : '#f0fdf4',
            color: feedback.tone === 'error' ? '#991b1b' : '#166534'
          }}
        >
          {feedback.message}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}
      >
        <article style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Progress</h2>
          {isLoading || !progress ? (
            <p>Loading progress...</p>
          ) : (
            <>
              <p style={{marginBottom: '0.25rem'}}>
                <strong>Total Points:</strong> {progress.totalPoints}
              </p>
              <p style={{marginBottom: '0.25rem'}}>
                <strong>Milestones Unlocked:</strong>{' '}
                {progress.unlockedMilestoneIds.length}
              </p>
              <p style={{marginBottom: 0}}>
                <strong>Recipes Unlocked:</strong> {progress.unlockedRecipeIds.length}
              </p>
            </>
          )}
        </article>

        <article style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Add Entry</h2>
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

        <article style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Import from World Bible</h2>
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
            Link Entity
          </button>
        </article>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1rem',
          alignItems: 'start'
        }}
      >
        <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Entries</h2>
          {entries.length === 0 && <p>No compendium entries yet.</p>}
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem'
                }}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', gap: '1rem'}}>
                  <div>
                    <strong>{entry.name}</strong>{' '}
                    <span style={{fontSize: '0.85rem', color: '#666'}}>
                      [{entry.domain}]
                    </span>
                    {entry.sourceEntityId && (
                      <div style={{fontSize: '0.8rem', color: '#666'}}>
                        Linked to World Bible entity
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                  {entry.actions.map((action) => {
                    const key = `${entry.id}:${action.id}`;
                    const alreadyDone = completedActionSet.has(key);
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
            ))}
          </ul>
        </section>

        <div style={{display: 'grid', gap: '1rem'}}>
          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Recipes</h2>
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

          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Craftability Preview</h2>
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
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              {recipes.map((recipe) => {
                const check = canCraftRecipe(recipe, {
                  progress,
                  characterLevel: Math.max(1, Math.floor(previewLevel || 1)),
                  availableMaterials: parsedPreviewMaterials
                });
                return (
                  <li
                    key={`preview-${recipe.id}`}
                    style={{
                      marginBottom: '0.5rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #efefef'
                    }}
                  >
                    <strong>{recipe.name}</strong>{' '}
                    <span
                      style={{
                        color: check.craftable ? '#166534' : '#991b1b'
                      }}
                    >
                      {check.craftable ? 'craftable' : 'not craftable'}
                    </span>
                    {!check.craftable && check.reasons.length > 0 && (
                      <div style={{fontSize: '0.82rem', color: '#6b7280'}}>
                        {check.reasons.join(' ')}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Zone Affinity</h2>
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
                    style={{
                      marginBottom: '0.65rem',
                      paddingBottom: '0.55rem',
                      borderBottom: '1px solid #efefef'
                    }}
                  >
                    <strong>{profile.name}</strong> ({percent.toFixed(1)}%)
                    <div style={{fontSize: '0.82rem', color: '#6b7280'}}>
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

          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Community / Logistics</h2>
            <p style={{marginTop: 0, fontSize: '0.85rem', color: '#6b7280'}}>
              Shared party synergy buffs driven by role combinations. Select the
              currently active party to preview concrete in-scene combo effects.
            </p>
            <div style={{fontSize: '0.85rem', marginBottom: '0.5rem'}}>
              <strong>Active Party Members</strong>
            </div>
            <div style={{display: 'grid', gap: '0.35rem', marginBottom: '0.8rem'}}>
              {characters.length === 0 ? (
                <div style={{fontSize: '0.82rem', color: '#6b7280'}}>
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
                      <span style={{fontSize: '0.8rem', color: '#6b7280'}}>
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
              {activePartySynergies.filter((item) => item.missingRoles.length === 0)
                .length === 0 ? (
                <li style={{fontSize: '0.82rem', color: '#6b7280'}}>
                  No active combos for the current party selection.
                </li>
              ) : (
                activePartySynergies
                  .filter((item) => item.missingRoles.length === 0)
                  .map((suggestion) => (
                    <li key={suggestion.ruleId} style={{marginBottom: '0.55rem'}}>
                      <strong>{suggestion.ruleName}</strong>
                      {suggestion.maxDistanceMeters ? (
                        <span style={{fontSize: '0.8rem', color: '#6b7280'}}>
                          {' '}
                          ({suggestion.maxDistanceMeters}m proximity)
                        </span>
                      ) : null}
                      <div style={{fontSize: '0.82rem'}}>{suggestion.effectDescription}</div>
                      <div style={{fontSize: '0.8rem', color: '#4b5563'}}>
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
                <li style={{fontSize: '0.82rem', color: '#6b7280'}}>
                  Full roster can already satisfy all default synergy rules.
                </li>
              ) : (
                rosterSynergyOpportunities.map((suggestion) => (
                  <li key={`roster-${suggestion.ruleId}`} style={{marginBottom: '0.55rem'}}>
                    <strong>{suggestion.ruleName}</strong>
                    <div style={{fontSize: '0.82rem'}}>{suggestion.effectDescription}</div>
                    <div style={{fontSize: '0.8rem', color: '#4b5563'}}>
                      {formatSynergyStatus(suggestion, characterById)}
                    </div>
                    {suggestion.questPrompt && (
                      <div style={{fontSize: '0.8rem', color: '#6b7280'}}>
                        Prompt seed: {suggestion.questPrompt}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Settlement Aura</h2>
            <p style={{marginTop: 0, fontSize: '0.85rem', color: '#6b7280'}}>
              Generalized settlement buffs. Trophies are one source type, alongside
              structures, stations, totems, and custom modules.
            </p>
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
              <strong>Fortress Level:</strong> {settlementState?.fortressLevel ?? 1}
            </div>
            <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.65rem'}}>
              <button
                type='button'
                onClick={() => void handleAdjustFortressLevel(-1)}
                disabled={!settlementState || settlementState.fortressLevel <= 1 || isSavingFortress}
              >
                - Level
              </button>
              <button
                type='button'
                onClick={() => void handleAdjustFortressLevel(1)}
                disabled={!settlementState || isSavingFortress}
              >
                + Level
              </button>
            </div>
            <div style={{fontSize: '0.82rem', color: '#4b5563', marginBottom: '0.6rem'}}>
              {nextFortressTier
                ? `Next tier at level ${nextFortressTier.levelRequired}: ${nextFortressTier.name}`
                : 'All configured fortress tiers unlocked.'}
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
              <strong>Fortress Tier Effects:</strong>{' '}
              {settlementComputedEffects.fortressEffects.length}
            </div>
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              {settlementComputedEffects.fortressEffects.length === 0 ? (
                <li style={{fontSize: '0.82rem', color: '#6b7280'}}>
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
                <li style={{fontSize: '0.82rem', color: '#6b7280'}}>
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
            <div style={{fontSize: '0.82rem', color: '#4b5563', marginBottom: '0.65rem'}}>
              Includes fortress progression + aura modules.
            </div>
            <div style={{fontSize: '0.85rem', marginBottom: '0.35rem'}}>
              <strong>Unlocked Fortress Tiers</strong>
            </div>
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              {unlockedFortressTiers.length === 0 ? (
                <li style={{fontSize: '0.82rem', color: '#6b7280'}}>None yet.</li>
              ) : (
                unlockedFortressTiers.map((tier) => (
                  <li key={tier.id} style={{marginBottom: '0.45rem'}}>
                    <strong>
                      L{tier.levelRequired} {tier.name}
                    </strong>
                    {tier.description && (
                      <div style={{fontSize: '0.8rem', color: '#6b7280'}}>
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
                <li style={{fontSize: '0.82rem', color: '#6b7280'}}>
                  No modules installed.
                </li>
              ) : (
                settlementModules.map((module) => (
                  <li key={module.id} style={{marginBottom: '0.45rem'}}>
                    <strong>{module.name}</strong>{' '}
                    <span style={{fontSize: '0.8rem', color: '#6b7280'}}>
                      [{module.sourceType}]
                    </span>
                    {module.effects.map((effect, effectIndex) => (
                      <div
                        key={`${module.id}-effect-${effectIndex}`}
                        style={{fontSize: '0.8rem', color: '#4b5563'}}
                      >
                        {formatSettlementEffectLabel(effect)}
                      </div>
                    ))}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Milestones</h2>
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
            <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
              {milestones.map((milestone) => (
                <li key={milestone.id} style={{marginBottom: '0.35rem'}}>
                  {unlockedMilestoneSet.has(milestone.id) ? 'Unlocked' : 'Locked'}:{' '}
                  {milestone.name} ({milestone.pointsRequired} pts)
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section style={{marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
        <h2 style={{marginTop: 0}}>Recent Actions</h2>
        {logs.length === 0 ? (
          <p>No actions logged yet.</p>
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
    </section>
  );
}

export default CompendiumRoute;
