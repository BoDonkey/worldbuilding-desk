import {act, renderHook} from '@testing-library/react';
import type {
  GameRule,
  ResourceDefinition,
  StatDefinition,
  WorldRuleset
} from '@litrpg-tool/rules-engine';
import {describe, expect, it, vi} from 'vitest';
import {useRuleset} from './useRuleset';

const initialRuleset: WorldRuleset = {
  id: 'ruleset-1',
  name: 'Asterfall',
  description: '',
  version: '1.0.0',
  statDefinitions: [],
  resourceDefinitions: [],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 10,
  updatedAt: 10
};

const strength: StatDefinition = {
  id: 'strength',
  name: 'Strength',
  type: 'number',
  defaultValue: 10
};

const mana: ResourceDefinition = {
  id: 'mana',
  name: 'Mana',
  type: 'number',
  defaultValue: 100,
  regeneration: {enabled: true, rate: 5, interval: 1}
};

const rule: GameRule = {
  id: 'rest',
  name: 'Rest',
  category: 'passive',
  enabled: true,
  priority: 100,
  tags: [],
  effects: []
};

describe('useRuleset', () => {
  it('updates ruleset metadata and stat definitions', () => {
    vi.spyOn(Date, 'now').mockReturnValue(500);
    const {result} = renderHook(() => useRuleset(initialRuleset));

    act(() => result.current.updateRuleset({name: 'Bright Asterfall'}));
    expect(result.current.ruleset.name).toBe('Bright Asterfall');
    expect(result.current.ruleset.updatedAt).toBe(500);

    act(() => result.current.addStat(strength));
    expect(result.current.ruleset.statDefinitions).toEqual([strength]);

    act(() => result.current.updateStat('strength', {defaultValue: 12}));
    expect(result.current.ruleset.statDefinitions[0].defaultValue).toBe(12);

    act(() => result.current.removeStat('strength'));
    expect(result.current.ruleset.statDefinitions).toHaveLength(0);
  });

  it('adds, updates, and removes resources and rules', () => {
    const {result} = renderHook(() => useRuleset(initialRuleset));

    act(() => result.current.addResource(mana));
    expect(result.current.ruleset.resourceDefinitions[0].name).toBe('Mana');

    act(() => result.current.updateResource('mana', {max: 250}));
    expect(result.current.ruleset.resourceDefinitions[0].max).toBe(250);

    act(() => result.current.addRule(rule));
    expect(result.current.ruleset.rules).toHaveLength(1);

    act(() => result.current.updateRule('rest', {name: 'Long Rest'}));
    expect(result.current.ruleset.rules[0].name).toBe('Long Rest');

    act(() => {
      result.current.removeResource('mana');
      result.current.removeRule('rest');
    });
    expect(result.current.ruleset.resourceDefinitions).toHaveLength(0);
    expect(result.current.ruleset.rules).toHaveLength(0);
  });
});
