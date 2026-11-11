import {describe, expect, it} from 'vitest';
import type {ReplaySheet, StateMutationCommand, StateMutationEvent} from './types';
import {
  DESCRIPTIVE_STATE_COMMAND_TYPES,
  buildDescriptiveReplaySheet,
  isDescriptiveStateCommand
} from './descriptive';
import {replayCharacterState, validateStateMutationCommandAgainstState} from './replay';

const sheeted: ReplaySheet = {
  id: 'sheet-kael',
  characterEntityId: 'entity-kael',
  name: 'Kael',
  stats: [],
  resources: [],
  inventoryEntries: [{name: 'Torch', quantity: 1}]
};
const sera = buildDescriptiveReplaySheet({entityId: 'entity-sera', name: 'Sera'});

const event = (
  id: string,
  sceneOrder: number,
  commands: StateMutationCommand[],
  status: StateMutationEvent['status'] = 'accepted'
): StateMutationEvent => ({
  id,
  projectId: 'project-1',
  sceneId: `scene-${sceneOrder}`,
  sceneOrder,
  sourceRevision: 1,
  sourceHash: 'h',
  status,
  commands,
  createdAt: sceneOrder
});

const events: StateMutationEvent[] = [
  event('e1', 1, [
    {type: 'location_set', actorId: 'entity-sera', locationName: 'Highmoor'},
    {type: 'inventory_add', actorId: 'entity-sera', itemName: 'Brass Key'},
    {type: 'location_set', actorId: 'entity-kael', locationName: 'The Docks'}
  ]),
  event('e2', 2, [
    {type: 'inventory_remove', actorId: 'entity-sera', itemName: 'Brass Key'},
    {type: 'inventory_add', actorId: 'entity-kael', itemName: 'Brass Key'}
  ]),
  event('e3', 3, [
    {type: 'location_set', actorId: 'entity-sera', locationName: 'The Docks'}
  ], 'invalidated')
];

const replay = (sheet: ReplaySheet, upToSceneOrder?: number) =>
  replayCharacterState({
    sheet,
    ruleset: null,
    events,
    target: {actorId: sheet.characterEntityId},
    upToSceneOrder
  });

describe('descriptive state for characters without a sheet', () => {
  it('starts from nothing held and no location', () => {
    const state = replay(sera, 0);
    expect(state.actorId).toBe('entity-sera');
    expect(state.actorName).toBe('Sera');
    expect(state.locationName).toBeUndefined();
    expect(state.inventory.items).toEqual([]);
    expect(state.stats).toEqual({});
    expect(state.resources).toEqual({current: {}, max: {}});
  });

  it('replays beside a sheeted character from the same events', () => {
    const afterOne = replay(sera, 1);
    expect(afterOne.locationName).toBe('Highmoor');
    expect(afterOne.inventory.items.map((item) => item.name)).toEqual(['Brass Key']);

    const seraEnd = replay(sera);
    expect(seraEnd.inventory.items).toEqual([]);
    // The invalidated move is ignored.
    expect(seraEnd.locationName).toBe('Highmoor');

    const kaelEnd = replay(sheeted);
    expect(kaelEnd.locationName).toBe('The Docks');
    expect(kaelEnd.inventory.items.map((item) => item.name)).toEqual(['Torch', 'Brass Key']);
  });

  it('rejects removing an item the character never received', () => {
    expect(validateStateMutationCommandAgainstState({
      state: replay(sera),
      command: {type: 'inventory_remove', actorId: 'entity-sera', itemName: 'Brass Key'}
    })).not.toEqual([]);
  });

  it('allows only location and item kinds', () => {
    expect(DESCRIPTIVE_STATE_COMMAND_TYPES).toEqual([
      'location_set',
      'inventory_add',
      'inventory_remove',
      'inventory_consume',
      'inventory_equip',
      'inventory_unequip'
    ]);
    expect(isDescriptiveStateCommand({type: 'inventory_add'})).toBe(true);
    expect(isDescriptiveStateCommand({type: 'stat_change'})).toBe(false);
    expect(isDescriptiveStateCommand({type: 'resource_set'})).toBe(false);
    expect(isDescriptiveStateCommand({type: 'status_apply'})).toBe(false);
    expect(isDescriptiveStateCommand({type: 'xp_gain'})).toBe(false);
  });
});
