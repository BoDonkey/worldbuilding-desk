import {describe, expect, it} from 'vitest';
import type {StoredRuleset} from '../../entityTypes';
import {
  reconcileCharacterResources,
  reconcileCharacterStats
} from './characterSheetRuleset';

const ruleset = {
  id: 'rules',
  projectId: 'project',
  name: 'D&D',
  description: '',
  version: '1',
  statDefinitions: [
    {id: 'STR', name: 'Strength', type: 'number', defaultValue: 10, min: 1, max: 20},
    {id: 'DEX', name: 'Dexterity', type: 'number', defaultValue: 10, min: 1, max: 20}
  ],
  resourceDefinitions: [
    {id: 'HP', name: 'Hit Points', type: 'number', defaultValue: 12}
  ],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
} satisfies StoredRuleset;

describe('character sheet ruleset reconciliation', () => {
  it('hydrates every active stat definition into a blank sheet', () => {
    expect(reconcileCharacterStats(ruleset, [])).toEqual([
      {definitionId: 'STR', value: 10},
      {definitionId: 'DEX', value: 10}
    ]);
  });

  it('preserves entered values while adding new definitions and dropping retired ones', () => {
    expect(
      reconcileCharacterStats(ruleset, [
        {definitionId: 'STR', value: 17},
        {definitionId: 'OLD', value: 99}
      ])
    ).toEqual([
      {definitionId: 'STR', value: 17},
      {definitionId: 'DEX', value: 10}
    ]);
  });

  it('preserves resource state and adds newly defined resources', () => {
    expect(
      reconcileCharacterResources(ruleset, [
        {definitionId: 'MANA', current: 3, max: 7}
      ])
    ).toEqual([{definitionId: 'HP', current: 12, max: 12}]);
    expect(
      reconcileCharacterResources(ruleset, [
        {definitionId: 'HP', current: 4, max: 12}
      ])
    ).toEqual([{definitionId: 'HP', current: 4, max: 12}]);
  });
});
