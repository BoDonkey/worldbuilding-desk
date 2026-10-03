import {describe, expect, it, vi} from 'vitest';
import {createEmptyCharacterState} from '../types/CharacterState';
import type {GameRule} from '../types/GameRule';
import {createEmptyRuleset} from '../types/WorldRuleset';
import {RulesEngine} from './RulesEngine';

const state = () =>
  createEmptyCharacterState('Tester', 'ruleset-1', {STR: 10}, {current: {health: 20}, max: {health: 40}});

const rule = (overrides: Partial<GameRule> & Pick<GameRule, 'id'>): GameRule => ({
  name: overrides.id,
  category: 'custom',
  enabled: true,
  priority: 100,
  tags: [],
  effects: [],
  ...overrides
});

const engineWith = (rules: GameRule[]) =>
  new RulesEngine({...createEmptyRuleset('Test'), rules});

describe('RulesEngine', () => {
  it('skips disabled rules and rules whose conditions fail', () => {
    const disabled = rule({id: 'off', enabled: false, effects: [{target: 'stats.STR', operation: 'add', value: 1}]});
    const gated = rule({
      id: 'gated',
      conditions: [{field: 'stats.STR', operator: 'greater_than', value: 50}],
      effects: [{target: 'stats.STR', operation: 'add', value: 1}]
    });
    const engine = engineWith([disabled, gated]);

    expect(engine.evaluateRule(disabled, state())).toMatchObject({success: false, conditionsMet: false});
    expect(engine.evaluateRule(gated, state())).toMatchObject({success: false, conditionsMet: false});
  });

  it('applies effects and records formula results without touching the input', () => {
    const input = state();
    const healing = rule({
      id: 'heal',
      conditions: [{field: 'resources.current.health', operator: 'less_than', value: 40}],
      effects: [{target: 'resources.current.health', operation: 'add', value: 'STR', max: 40}],
      formula: 'STR * 2'
    });
    const result = engineWith([healing]).evaluateRule(healing, input);

    expect(result.success).toBe(true);
    expect(result.newState?.resources.current.health).toBe(30);
    expect(result.newState?.custom).toEqual({formula_heal: 20});
    expect(input.resources.current.health).toBe(20);
  });

  it('runs rules in priority order, higher first', () => {
    const add = rule({id: 'add', priority: 50, effects: [{target: 'stats.STR', operation: 'add', value: 5}]});
    const double = rule({id: 'double', priority: 200, effects: [{target: 'stats.STR', operation: 'multiply', value: 2}]});
    const {finalState, results} = engineWith([add, double]).executeRules(['add', 'double'], state());

    expect(results.map((item) => item.ruleId)).toEqual(['double', 'add']);
    expect(finalState.stats.STR).toBe(25);
  });

  it('follows triggered rules exactly one level deep, so self-triggers terminate', () => {
    const echo = rule({
      id: 'echo',
      effects: [{target: 'stats.STR', operation: 'add', value: 1, triggersRule: 'echo'}]
    });
    const {finalState, results} = engineWith([echo]).executeRules(['echo'], state());

    expect(results).toHaveLength(2);
    expect(finalState.stats.STR).toBe(12);
  });

  it('executes only enabled rules matching a trigger', () => {
    const onConsume = rule({id: 'drink', trigger: {type: 'on_consume_item'}, effects: [{target: 'resources.current.health', operation: 'add', value: 10}]});
    const offConsume = rule({id: 'off', enabled: false, trigger: {type: 'on_consume_item'}, effects: [{target: 'resources.current.health', operation: 'set', value: 0}]});
    const passive = rule({id: 'passive', trigger: {type: 'passive'}, effects: [{target: 'stats.STR', operation: 'set', value: 99}]});
    const {finalState} = engineWith([onConsume, offConsume, passive]).executeTrigger('on_consume_item', state());

    expect(finalState.resources.current.health).toBe(30);
    expect(finalState.stats.STR).toBe(10);
  });

  it('keeps extra state fields through execution', () => {
    const add = rule({id: 'add', effects: [{target: 'stats.STR', operation: 'add', value: 1}]});
    const extended = {...state(), timers: {lastUpdate: 1, activeEffects: {}}};
    const {finalState} = engineWith([add]).executeRules(['add'], extended);

    expect(finalState.timers).toEqual({lastUpdate: 1, activeEffects: {}});
  });

  it('reports invalid formulas when validating a rule', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = rule({id: 'broken', formula: 'STR * (', effects: [{target: 'stats.STR', operation: 'set', value: '(1 +'}]});
    const {valid, errors} = engineWith([broken]).validateRule(broken);

    expect(valid).toBe(false);
    expect(errors).toHaveLength(2);
    vi.restoreAllMocks();
  });
});
