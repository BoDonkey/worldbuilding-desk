import {describe, expect, it} from 'vitest';
import type {StateMutationCommand, StoredRuleset} from '../../entityTypes';
import {
  buildDefaultResources,
  buildDefaultStats,
  hashString,
  summarizeMutationCommand
} from './characterSheetDefaults';

const ruleset = {
  id: 'rules',
  projectId: 'project',
  name: 'Test Rules',
  description: '',
  version: '1',
  statDefinitions: [
    {id: 'STR', name: 'Strength', type: 'number', defaultValue: 10}
  ],
  resourceDefinitions: [
    {id: 'HP', name: 'Health', type: 'number', defaultValue: 12}
  ],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
} satisfies StoredRuleset;

describe('character sheet defaults', () => {
  it('hashes content deterministically', () => {
    expect(hashString('scene text')).toBe('h39ecb526');
    expect(hashString('scene text')).toBe(hashString('scene text'));
    expect(hashString('changed text')).not.toBe(hashString('scene text'));
  });

  it('builds default stats from the active ruleset', () => {
    expect(buildDefaultStats(ruleset)).toEqual([
      {definitionId: 'STR', value: 10}
    ]);
    expect(buildDefaultStats(null)).toEqual([]);
  });

  it('builds default resources from the active ruleset', () => {
    expect(buildDefaultResources(ruleset)).toEqual([
      {definitionId: 'HP', current: 12, max: 12}
    ]);
    expect(buildDefaultResources(null)).toEqual([]);
  });

  it.each<[StateMutationCommand, string]>([
    [
      {type: 'resource_change', actorId: 'actor', resourceDefinitionId: 'HP', delta: 2},
      'Resource HP +2'
    ],
    [
      {type: 'stat_set', actorId: 'actor', statDefinitionId: 'STR', value: 15},
      'Stat STR = 15'
    ],
    [
      {type: 'status_apply', actorId: 'actor', statusName: 'Focused'},
      'Apply status Focused'
    ],
    [
      {type: 'inventory_add', actorId: 'actor', itemName: 'Key', quantity: 2},
      'Add Key x2'
    ],
    [
      {type: 'location_set', actorId: 'actor', locationName: 'South Gate'},
      'Move to South Gate'
    ]
  ])('summarizes mutation commands', (command, expected) => {
    expect(summarizeMutationCommand(command)).toBe(expected);
  });
});
