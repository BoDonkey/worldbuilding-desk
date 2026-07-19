import {describe, expect, it} from 'vitest';
import {
  buildConsumableCommands,
  buildConsumableExpirationCommands,
  findConsumableEntry
} from './consumableEffects';
import type {CompendiumEntry} from '../../entityTypes';

const entry: CompendiumEntry = {
  id: 'philter', projectId: 'project', name: 'Philter of the Sovereign',
  domain: 'artifact', actions: [], createdAt: 1, updatedAt: 1,
  consumable: {
    durationLabel: '20 minutes', statusName: "Sovereign's Favor",
    effects: [{type: 'stat_change', definitionId: 'cha', delta: 5}]
  }
};

describe('consumable effects', () => {
  it('resolves linked inventory before falling back to an exact item name', () => {
    expect(findConsumableEntry({entries: [entry], item: {name: 'Renamed', definitionId: 'philter'}})?.id).toBe('philter');
    expect(findConsumableEntry({entries: [entry], item: {name: 'philter of the sovereign'}})?.id).toBe('philter');
  });

  it('builds consumption and reversible expiration commands', () => {
    const commands = buildConsumableCommands({actorId: 'gideon', itemName: entry.name, definition: entry.consumable!});
    expect(commands).toEqual([
      {type: 'inventory_consume', actorId: 'gideon', itemName: entry.name, quantity: 1},
      {type: 'stat_change', actorId: 'gideon', statDefinitionId: 'cha', delta: 5},
      {type: 'status_apply', actorId: 'gideon', statusName: "Sovereign's Favor"}
    ]);
    expect(buildConsumableExpirationCommands({actorId: 'gideon', definition: entry.consumable!})).toEqual([
      {type: 'stat_change', actorId: 'gideon', statDefinitionId: 'cha', delta: -5},
      {type: 'status_remove', actorId: 'gideon', statusName: "Sovereign's Favor"}
    ]);
  });

  it('applies and reverses resource effects as well as stat effects', () => {
    const definition = {
      effects: [{type: 'resource_change' as const, definitionId: 'mana', delta: 3}]
    };

    expect(buildConsumableCommands({
      actorId: 'gideon',
      itemName: 'Mana Draught',
      definition
    })).toEqual([
      {type: 'inventory_consume', actorId: 'gideon', itemName: 'Mana Draught', quantity: 1},
      {type: 'resource_change', actorId: 'gideon', resourceDefinitionId: 'mana', delta: 3}
    ]);
    expect(buildConsumableExpirationCommands({
      actorId: 'gideon',
      definition
    })).toEqual([
      {type: 'resource_change', actorId: 'gideon', resourceDefinitionId: 'mana', delta: -3}
    ]);
  });
});
