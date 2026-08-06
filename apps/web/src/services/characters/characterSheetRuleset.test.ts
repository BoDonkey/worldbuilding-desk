import {describe, expect, it} from 'vitest';
import type {StoredRuleset} from '../../entityTypes';
import {
  buildCharacterSheetMutationCommand,
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

const commandInput = {
  actorId: ' hero ',
  mutationType: 'resource_change' as const,
  statDefinition: ruleset.statDefinitions[0],
  resourceDefinition: ruleset.resourceDefinitions[0],
  numberValue: '3',
  textValue: 'focused',
  booleanValue: true,
  statusName: ' Inspired ',
  itemName: ' Potion ',
  quantity: '2',
  locationName: ' Old Keep '
};

describe('character sheet mutation command building', () => {
  it('builds numeric resource and stat commands from form values', () => {
    expect(buildCharacterSheetMutationCommand(commandInput)).toEqual({
      type: 'resource_change',
      actorId: 'hero',
      resourceDefinitionId: 'HP',
      delta: 3
    });
    expect(
      buildCharacterSheetMutationCommand({
        ...commandInput,
        mutationType: 'stat_set',
        numberValue: '17'
      })
    ).toEqual({
      type: 'stat_set',
      actorId: 'hero',
      statDefinitionId: 'STR',
      value: 17
    });
  });

  it('preserves boolean and text stat value types', () => {
    expect(
      buildCharacterSheetMutationCommand({
        ...commandInput,
        mutationType: 'stat_change',
        statDefinition: {...ruleset.statDefinitions[0], type: 'boolean'}
      })
    ).toMatchObject({delta: true});
    expect(
      buildCharacterSheetMutationCommand({
        ...commandInput,
        mutationType: 'stat_set',
        statDefinition: {...ruleset.statDefinitions[0], type: 'text'}
      })
    ).toMatchObject({value: 'focused'});
  });

  it('normalizes named status, inventory, equipment, and location commands', () => {
    expect(
      buildCharacterSheetMutationCommand({...commandInput, mutationType: 'status_apply'})
    ).toMatchObject({type: 'status_apply', statusName: 'Inspired'});
    expect(
      buildCharacterSheetMutationCommand({
        ...commandInput,
        mutationType: 'inventory_consume',
        quantity: '0'
      })
    ).toMatchObject({type: 'inventory_consume', itemName: 'Potion', quantity: 1});
    expect(
      buildCharacterSheetMutationCommand({
        ...commandInput,
        mutationType: 'inventory_equip'
      })
    ).toMatchObject({type: 'inventory_equip', itemName: 'Potion'});
    expect(
      buildCharacterSheetMutationCommand({...commandInput, mutationType: 'location_set'})
    ).toMatchObject({type: 'location_set', locationName: 'Old Keep'});
  });

  it('rejects commands with missing required form values', () => {
    expect(buildCharacterSheetMutationCommand({...commandInput, actorId: ' '})).toBeNull();
    expect(
      buildCharacterSheetMutationCommand({...commandInput, resourceDefinition: null})
    ).toBeNull();
    expect(
      buildCharacterSheetMutationCommand({
        ...commandInput,
        mutationType: 'stat_change',
        statDefinition: null
      })
    ).toBeNull();
    expect(
      buildCharacterSheetMutationCommand({
        ...commandInput,
        mutationType: 'status_remove',
        statusName: ' '
      })
    ).toBeNull();
  });
});
