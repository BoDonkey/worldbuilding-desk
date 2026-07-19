import {describe, expect, it} from 'vitest';
import type {CharacterReplayState} from '../../services/state/stateReplay';
import {inventoryChoicesForChange} from './PositionedStateChangeComposer';

const before: CharacterReplayState = {
  actorId: 'hero',
  actorName: 'Hero',
  stats: {},
  resources: {current: {}, max: {}},
  inventory: {
    items: [
      {name: 'Greater Potion', quantity: 1},
      {name: 'Iron Sword', quantity: 1}
    ],
    equipped: ['Iron Sword']
  },
  statuses: []
};

describe('positioned state change inventory choices', () => {
  it('offers carried items for removal and consumption', () => {
    expect(inventoryChoicesForChange({kind: 'inventory_remove', before})).toEqual([
      'Greater Potion',
      'Iron Sword'
    ]);
    expect(inventoryChoicesForChange({kind: 'inventory_consume', before})).toEqual([
      'Greater Potion',
      'Iron Sword'
    ]);
  });

  it('separates equip and unequip choices', () => {
    expect(inventoryChoicesForChange({kind: 'inventory_equip', before})).toEqual([
      'Greater Potion'
    ]);
    expect(inventoryChoicesForChange({kind: 'inventory_unequip', before})).toEqual([
      'Iron Sword'
    ]);
  });

  it('keeps a legacy edited item available even when it is missing from the baseline', () => {
    expect(inventoryChoicesForChange({
      kind: 'inventory_remove',
      before,
      currentName: 'Old Key'
    })).toEqual(['Old Key', 'Greater Potion', 'Iron Sword']);
  });
});
