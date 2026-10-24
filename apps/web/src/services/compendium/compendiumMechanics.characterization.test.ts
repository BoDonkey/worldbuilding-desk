import {describe, expect, it} from 'vitest';
import type {
  Character,
  FortressTierDefinition,
  PartySynergySuggestion,
  SettlementModule,
  SettlementState,
  UnlockableRecipe
} from '../../entityTypes';
import {
  canCraftRecipe,
  DEFAULT_FORTRESS_TIERS,
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  deriveCraftingRuntimeModifiers,
  getActiveSettlementAuraEffects,
  getEffectiveResourceValues,
  getEffectiveStatValue,
  getNextFortressTier,
  getPartySynergySuggestions,
  getSettlementComputedEffects,
  getUnlockedFortressTiers,
  getZoneAffinityPercent
} from './index';

/*
 * Characterization tests (3.22) for the compendium's pure mechanics. They pin
 * current arithmetic, ordering, and clamping, including quirks, ahead of the
 * responsibility split. Changing any expected value here is a behavior change.
 */

const state = (overrides: Partial<SettlementState> = {}): SettlementState => ({
  id: 's', projectId: 'p', name: 'Base', fortressLevel: 1, moduleIds: [], updatedAt: 1,
  baseStats: {defense: 10, storageCapacity: 100, craftingThroughput: 100, morale: 50},
  ...overrides
});

const module = (id: string, effects: SettlementModule['effects'], active = true): SettlementModule => ({
  id, projectId: 'p', name: id, sourceType: 'structure', auraRadiusMeters: 10, effects, active, createdAt: 1, updatedAt: 1
});

const synergy = (ruleId: string, missingRoles: string[] = []): PartySynergySuggestion => ({
  ruleId, ruleName: ruleId, matchedCharacterIds: [], missingRoles, effectDescription: ''
});

const character = (id: string, role?: string): Character =>
  ({id, projectId: 'p', name: id, fields: role === undefined ? {} : {role}}) as unknown as Character;

describe('party synergy suggestions', () => {
  it('matches roles case- and space-insensitively, takes the first character per role, and lists missing roles', () => {
    const suggestions = getPartySynergySuggestions({
      characters: [character('c1', ' Chef '), character('c2', 'chef'), character('c3', 'MINER'), character('c4'), character('c5', 'scout')]
    });

    expect(suggestions.map((item) => item.ruleId)).toEqual(DEFAULT_PARTY_SYNERGY_RULES.map((rule) => rule.id));
    expect(suggestions[0]).toMatchObject({ruleId: 'chef-miner-logistics', matchedCharacterIds: ['c1', 'c3'], missingRoles: [], maxDistanceMeters: 50});
    expect(suggestions[1]).toMatchObject({matchedCharacterIds: [], missingRoles: ['hunter', 'tanner']});
    expect(suggestions[2]).toMatchObject({matchedCharacterIds: ['c5'], missingRoles: ['crafter']});
  });
});

describe('fortress tiers and settlement effects', () => {
  it('unlocks tiers at or below the level, in level order, and finds the next tier', () => {
    expect(getUnlockedFortressTiers({fortressLevel: 1})).toEqual([]);
    expect(getUnlockedFortressTiers({fortressLevel: 4}).map((tier) => tier.id)).toEqual(['fortress-tier-2', 'fortress-tier-4']);
    expect(getNextFortressTier({fortressLevel: 4})?.id).toBe('fortress-tier-6');
    expect(getNextFortressTier({fortressLevel: 6})).toBeNull();

    const tiers: FortressTierDefinition[] = [
      {id: 'b', levelRequired: 5, name: 'B', description: '', effects: []},
      {id: 'a', levelRequired: 3, name: 'A', description: '', effects: []}
    ];
    expect(getUnlockedFortressTiers({fortressLevel: 9, tiers}).map((tier) => tier.id)).toEqual(['a', 'b']);
  });

  it('applies only active modules attached to the settlement, fortress effects first', () => {
    const forge = module('forge', [{targetType: 'stat', targetId: 'might', operation: 'add', value: 2}]);
    const idle = module('idle', [{targetType: 'stat', targetId: 'might', operation: 'add', value: 9}], false);
    const unattached = module('loose', [{targetType: 'stat', targetId: 'might', operation: 'add', value: 7}]);
    const settlement = state({fortressLevel: 2, moduleIds: ['forge', 'idle']});

    expect(getActiveSettlementAuraEffects({settlementState: settlement, modules: [forge, idle, unattached]})).toEqual(forge.effects);
    const computed = getSettlementComputedEffects({settlementState: settlement, modules: [forge, idle, unattached]});
    expect(computed.fortressEffects).toEqual(DEFAULT_FORTRESS_TIERS[0].effects);
    expect(computed.allEffects).toEqual([...DEFAULT_FORTRESS_TIERS[0].effects, ...forge.effects]);
  });
});

describe('character runtime modifiers', () => {
  it('returns no modifiers without a settlement', () => {
    expect(deriveCharacterRuntimeModifiers({settlementState: null, settlementModules: [], activePartySynergies: [synergy('a')]}))
      .toEqual({statModifiers: {}, resourceModifiers: {}, levelBonus: 0, notes: []});
  });

  it('folds stat and resource effects into add/multiply/set buckets and caps the synergy level bonus at 2', () => {
    const runtime = deriveCharacterRuntimeModifiers({
      settlementState: state({fortressLevel: 6, moduleIds: ['totem']}),
      settlementModules: [module('totem', [
        {targetType: 'stat', targetId: 'defense', operation: 'multiply', value: 2},
        {targetType: 'stat', targetId: 'morale', operation: 'set', value: 40},
        {targetType: 'resistance', targetId: 'fire', operation: 'add', value: 5},
        {targetType: 'stat', targetId: 'luck', operation: 'add', value: 'high'}
      ])],
      activePartySynergies: [synergy('a'), synergy('b'), synergy('c'), synergy('d', ['miner'])]
    });

    expect(runtime.statModifiers).toEqual({
      defense: {add: 5, multiply: 2},
      morale: {add: 12, multiply: 1, set: 40}
    });
    expect(runtime.resourceModifiers).toEqual({
      storage_capacity: {add: 25, multiply: 1},
      crafting_throughput: {add: 10, multiply: 1},
      ore_carry_weight: {add: 0, multiply: 0.9}
    });
    expect(runtime.levelBonus).toBe(2);
    // Quirk: a non-numeric effect still adds a note even though it changes nothing.
    expect(runtime.notes).toContain('Stat effect luck (add) active.');
    expect(runtime.notes.at(-1)).toBe('Party synergy grants +2 effective level.');
  });

  it('applies set, then add, then multiply, rounded to two decimals', () => {
    const runtime = {
      statModifiers: {might: {add: 1.005, multiply: 3}, grit: {add: 2, multiply: 0.5, set: 10}},
      resourceModifiers: {hp: {add: 5, multiply: 1.1}},
      levelBonus: 0,
      notes: []
    };
    expect(getEffectiveStatValue({definitionId: 'might', baseValue: 10, runtime})).toBe(33.02);
    expect(getEffectiveStatValue({definitionId: 'grit', baseValue: 99, runtime})).toBe(6);
    expect(getEffectiveStatValue({definitionId: 'unknown', baseValue: 7.777, runtime})).toBe(7.777);
    expect(getEffectiveResourceValues({definitionId: 'hp', current: 20, max: 40, runtime})).toEqual({current: 27.5, max: 49.5});
  });
});

describe('crafting runtime modifiers', () => {
  it('returns neutral modifiers without a settlement', () => {
    expect(deriveCraftingRuntimeModifiers({settlementState: null, settlementModules: []}))
      .toEqual({levelBonus: 0, materialCostMultiplier: 1, notes: []});
  });

  it('grants a level per full 25 throughput above 100 and reduces material cost from throughput effects', () => {
    const runtime = deriveCraftingRuntimeModifiers({
      settlementState: state({fortressLevel: 4, baseStats: {defense: 10, storageCapacity: 100, craftingThroughput: 160, morale: 50}}),
      settlementModules: []
    });
    // Tier 4 adds +10 crafting_throughput: cost × (1 − 10/200).
    expect(runtime).toEqual({
      levelBonus: 2,
      materialCostMultiplier: 0.95,
      notes: [
        'Base crafting throughput grants +2 effective crafting level.',
        'Applied "crafting_throughput" effect (add).'
      ]
    });
  });

  it('handles multiply/set throughput, level-bonus effects, synergies, and the 0.5–2 clamp', () => {
    const runtime = deriveCraftingRuntimeModifiers({
      settlementState: state({moduleIds: ['m']}),
      settlementModules: [module('m', [
        {targetType: 'resource', targetId: 'crafting_throughput', operation: 'multiply', value: 4},
        {targetType: 'custom', targetId: 'crafting_level_bonus', operation: 'add', value: 3.7},
        {targetType: 'custom', targetId: 'crafting_level', operation: 'multiply', value: 2},
        {targetType: 'resource', targetId: 'crafting_throughput', operation: 'add', value: 'lots'}
      ])],
      activePartySynergies: [synergy('a'), synergy('b'), synergy('c', ['chef'])]
    });
    // multiply 4 → 1/4 clamped to 0.5; level 3 → ×2 = 6, + 2 synergies = 8; synergy cost ×0.96.
    expect(runtime.levelBonus).toBe(8);
    expect(runtime.materialCostMultiplier).toBe(0.5);
    expect(runtime.notes.at(-1)).toBe('2 active party synergy combo(s) applied to crafting.');

    const setRuntime = deriveCraftingRuntimeModifiers({
      settlementState: state({moduleIds: ['s']}),
      settlementModules: [module('s', [
        {targetType: 'resource', targetId: 'crafting_throughput', operation: 'set', value: 5},
        {targetType: 'custom', targetId: 'crafting_level', operation: 'set', value: 2.9}
      ])]
    });
    expect(setRuntime).toMatchObject({levelBonus: 2, materialCostMultiplier: 2});
  });
});

describe('canCraftRecipe', () => {
  const recipe: UnlockableRecipe = {
    id: 'stew', projectId: 'p', name: 'Stew', category: 'food', createdAt: 1, updatedAt: 1,
    requirements: {
      minCharacterLevel: 5,
      requiredMilestoneIds: ['m-cook'],
      requiredMaterials: [{itemId: 'meat', quantity: 3}, {itemId: 'salt', quantity: 1}]
    }
  };

  it('lists every unmet requirement in a fixed order', () => {
    const result = canCraftRecipe(recipe, {progress: null, characterLevel: 2, availableMaterials: {meat: 1}});
    expect(result).toEqual({
      craftable: false,
      reasons: [
        'Requires character level 5 (effective 2).',
        'Requires milestone "m-cook".',
        'Recipe is not unlocked yet.',
        'Requires 3x meat (have 1).',
        'Requires 1x salt (have 0).'
      ],
      effectiveCharacterLevel: 2,
      materialCostMultiplier: 1,
      adjustedMaterialRequirements: recipe.requirements?.requiredMaterials,
      appliedRuntimeNotes: []
    });
  });

  it('applies runtime level bonus and cost multiplier, rounding material needs up with a floor of 1', () => {
    const result = canCraftRecipe(recipe, {
      progress: {unlockedMilestoneIds: ['m-cook'], unlockedRecipeIds: ['stew']},
      characterLevel: 3,
      availableMaterials: {meat: 2, salt: 1},
      runtime: {levelBonus: 2.9, materialCostMultiplier: 0.5, notes: ['forge']}
    });
    // Rounded up, not to nearest: 3 × 0.7 = 2.1 needs 3.
    expect(canCraftRecipe(recipe, {
      progress: null, characterLevel: 9, runtime: {levelBonus: 0, materialCostMultiplier: 0.7, notes: []}
    }).adjustedMaterialRequirements).toEqual([{itemId: 'meat', quantity: 3}, {itemId: 'salt', quantity: 1}]);
    expect(result).toMatchObject({
      craftable: true,
      reasons: [],
      effectiveCharacterLevel: 5,
      materialCostMultiplier: 0.5,
      adjustedMaterialRequirements: [{itemId: 'meat', quantity: 2}, {itemId: 'salt', quantity: 1}],
      appliedRuntimeNotes: ['forge']
    });
  });

  it('keeps the effective level at least 1 and clamps the multiplier to 0.1–10', () => {
    const result = canCraftRecipe({...recipe, requirements: {requiredMaterials: [{itemId: 'ore', quantity: 2}]}}, {
      progress: {unlockedMilestoneIds: [], unlockedRecipeIds: ['stew']},
      characterLevel: 1,
      availableMaterials: {ore: 100},
      runtime: {levelBonus: -5, materialCostMultiplier: 50, notes: []}
    });
    expect(result).toMatchObject({effectiveCharacterLevel: 1, materialCostMultiplier: 10, adjustedMaterialRequirements: [{itemId: 'ore', quantity: 20}], craftable: true});
  });
});

describe('getZoneAffinityPercent', () => {
  it('is a capped percentage of the profile maximum, and 0 for a non-positive maximum', () => {
    const progress = {affinityPoints: 30} as Parameters<typeof getZoneAffinityPercent>[0];
    const profile = (maxAffinityPoints: number) => ({maxAffinityPoints}) as Parameters<typeof getZoneAffinityPercent>[1];
    expect(getZoneAffinityPercent(progress, profile(120))).toBe(25);
    expect(getZoneAffinityPercent(progress, profile(10))).toBe(100);
    expect(getZoneAffinityPercent(progress, profile(0))).toBe(0);
  });
});
