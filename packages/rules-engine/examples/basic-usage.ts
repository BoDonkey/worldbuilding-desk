import {
  createEmptyRuleset,
  STAT_SYSTEM_PRESETS,
  RESOURCE_SYSTEM_PRESETS,
  createRule,
  createConditionalRule,
  createCondition,
  createEffect,
  RulesEngine,
  StateManager,
  roll,
  rollWithDetails,
  DiceRoller,
  type WorldRuleset,
  type GameRule
} from '../src';

/**
 * Example: Create a simple LitRPG world with rules
 */

console.log('=== Creating LitRPG World Ruleset ===\n');

// 1. Create a world ruleset
const ruleset = createEmptyRuleset('My LitRPG World');
ruleset.description = 'A world with stats, mana, and combat rules';

// 2. Add stat system (LitRPG preset)
ruleset.statDefinitions = STAT_SYSTEM_PRESETS.litrpg;
console.log(
  'Stats added:',
  ruleset.statDefinitions.map((s) => s.name).join(', ')
);

// 3. Add resource system (health + mana)
ruleset.resourceDefinitions = RESOURCE_SYSTEM_PRESETS.mana;
console.log(
  'Resources added:',
  ruleset.resourceDefinitions.map((r) => r.name).join(', ')
);

// 4. Create some rules
const rules: GameRule[] = [];

// Rule 1: Strength damage bonus (simple)
const strengthBonusRule = createRule(
  'Strength Damage Bonus',
  'combat',
  [
    createEffect('custom.damage', 'multiply', '1 + (STR * 0.02)')
  ]
);
strengthBonusRule.description = 'Each point of STR adds 2% to damage';
strengthBonusRule.trigger = {
  type: 'on_damage_calculation',
  damageType: 'melee'
};
rules.push(strengthBonusRule);

// Rule 2: Health regeneration (time-based)
const healthRegenRule = createRule('Health Regeneration', 'passive', [
  createEffect('resources.current.health', 'add', 5)
]);
healthRegenRule.description = 'Regenerate 5 HP per minute';
healthRegenRule.trigger = {type: 'time_elapsed', interval: 60};
rules.push(healthRegenRule);

// Rule 3: Mana cost reduction (conditional)
const manaCostRule = createConditionalRule(
  'Intelligence Mana Discount',
  'magic',
  [createCondition('stats.INT', 'greaterThan', 10)],
  [createEffect('spell.manaCost', 'multiply', '1 - ((INT - 10) * 0.05)')]
);
manaCostRule.description = 'INT above 10 reduces mana cost by 5% per point';
manaCostRule.trigger = {type: 'on_cast_spell'};
rules.push(manaCostRule);

// Rule 4: Well-Fed buff from consuming food
const wellFedRule = createRule(
  'Well-Fed Buff',
  'time',
  [] // No direct effects - we'll use modifiers
);
wellFedRule.description = 'Being well-fed grants +3 STR and +2 AGI';
wellFedRule.trigger = { type: 'status_active', statusName: 'well_fed' };
wellFedRule.duration = {type: 'timed', seconds: 7200}; // 2 hours
rules.push(wellFedRule);

// Rule 5: Food consumption (triggers well-fed buff)
const consumeFoodRule = createConditionalRule(
  'Consume Hearty Stew',
  'crafting',
  [createCondition('character.inventory.items', 'contains', 'hearty_stew')],
  [
    {
      target: 'resources.current.health',
      operation: 'add',
      value: 50,
      description: 'Restore 50 health'
    },
    {
      target: 'character.statuses',
      operation: 'append',
      value: {name: 'well_fed', duration: 7200},
      triggersRule: wellFedRule.id,
      description: 'Apply well-fed status'
    }
  ]
);
consumeFoodRule.trigger = {type: 'on_consume_item', itemId: 'hearty_stew'};
rules.push(consumeFoodRule);

ruleset.rules = rules;

console.log(`\nRules created: ${rules.length}`);
rules.forEach((r) => console.log(`  - ${r.name} (${r.category})`));

// 5. Create rules engine and state manager
console.log('\n=== Initializing Engine ===\n');
const engine = new RulesEngine(ruleset, {enableLogging: true});
const stateManager = new StateManager(ruleset, engine);

// 6. Create a character
console.log('Creating character...\n');
const hero = stateManager.createCharacter('Aria the Brave', {
  STR: 15,
  AGI: 12,
  VIT: 14,
  INT: 18,
  WIS: 10,
  LUK: 8
});

console.log('Character created:', hero.name);
console.log('Stats:', hero.stats);
console.log('Resources:', hero.resources);

// 7. Test damage calculation with strength bonus
console.log('\n=== Testing Combat Rule ===\n');

const damageState = {
  ...hero,
  custom: {damage: 100} // Base damage
};

const damageResult = engine.executeTrigger(
  'on_damage_calculation',
  damageState,
  {
    damageType: 'melee'
  }
);

console.log('Base damage: 100');
console.log('STR: 15');
console.log('Expected: 100 * (1 + 0.30) = 130');
console.log('Actual damage:', damageResult.finalState.custom?.damage); // Check the damage field
console.log('Rule applied:', damageResult.results[0]?.success);

// 8. Test adding well-fed status
console.log('\n=== Testing Status System ===\n');

console.log('Adding well-fed status...');
const buffedHero = stateManager.addStatus(hero.id, 'well_fed', wellFedRule.id, 7200);

// Add modifiers manually (in real use, rules would do this)
stateManager.addModifier(hero.id, 'STR', 'add', 3, wellFedRule.id);
stateManager.addModifier(hero.id, 'AGI', 'add', 2, wellFedRule.id);

console.log('Base STR:', hero.stats.STR);
console.log(
  'Effective STR (with well-fed):',
  stateManager.getEffectiveStat(hero.id, 'STR')
);
console.log('Expected: 15 + 3 = 18');

// 9. Test time progression
console.log('\n=== Testing Time Progression ===\n');

console.log('Initial health:', hero.resources.current.health);
console.log('Waiting 60 seconds (should trigger health regen)...');

const afterRegen = stateManager.processTimeElapsed(hero.id, 60);
console.log('Health after 60s:', afterRegen.resources.current.health);
console.log('Expected: +5 HP from regen rule');

// 10. Test formula validation
console.log('\n=== Testing Formula Validation ===\n');

const testFormulas = [
  '1 + (STR * 0.02)',
  'baseCost * (1 - (INT * 0.05))',
  'invalid formula +++'
];

for (const formula of testFormulas) {
  const rule = createRule('Test', 'custom', []);
  rule.formula = formula;
  const validation = engine.validateRule(rule);
  console.log(`Formula: "${formula}"`);
  console.log(`Valid: ${validation.valid}`);
  if (!validation.valid) {
    console.log(`Errors: ${validation.errors.join(', ')}`);
  }
  console.log('');
}

console.log('\n=== Testing Dice Roller ===\n');

const roller = new DiceRoller();

// Test various notations
const testRolls = [
  '2d6',
  'd20',
  '3d8+5',
  '2d6-1d4',
  '1d100',
  '3d17+2d13-4', // Non-standard dice
];

for (const notation of testRolls) {
  const result = rollWithDetails(notation);
  console.log(`${notation}:`);
  console.log(`  Breakdown: ${result.breakdown}`);
  console.log(`  Total: ${result.total}`);
  
  const avg = roller.average(notation);
  const range = roller.range(notation);
  console.log(`  Average: ${avg.toFixed(2)}, Range: ${range.min}-${range.max}`);
  console.log('');
}

// Test in formula
console.log('Testing dice in formulas:');
const testChar = stateManager.createCharacter('Test', { STR: 10 });
const damageRule = createRule('Damage Roll', 'combat', [
  createEffect('custom.damage', 'set', '2d6 + STR'),
]);
ruleset.rules.push(damageRule);

for (let i = 0; i < 3; i++) {
  const result = engine.evaluateRule(damageRule, testChar);
  console.log(`Roll ${i + 1}: ${result.newState?.custom?.damage} (2d6 + 10)`);
}

console.log('=== Example Complete ===');
