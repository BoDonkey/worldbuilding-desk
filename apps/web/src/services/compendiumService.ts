import type {
  Character,
  CompendiumActionLog,
  CompendiumEntry,
  CompendiumDomain,
  CompendiumMilestone,
  CompendiumProgress,
  FortressTierDefinition,
  PartySynergyRule,
  PartySynergySuggestion,
  RecipeMaterialRequirement,
  WorldEntity,
  UnlockableRecipe,
  ZoneAffinityProfile,
  ZoneAffinityProgress,
  SettlementModule,
  SettlementState
} from '../entityTypes';
import {
  openDb,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME
} from '../db';

type RecordActionParams = {
  projectId: string;
  entryId: string;
  actionId: string;
  quantity?: number;
  characterSheetId?: string;
};

export interface RecordActionResult {
  log: CompendiumActionLog | null;
  progress: CompendiumProgress;
  unlockedMilestoneIds: string[];
  unlockedRecipeIds: string[];
}

export interface CraftingCheckContext {
  progress: Pick<CompendiumProgress, 'unlockedMilestoneIds' | 'unlockedRecipeIds'> | null;
  characterLevel: number;
  availableMaterials?: Record<string, number>;
}

export interface CraftingCheckResult {
  craftable: boolean;
  reasons: string[];
}

export interface RecordZoneExposureParams {
  projectId: string;
  biomeKey: string;
  exposureSeconds: number;
  pointsPerMinute?: number;
}

export interface RecordZoneExposureResult {
  profile: ZoneAffinityProfile;
  progress: ZoneAffinityProgress;
  unlockedMilestoneIds: string[];
}

export const DEFAULT_PARTY_SYNERGY_RULES: PartySynergyRule[] = [
  {
    id: 'chef-miner-logistics',
    name: 'Logistics Efficiency',
    requiredRoles: ['chef', 'miner'],
    maxDistanceMeters: 50,
    effectDescription: 'Raw ore carry weight reduced by 10%.',
    questPrompt:
      'Generate a duo logistics run where mining and food prep must be coordinated under time pressure.'
  },
  {
    id: 'hunter-tanner-provisioning',
    name: 'Field Provisioning',
    requiredRoles: ['hunter', 'tanner'],
    maxDistanceMeters: 60,
    effectDescription: 'Hide/meat processing speed increased by 15%.',
    questPrompt:
      'Generate a hunting expedition that rewards synchronized kill and skin windows.'
  },
  {
    id: 'scout-crafter-supplychain',
    name: 'Rapid Supply Chain',
    requiredRoles: ['scout', 'crafter'],
    maxDistanceMeters: 80,
    effectDescription: 'Workbench setup and deployable crafting time reduced by 12%.',
    questPrompt:
      'Generate a route-planning objective where scouting unlocks faster crafting opportunities.'
  }
];

export const DEFAULT_FORTRESS_TIERS: FortressTierDefinition[] = [
  {
    id: 'fortress-tier-2',
    levelRequired: 2,
    name: 'Palisade Camp',
    description: 'First defensive perimeter and basic organization bonuses.',
    effects: [
      {targetType: 'stat', targetId: 'defense', operation: 'add', value: 5},
      {targetType: 'resource', targetId: 'storage_capacity', operation: 'add', value: 25}
    ]
  },
  {
    id: 'fortress-tier-4',
    levelRequired: 4,
    name: 'Hardened Outpost',
    description: 'Specialized stations increase crafting and resilience.',
    effects: [
      {targetType: 'resource', targetId: 'crafting_throughput', operation: 'add', value: 10},
      {targetType: 'resistance', targetId: 'environmental', operation: 'add', value: 8}
    ]
  },
  {
    id: 'fortress-tier-6',
    levelRequired: 6,
    name: 'Fortified Settlement',
    description: 'Mature base infrastructure with stable morale and logistics.',
    effects: [
      {targetType: 'stat', targetId: 'morale', operation: 'add', value: 12},
      {targetType: 'resource', targetId: 'ore_carry_weight', operation: 'multiply', value: 0.9}
    ]
  }
];

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function progressIdFor(projectId: string, characterSheetId?: string): string {
  return characterSheetId
    ? `compendium:${projectId}:sheet:${characterSheetId}`
    : `compendium:${projectId}:global`;
}

function normalizeQuantity(quantity?: number): number {
  if (quantity === undefined) return 1;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive number');
  }
  return quantity;
}

function normalizeRole(role: string | undefined): string {
  return (role ?? '').trim().toLowerCase();
}

function createDefaultSettlementBaseStats(): SettlementState['baseStats'] {
  return {
    defense: 10,
    storageCapacity: 100,
    craftingThroughput: 100,
    morale: 50
  };
}

function normalizeSettlementState(state: SettlementState): SettlementState {
  return {
    ...state,
    fortressLevel: Math.max(1, Math.floor(state.fortressLevel || 1)),
    baseStats: {
      ...createDefaultSettlementBaseStats(),
      ...(state.baseStats ?? {})
    }
  };
}

export function getPartySynergySuggestions(params: {
  characters: Character[];
  rules?: PartySynergyRule[];
}): PartySynergySuggestion[] {
  const rules = params.rules ?? DEFAULT_PARTY_SYNERGY_RULES;
  const roleBuckets = new Map<string, string[]>();

  for (const character of params.characters) {
    const role = normalizeRole(character.fields.role);
    if (!role) continue;
    const existing = roleBuckets.get(role);
    if (existing) {
      existing.push(character.id);
    } else {
      roleBuckets.set(role, [character.id]);
    }
  }

  const suggestions: PartySynergySuggestion[] = [];
  for (const rule of rules) {
    const matchedCharacterIds: string[] = [];
    const missingRoles: string[] = [];
    for (const requiredRole of rule.requiredRoles) {
      const normalizedRole = normalizeRole(requiredRole);
      const matches = roleBuckets.get(normalizedRole);
      if (!matches || matches.length === 0) {
        missingRoles.push(requiredRole);
        continue;
      }
      matchedCharacterIds.push(matches[0]);
    }

    suggestions.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matchedCharacterIds,
      missingRoles,
      effectDescription: rule.effectDescription,
      questPrompt: rule.questPrompt,
      maxDistanceMeters: rule.maxDistanceMeters
    });
  }

  return suggestions;
}

export async function getCompendiumEntriesByProject(
  projectId: string
): Promise<CompendiumEntry[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ENTRY_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as CompendiumEntry[];
  return all
    .filter((entry) => entry.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCompendiumEntry(entry: CompendiumEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ENTRY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  await requestToPromise(store.put(entry));
}

export async function upsertCompendiumEntryFromEntity(params: {
  projectId: string;
  entity: WorldEntity;
  domain: CompendiumDomain;
  defaultActions?: CompendiumEntry['actions'];
}): Promise<CompendiumEntry> {
  const existing = (await getCompendiumEntriesByProject(params.projectId)).find(
    (entry) => entry.sourceEntityId === params.entity.id
  );
  const now = Date.now();
  const fallbackActions: CompendiumEntry['actions'] = [
    {id: 'discover', label: 'Discover', points: 1, repeatable: false}
  ];

  const entry: CompendiumEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    projectId: params.projectId,
    name: params.entity.name,
    domain: params.domain,
    sourceEntityId: params.entity.id,
    description:
      typeof params.entity.fields.description === 'string'
        ? params.entity.fields.description
        : undefined,
    tags: existing?.tags ?? [],
    actions: existing?.actions ?? params.defaultActions ?? fallbackActions,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  await saveCompendiumEntry(entry);
  return entry;
}

export async function deleteCompendiumEntry(entryId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ENTRY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  await requestToPromise(store.delete(entryId));
}

export async function getCompendiumMilestonesByProject(
  projectId: string
): Promise<CompendiumMilestone[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_MILESTONE_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_MILESTONE_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as CompendiumMilestone[];
  return all
    .filter((milestone) => milestone.projectId === projectId)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
}

export async function saveCompendiumMilestone(
  milestone: CompendiumMilestone
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_MILESTONE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_MILESTONE_STORE_NAME);
  await requestToPromise(store.put(milestone));
}

export async function getRecipesByProject(
  projectId: string
): Promise<UnlockableRecipe[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_RECIPE_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_RECIPE_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as UnlockableRecipe[];
  return all
    .filter((recipe) => recipe.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveUnlockableRecipe(recipe: UnlockableRecipe): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_RECIPE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_RECIPE_STORE_NAME);
  await requestToPromise(store.put(recipe));
}

function hasMaterial(
  requirements: RecipeMaterialRequirement[] | undefined,
  availableMaterials: Record<string, number>
): string[] {
  const failures: string[] = [];
  for (const requirement of requirements ?? []) {
    const available = availableMaterials[requirement.itemId] ?? 0;
    if (available < requirement.quantity) {
      failures.push(
        `Requires ${requirement.quantity}x ${requirement.itemId} (have ${available}).`
      );
    }
  }
  return failures;
}

export function canCraftRecipe(
  recipe: UnlockableRecipe,
  context: CraftingCheckContext
): CraftingCheckResult {
  const reasons: string[] = [];
  const requirements = recipe.requirements;
  const unlockedMilestones = new Set(context.progress?.unlockedMilestoneIds ?? []);
  const unlockedRecipes = new Set(context.progress?.unlockedRecipeIds ?? []);

  if (
    requirements?.minCharacterLevel !== undefined &&
    context.characterLevel < requirements.minCharacterLevel
  ) {
    reasons.push(
      `Requires character level ${requirements.minCharacterLevel} (current ${context.characterLevel}).`
    );
  }

  for (const milestoneId of requirements?.requiredMilestoneIds ?? []) {
    if (!unlockedMilestones.has(milestoneId)) {
      reasons.push(`Requires milestone "${milestoneId}".`);
    }
  }

  if (!unlockedRecipes.has(recipe.id)) {
    reasons.push('Recipe is not unlocked yet.');
  }

  if (requirements?.requiredMaterials?.length) {
    const materialFailures = hasMaterial(
      requirements.requiredMaterials,
      context.availableMaterials ?? {}
    );
    reasons.push(...materialFailures);
  }

  return {
    craftable: reasons.length === 0,
    reasons
  };
}

export async function getCompendiumProgress(
  projectId: string,
  characterSheetId?: string
): Promise<CompendiumProgress> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_PROGRESS_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_PROGRESS_STORE_NAME);
  const id = progressIdFor(projectId, characterSheetId);
  const existing = (await requestToPromise(
    store.get(id)
  )) as CompendiumProgress | undefined;

  if (existing) {
    return existing;
  }

  const created: CompendiumProgress = {
    id,
    projectId,
    characterSheetId,
    totalPoints: 0,
    unlockedMilestoneIds: [],
    unlockedRecipeIds: [],
    updatedAt: Date.now()
  };
  await requestToPromise(store.put(created));
  return created;
}

export async function getCompendiumActionLogs(
  projectId: string,
  characterSheetId?: string
): Promise<CompendiumActionLog[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ACTION_LOG_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_ACTION_LOG_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as CompendiumActionLog[];
  const targetProgressId = progressIdFor(projectId, characterSheetId);
  return all
    .filter(
      (log) => log.projectId === projectId && log.progressId === targetProgressId
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function recordCompendiumAction(
  params: RecordActionParams
): Promise<RecordActionResult> {
  const quantity = normalizeQuantity(params.quantity);
  const progressId = progressIdFor(params.projectId, params.characterSheetId);
  const db = await openDb();
  const tx = db.transaction(
    [
      COMPENDIUM_ENTRY_STORE_NAME,
      COMPENDIUM_PROGRESS_STORE_NAME,
      COMPENDIUM_MILESTONE_STORE_NAME,
      COMPENDIUM_ACTION_LOG_STORE_NAME
    ],
    'readwrite'
  );

  const entryStore = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  const progressStore = tx.objectStore(COMPENDIUM_PROGRESS_STORE_NAME);
  const milestoneStore = tx.objectStore(COMPENDIUM_MILESTONE_STORE_NAME);
  const actionLogStore = tx.objectStore(COMPENDIUM_ACTION_LOG_STORE_NAME);

  const entry = (await requestToPromise(
    entryStore.get(params.entryId)
  )) as CompendiumEntry | undefined;
  if (!entry || entry.projectId !== params.projectId) {
    throw new Error('Compendium entry not found for project');
  }

  const action = entry.actions.find((item) => item.id === params.actionId);
  if (!action) {
    throw new Error('Action is not defined for this entry');
  }

  const existingProgress = (await requestToPromise(
    progressStore.get(progressId)
  )) as CompendiumProgress | undefined;
  const progress: CompendiumProgress =
    existingProgress ??
    {
      id: progressId,
      projectId: params.projectId,
      characterSheetId: params.characterSheetId,
      totalPoints: 0,
      unlockedMilestoneIds: [],
      unlockedRecipeIds: [],
      updatedAt: Date.now()
    };

  if (!action.repeatable) {
    const logs = (await requestToPromise(
      actionLogStore.getAll()
    )) as CompendiumActionLog[];
    const alreadyRecorded = logs.some(
      (log) =>
        log.progressId === progress.id &&
        log.entryId === params.entryId &&
        log.actionId === params.actionId
    );
    if (alreadyRecorded) {
      progress.updatedAt = Date.now();
      await requestToPromise(progressStore.put(progress));
      return {
        log: null,
        progress,
        unlockedMilestoneIds: [],
        unlockedRecipeIds: []
      };
    }
  }

  const pointsAwarded = action.points * quantity;
  progress.totalPoints += pointsAwarded;

  const milestones = (await requestToPromise(
    milestoneStore.getAll()
  )) as CompendiumMilestone[];
  const projectMilestones = milestones
    .filter((milestone) => milestone.projectId === params.projectId)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
  const unlockedMilestoneSet = new Set(progress.unlockedMilestoneIds);
  const unlockedRecipeSet = new Set(progress.unlockedRecipeIds);
  const unlockedMilestoneIds: string[] = [];
  const unlockedRecipeIds: string[] = [];

  for (const milestone of projectMilestones) {
    if (milestone.pointsRequired > progress.totalPoints) {
      continue;
    }
    if (unlockedMilestoneSet.has(milestone.id)) {
      continue;
    }
    unlockedMilestoneSet.add(milestone.id);
    unlockedMilestoneIds.push(milestone.id);
    for (const recipeId of milestone.unlockRecipeIds ?? []) {
      if (!unlockedRecipeSet.has(recipeId)) {
        unlockedRecipeSet.add(recipeId);
        unlockedRecipeIds.push(recipeId);
      }
    }
  }

  progress.unlockedMilestoneIds = Array.from(unlockedMilestoneSet);
  progress.unlockedRecipeIds = Array.from(unlockedRecipeSet);
  progress.updatedAt = Date.now();

  const log: CompendiumActionLog = {
    id: crypto.randomUUID(),
    projectId: params.projectId,
    progressId,
    entryId: params.entryId,
    actionId: params.actionId,
    quantity,
    pointsAwarded,
    createdAt: Date.now()
  };

  await requestToPromise(actionLogStore.put(log));
  await requestToPromise(progressStore.put(progress));

  return {
    log,
    progress,
    unlockedMilestoneIds,
    unlockedRecipeIds
  };
}

export function getZoneAffinityPercent(
  progress: ZoneAffinityProgress,
  profile: ZoneAffinityProfile
): number {
  if (profile.maxAffinityPoints <= 0) return 0;
  return Math.min(100, (progress.affinityPoints / profile.maxAffinityPoints) * 100);
}

function zoneProfileId(projectId: string, biomeKey: string): string {
  return `zone-profile:${projectId}:${biomeKey}`;
}

function zoneProgressId(projectId: string, biomeKey: string): string {
  return `zone-progress:${projectId}:${biomeKey}`;
}

export async function getZoneAffinityProfilesByProject(
  projectId: string
): Promise<ZoneAffinityProfile[]> {
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROFILE_STORE_NAME, 'readonly');
  const store = tx.objectStore(ZONE_AFFINITY_PROFILE_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as ZoneAffinityProfile[];
  return all
    .filter((profile) => profile.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveZoneAffinityProfile(
  profile: ZoneAffinityProfile
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROFILE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROFILE_STORE_NAME);
  await requestToPromise(store.put(profile));
}

export async function upsertZoneAffinityProfile(params: {
  projectId: string;
  biomeKey: string;
  name: string;
  maxAffinityPoints?: number;
  milestones?: ZoneAffinityProfile['milestones'];
}): Promise<ZoneAffinityProfile> {
  const id = zoneProfileId(params.projectId, params.biomeKey);
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROFILE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROFILE_STORE_NAME);
  const existing = (await requestToPromise(
    store.get(id)
  )) as ZoneAffinityProfile | undefined;
  const now = Date.now();
  const next: ZoneAffinityProfile = {
    id,
    projectId: params.projectId,
    biomeKey: params.biomeKey,
    name: params.name,
    maxAffinityPoints: params.maxAffinityPoints ?? existing?.maxAffinityPoints ?? 100,
    milestones: params.milestones ?? existing?.milestones ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await requestToPromise(store.put(next));
  return next;
}

export async function getZoneAffinityProgressByProject(
  projectId: string
): Promise<ZoneAffinityProgress[]> {
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROGRESS_STORE_NAME, 'readonly');
  const store = tx.objectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as ZoneAffinityProgress[];
  return all
    .filter((progress) => progress.projectId === projectId)
    .sort((a, b) => b.affinityPoints - a.affinityPoints);
}

export async function getZoneAffinityProgress(
  projectId: string,
  biomeKey: string
): Promise<ZoneAffinityProgress> {
  const id = zoneProgressId(projectId, biomeKey);
  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROGRESS_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME);
  const existing = (await requestToPromise(
    store.get(id)
  )) as ZoneAffinityProgress | undefined;
  if (existing) return existing;
  const created: ZoneAffinityProgress = {
    id,
    projectId,
    biomeKey,
    affinityPoints: 0,
    totalExposureSeconds: 0,
    unlockedMilestoneIds: [],
    updatedAt: Date.now()
  };
  await requestToPromise(store.put(created));
  return created;
}

export async function recordZoneExposure(
  params: RecordZoneExposureParams
): Promise<RecordZoneExposureResult> {
  if (!Number.isFinite(params.exposureSeconds) || params.exposureSeconds <= 0) {
    throw new Error('exposureSeconds must be a positive number');
  }

  const profiles = await getZoneAffinityProfilesByProject(params.projectId);
  const profile = profiles.find((item) => item.biomeKey === params.biomeKey);
  if (!profile) {
    throw new Error(`Zone affinity profile not found for biome "${params.biomeKey}"`);
  }

  const pointsPerMinute = params.pointsPerMinute ?? 1;
  const pointsToAdd = (params.exposureSeconds / 60) * pointsPerMinute;
  const progress = await getZoneAffinityProgress(params.projectId, params.biomeKey);

  const unlockedMilestoneSet = new Set(progress.unlockedMilestoneIds);
  const unlockedMilestoneIds: string[] = [];
  const nextProgress: ZoneAffinityProgress = {
    ...progress,
    affinityPoints: Math.max(0, progress.affinityPoints + pointsToAdd),
    totalExposureSeconds: progress.totalExposureSeconds + params.exposureSeconds,
    updatedAt: Date.now()
  };

  const nextPercent = getZoneAffinityPercent(nextProgress, profile);
  for (const milestone of profile.milestones) {
    if (nextPercent >= milestone.thresholdPercent) {
      if (!unlockedMilestoneSet.has(milestone.id)) {
        unlockedMilestoneSet.add(milestone.id);
        unlockedMilestoneIds.push(milestone.id);
      }
    }
  }
  nextProgress.unlockedMilestoneIds = Array.from(unlockedMilestoneSet);

  const db = await openDb();
  const tx = db.transaction(ZONE_AFFINITY_PROGRESS_STORE_NAME, 'readwrite');
  const store = tx.objectStore(ZONE_AFFINITY_PROGRESS_STORE_NAME);
  await requestToPromise(store.put(nextProgress));

  return {
    profile,
    progress: nextProgress,
    unlockedMilestoneIds
  };
}

function settlementStateId(projectId: string): string {
  return `settlement:${projectId}`;
}

export async function getSettlementModulesByProject(
  projectId: string
): Promise<SettlementModule[]> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_MODULE_STORE_NAME, 'readonly');
  const store = tx.objectStore(SETTLEMENT_MODULE_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as SettlementModule[];
  return all
    .filter((module) => module.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveSettlementModule(module: SettlementModule): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_MODULE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SETTLEMENT_MODULE_STORE_NAME);
  await requestToPromise(store.put(module));
}

export async function getOrCreateSettlementState(
  projectId: string,
  name = 'Main Base'
): Promise<SettlementState> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_STATE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SETTLEMENT_STATE_STORE_NAME);
  const id = settlementStateId(projectId);
  const existing = (await requestToPromise(
    store.get(id)
  )) as SettlementState | undefined;
  if (existing) {
    const normalizedExisting = normalizeSettlementState(existing);
    if (JSON.stringify(normalizedExisting) !== JSON.stringify(existing)) {
      await requestToPromise(store.put(normalizedExisting));
    }
    return normalizedExisting;
  }
  const created: SettlementState = {
    id,
    projectId,
    name,
    fortressLevel: 1,
    baseStats: createDefaultSettlementBaseStats(),
    moduleIds: [],
    updatedAt: Date.now()
  };
  await requestToPromise(store.put(created));
  return created;
}

export async function saveSettlementState(state: SettlementState): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SETTLEMENT_STATE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SETTLEMENT_STATE_STORE_NAME);
  await requestToPromise(store.put(normalizeSettlementState(state)));
}

export async function updateSettlementFortressLevel(params: {
  projectId: string;
  level: number;
}): Promise<SettlementState> {
  const state = await getOrCreateSettlementState(params.projectId);
  const next: SettlementState = {
    ...state,
    fortressLevel: Math.max(1, Math.floor(params.level)),
    updatedAt: Date.now()
  };
  await saveSettlementState(next);
  return next;
}

export async function updateSettlementBaseStats(params: {
  projectId: string;
  baseStats: Partial<SettlementState['baseStats']>;
}): Promise<SettlementState> {
  const state = await getOrCreateSettlementState(params.projectId);
  const next: SettlementState = {
    ...state,
    baseStats: {
      ...state.baseStats,
      ...params.baseStats
    },
    updatedAt: Date.now()
  };
  await saveSettlementState(next);
  return next;
}

export async function attachModuleToSettlement(params: {
  projectId: string;
  moduleId: string;
}): Promise<SettlementState> {
  const state = await getOrCreateSettlementState(params.projectId);
  if (state.moduleIds.includes(params.moduleId)) {
    return state;
  }
  const next: SettlementState = {
    ...state,
    moduleIds: [...state.moduleIds, params.moduleId],
    updatedAt: Date.now()
  };
  await saveSettlementState(next);
  return next;
}

export function getActiveSettlementAuraEffects(params: {
  settlementState: SettlementState;
  modules: SettlementModule[];
}): SettlementModule['effects'] {
  const moduleSet = new Set(params.settlementState.moduleIds);
  const activeModules = params.modules.filter(
    (module) => module.active && moduleSet.has(module.id)
  );
  return activeModules.flatMap((module) => module.effects);
}

export function getUnlockedFortressTiers(params: {
  fortressLevel: number;
  tiers?: FortressTierDefinition[];
}): FortressTierDefinition[] {
  const tiers = params.tiers ?? DEFAULT_FORTRESS_TIERS;
  return tiers
    .filter((tier) => params.fortressLevel >= tier.levelRequired)
    .sort((a, b) => a.levelRequired - b.levelRequired);
}

export function getNextFortressTier(params: {
  fortressLevel: number;
  tiers?: FortressTierDefinition[];
}): FortressTierDefinition | null {
  const tiers = params.tiers ?? DEFAULT_FORTRESS_TIERS;
  return (
    tiers
      .filter((tier) => tier.levelRequired > params.fortressLevel)
      .sort((a, b) => a.levelRequired - b.levelRequired)[0] ?? null
  );
}

export function getSettlementComputedEffects(params: {
  settlementState: SettlementState;
  modules: SettlementModule[];
  tiers?: FortressTierDefinition[];
}): {
  auraEffects: SettlementModule['effects'];
  fortressEffects: SettlementModule['effects'];
  allEffects: SettlementModule['effects'];
} {
  const auraEffects = getActiveSettlementAuraEffects({
    settlementState: params.settlementState,
    modules: params.modules
  });
  const unlockedTiers = getUnlockedFortressTiers({
    fortressLevel: params.settlementState.fortressLevel,
    tiers: params.tiers
  });
  const fortressEffects = unlockedTiers.flatMap((tier) => tier.effects);
  return {
    auraEffects,
    fortressEffects,
    allEffects: [...fortressEffects, ...auraEffects]
  };
}
