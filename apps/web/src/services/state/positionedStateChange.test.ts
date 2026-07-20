import {describe, expect, it} from 'vitest';
import type {StoredRuleset} from '../../entityTypes';
import type {CharacterReplayState} from './stateReplay';
import {
  buildCompoundChangePreview,
  buildPositionedStateCommand
} from './positionedStateChange';

const ruleset = {
  statDefinitions: [{id: 'STR', name: 'Strength', type: 'number', defaultValue: 10}],
  resourceDefinitions: [{id: 'HP', name: 'Health', type: 'number', defaultValue: 10}]
} as StoredRuleset;

const before: CharacterReplayState = {
  actorId: 'hero',
  actorName: 'Hero',
  stats: {STR: 10},
  resources: {current: {HP: 8}, max: {HP: 10}},
  inventory: {items: [{name: 'Potion', quantity: 1}], equipped: []},
  statuses: []
};

describe('positioned state changes', () => {
  it('builds commands for supported compound change rows', () => {
    expect(
      buildPositionedStateCommand({
        actorId: 'hero',
        ruleset,
        draft: {id: 'one', kind: 'stat_change', definitionId: 'STR', value: '10'}
      })
    ).toEqual({type: 'stat_change', actorId: 'hero', statDefinitionId: 'STR', delta: 10});
    expect(
      buildPositionedStateCommand({
        actorId: 'hero',
        ruleset,
        draft: {id: 'two', kind: 'inventory_consume', name: 'Potion', quantity: '1'}
      })
    ).toEqual({type: 'inventory_consume', actorId: 'hero', itemName: 'Potion', quantity: 1});
  });

  it('does not turn an empty numeric field into a zero-valued command', () => {
    expect(
      buildPositionedStateCommand({
        actorId: 'hero',
        ruleset,
        draft: {id: 'empty-stat', kind: 'stat_change', definitionId: 'STR', value: ''}
      })
    ).toBeNull();
    expect(
      buildPositionedStateCommand({
        actorId: 'hero',
        ruleset,
        draft: {id: 'empty-resource', kind: 'resource_set', definitionId: 'HP', value: '  '}
      })
    ).toBeNull();
  });

  it('normalizes inventory quantities to positive whole numbers', () => {
    expect(
      buildPositionedStateCommand({
        actorId: 'hero',
        ruleset,
        draft: {id: 'quantity', kind: 'inventory_add', name: 'Arrow', quantity: '2.8'}
      })
    ).toEqual({type: 'inventory_add', actorId: 'hero', itemName: 'Arrow', quantity: 2});
  });

  it('previews compound changes sequentially', () => {
    const commands = [
      {type: 'inventory_consume', actorId: 'hero', itemName: 'Potion', quantity: 1},
      {type: 'status_apply', actorId: 'hero', statusName: 'Giant Strength'},
      {type: 'stat_change', actorId: 'hero', statDefinitionId: 'STR', delta: 10}
    ] as const;
    const preview = buildCompoundChangePreview({before, commands: [...commands]});

    expect(preview.issues).toEqual([]);
    expect(preview.after.inventory.items).toEqual([]);
    expect(preview.after.statuses).toEqual(['Giant Strength']);
    expect(preview.after.stats.STR).toBe(20);
    expect(preview.steps.map((step) => step.effects[0])).toEqual([
      'Potion: 1 -> 0',
      'Statuses: Giant Strength',
      'STR: 10 -> 20'
    ]);
  });
});
