import type {
  Character,
  CompendiumProgress,
  FortressTierDefinition,
  PartySynergyRule,
  PartySynergySuggestion,
  RecipeMaterialRequirement,
  UnlockableRecipe,
  ZoneAffinityProfile,
  ZoneAffinityProgress,
  SettlementModule,
  SettlementState
} from '../../entityTypes';

/*
 * Pure compendium mechanics (split from compendiumService in 3.22): party
 * synergy, settlement normalization and effects, runtime modifiers, crafting
 * checks, and zone affinity percent. No storage access.
 */

export interface CraftingCheckContext {
  progress: Pick<CompendiumProgress, 'unlockedMilestoneIds' | 'unlockedRecipeIds'> | null;
  characterLevel: number;
  availableMaterials?: Record<string, number>;
  runtime?: CraftingRuntimeModifiers;
}

export interface CraftingCheckResult {
  craftable: boolean;
  reasons: string[];
  effectiveCharacterLevel: number;
  materialCostMultiplier: number;
  adjustedMaterialRequirements: RecipeMaterialRequirement[];
  appliedRuntimeNotes: string[];
}

export interface CraftingRuntimeModifiers {
  levelBonus: number;
  materialCostMultiplier: number;
  notes: string[];
}

interface NumericRuntimeModifier {
  add: number;
  multiply: number;
  set?: number;
}

export interface CharacterRuntimeModifiers {
  statModifiers: Record<string, NumericRuntimeModifier>;
  resourceModifiers: Record<string, NumericRuntimeModifier>;
  levelBonus: number;
  notes: string[];
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

function normalizeRole(role: string | undefined): string {
  return (role ?? '').trim().toLowerCase();
}

export function createDefaultSettlementBaseStats(): SettlementState['baseStats'] {
  return {
    defense: 10,
    storageCapacity: 100,
    craftingThroughput: 100,
    morale: 50
  };
}

const SETTLEMENT_BASE_STAT_LIMITS: Record<
  keyof SettlementState['baseStats'],
  {min: number; max: number}
> = {
  defense: {min: 0, max: 100000},
  storageCapacity: {min: 0, max: 100000},
  craftingThroughput: {min: 0, max: 100000},
  morale: {min: 0, max: 100000}
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeSettlementBaseStats(
  input?: Partial<SettlementState['baseStats']>
): SettlementState['baseStats'] {
  const defaults = createDefaultSettlementBaseStats();
  return {
    defense: clampNumber(
      Number.isFinite(input?.defense) ? Number(input?.defense) : defaults.defense,
      SETTLEMENT_BASE_STAT_LIMITS.defense.min,
      SETTLEMENT_BASE_STAT_LIMITS.defense.max
    ),
    storageCapacity: clampNumber(
      Number.isFinite(input?.storageCapacity)
        ? Number(input?.storageCapacity)
        : defaults.storageCapacity,
      SETTLEMENT_BASE_STAT_LIMITS.storageCapacity.min,
      SETTLEMENT_BASE_STAT_LIMITS.storageCapacity.max
    ),
    craftingThroughput: clampNumber(
      Number.isFinite(input?.craftingThroughput)
        ? Number(input?.craftingThroughput)
        : defaults.craftingThroughput,
      SETTLEMENT_BASE_STAT_LIMITS.craftingThroughput.min,
      SETTLEMENT_BASE_STAT_LIMITS.craftingThroughput.max
    ),
    morale: clampNumber(
      Number.isFinite(input?.morale) ? Number(input?.morale) : defaults.morale,
      SETTLEMENT_BASE_STAT_LIMITS.morale.min,
      SETTLEMENT_BASE_STAT_LIMITS.morale.max
    )
  };
}

export function normalizeSettlementState(state: SettlementState): SettlementState {
  return {
    ...state,
    fortressLevel: Math.max(1, Math.floor(state.fortressLevel || 1)),
    baseStats: normalizeSettlementBaseStats(state.baseStats ?? {})
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

function applyMaterialCostMultiplier(
  requirements: RecipeMaterialRequirement[] | undefined,
  multiplier: number
): RecipeMaterialRequirement[] {
  const safeMultiplier = Number.isFinite(multiplier) ? Math.max(0.1, multiplier) : 1;
  return (requirements ?? []).map((requirement) => ({
    ...requirement,
    quantity: Math.max(1, Math.ceil(requirement.quantity * safeMultiplier))
  }));
}

function applyNumericModifier(
  value: number,
  modifier: NumericRuntimeModifier | undefined
): number {
  if (!modifier) return value;
  let next = value;
  if (modifier.set !== undefined) {
    next = modifier.set;
  }
  next += modifier.add;
  next *= modifier.multiply;
  return Math.round(next * 100) / 100;
}

function upsertNumericModifier(
  bucket: Record<string, NumericRuntimeModifier>,
  effect: SettlementModule['effects'][number]
): void {
  if (typeof effect.value !== 'number') return;
  const key = effect.targetId;
  const existing = bucket[key] ?? {add: 0, multiply: 1};
  if (effect.operation === 'add') {
    existing.add += effect.value;
  } else if (effect.operation === 'multiply') {
    existing.multiply *= effect.value;
  } else if (effect.operation === 'set') {
    existing.set = effect.value;
  }
  bucket[key] = existing;
}

export function deriveCharacterRuntimeModifiers(params: {
  settlementState: SettlementState | null;
  settlementModules: SettlementModule[];
  activePartySynergies?: PartySynergySuggestion[];
}): CharacterRuntimeModifiers {
  if (!params.settlementState) {
    return {
      statModifiers: {},
      resourceModifiers: {},
      levelBonus: 0,
      notes: []
    };
  }

  const computed = getSettlementComputedEffects({
    settlementState: normalizeSettlementState(params.settlementState),
    modules: params.settlementModules
  });
  const statModifiers: Record<string, NumericRuntimeModifier> = {};
  const resourceModifiers: Record<string, NumericRuntimeModifier> = {};
  const notes: string[] = [];

  for (const effect of computed.allEffects) {
    if (effect.targetType === 'stat') {
      upsertNumericModifier(statModifiers, effect);
      notes.push(`Stat effect ${effect.targetId} (${effect.operation}) active.`);
    } else if (effect.targetType === 'resource') {
      upsertNumericModifier(resourceModifiers, effect);
      notes.push(`Resource effect ${effect.targetId} (${effect.operation}) active.`);
    }
  }

  const activeSynergies = (params.activePartySynergies ?? []).filter(
    (synergy) => synergy.missingRoles.length === 0
  );
  const levelBonus = Math.min(2, activeSynergies.length);
  if (levelBonus > 0) {
    notes.push(`Party synergy grants +${levelBonus} effective level.`);
  }

  return {
    statModifiers,
    resourceModifiers,
    levelBonus,
    notes
  };
}

export function getEffectiveStatValue(params: {
  definitionId: string;
  baseValue: number;
  runtime: CharacterRuntimeModifiers;
}): number {
  return applyNumericModifier(
    params.baseValue,
    params.runtime.statModifiers[params.definitionId]
  );
}

export function getEffectiveResourceValues(params: {
  definitionId: string;
  current: number;
  max: number;
  runtime: CharacterRuntimeModifiers;
}): {current: number; max: number} {
  const modifier = params.runtime.resourceModifiers[params.definitionId];
  return {
    current: applyNumericModifier(params.current, modifier),
    max: applyNumericModifier(params.max, modifier)
  };
}

export function deriveCraftingRuntimeModifiers(params: {
  settlementState: SettlementState | null;
  settlementModules: SettlementModule[];
  activePartySynergies?: PartySynergySuggestion[];
}): CraftingRuntimeModifiers {
  let levelBonus = 0;
  let materialCostMultiplier = 1;
  const notes: string[] = [];

  if (!params.settlementState) {
    return {levelBonus, materialCostMultiplier, notes};
  }

  const normalizedState = normalizeSettlementState(params.settlementState);
  const computed = getSettlementComputedEffects({
    settlementState: normalizedState,
    modules: params.settlementModules
  });

  const throughputDelta = normalizedState.baseStats.craftingThroughput - 100;
  if (throughputDelta > 0) {
    const throughputBonus = Math.floor(throughputDelta / 25);
    if (throughputBonus > 0) {
      levelBonus += throughputBonus;
      notes.push(
        `Base crafting throughput grants +${throughputBonus} effective crafting level.`
      );
    }
  }

  for (const effect of computed.allEffects) {
    if (typeof effect.value !== 'number') continue;
    if (effect.targetId === 'crafting_throughput') {
      if (effect.operation === 'add') {
        materialCostMultiplier *= clampNumber(1 - effect.value / 200, 0.5, 2);
      } else if (effect.operation === 'multiply') {
        materialCostMultiplier *= clampNumber(1 / effect.value, 0.5, 2);
      } else if (effect.operation === 'set') {
        materialCostMultiplier = clampNumber(effect.value, 0.5, 2);
      }
      notes.push(`Applied "${effect.targetId}" effect (${effect.operation}).`);
      continue;
    }

    if (
      effect.targetId === 'crafting_level_bonus' ||
      effect.targetId === 'crafting_level'
    ) {
      if (effect.operation === 'add') {
        levelBonus += Math.floor(effect.value);
      } else if (effect.operation === 'multiply') {
        levelBonus = Math.floor(levelBonus * effect.value);
      } else if (effect.operation === 'set') {
        levelBonus = Math.floor(effect.value);
      }
      notes.push(`Applied "${effect.targetId}" effect (${effect.operation}).`);
    }
  }

  const activeSynergies = (params.activePartySynergies ?? []).filter(
    (synergy) => synergy.missingRoles.length === 0
  );
  if (activeSynergies.length > 0) {
    const synergyLevelBonus = Math.min(2, activeSynergies.length);
    levelBonus += synergyLevelBonus;
    materialCostMultiplier *= clampNumber(1 - activeSynergies.length * 0.02, 0.9, 1);
    notes.push(
      `${activeSynergies.length} active party synergy combo(s) applied to crafting.`
    );
  }

  return {
    levelBonus,
    materialCostMultiplier: clampNumber(materialCostMultiplier, 0.5, 2),
    notes
  };
}

export function canCraftRecipe(
  recipe: UnlockableRecipe,
  context: CraftingCheckContext
): CraftingCheckResult {
  const reasons: string[] = [];
  const requirements = recipe.requirements;
  const unlockedMilestones = new Set(context.progress?.unlockedMilestoneIds ?? []);
  const unlockedRecipes = new Set(context.progress?.unlockedRecipeIds ?? []);
  const runtimeLevelBonus = Math.floor(context.runtime?.levelBonus ?? 0);
  const effectiveCharacterLevel = Math.max(1, context.characterLevel + runtimeLevelBonus);
  const materialCostMultiplier = clampNumber(
    context.runtime?.materialCostMultiplier ?? 1,
    0.1,
    10
  );
  const adjustedMaterialRequirements = applyMaterialCostMultiplier(
    requirements?.requiredMaterials,
    materialCostMultiplier
  );

  if (
    requirements?.minCharacterLevel !== undefined &&
    effectiveCharacterLevel < requirements.minCharacterLevel
  ) {
    reasons.push(
      `Requires character level ${requirements.minCharacterLevel} (effective ${effectiveCharacterLevel}).`
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

  if (adjustedMaterialRequirements.length > 0) {
    const materialFailures = hasMaterial(
      adjustedMaterialRequirements,
      context.availableMaterials ?? {}
    );
    reasons.push(...materialFailures);
  }

  return {
    craftable: reasons.length === 0,
    reasons,
    effectiveCharacterLevel,
    materialCostMultiplier,
    adjustedMaterialRequirements,
    appliedRuntimeNotes: context.runtime?.notes ?? []
  };
}

export function getZoneAffinityPercent(
  progress: ZoneAffinityProgress,
  profile: ZoneAffinityProfile
): number {
  if (profile.maxAffinityPoints <= 0) return 0;
  return Math.min(100, (progress.affinityPoints / profile.maxAffinityPoints) * 100);
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
