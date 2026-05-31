import {describe, expect, it} from 'vitest';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import {
  getAcceptedStateMutationEvents,
  replayCharacterState,
  validateStateMutationCommandAgainstState,
  validateStateMutationEventForRuleset
} from './stateReplay';

const ruleset: StoredRuleset = {
  id: 'ruleset-1',
  projectId: 'project-1',
  name: 'Test Ruleset',
  version: '1.0.0',
  statDefinitions: [
    {id: 'hp', name: 'HP', type: 'number', defaultValue: 10},
    {id: 'title', name: 'Title', type: 'text', defaultValue: 'Scout'}
  ],
  resourceDefinitions: [
    {id: 'mana', name: 'Mana', type: 'number', defaultValue: 3, max: 8}
  ],
  rules: [],
  itemTemplates: [],
  statusTemplates: [],
  createdAt: 1,
  updatedAt: 1
};

const sheet: CharacterSheet = {
  id: 'sheet-1',
  projectId: 'project-1',
  characterId: 'character-1',
  name: 'Kael',
  level: 1,
  experience: 0,
  stats: [{definitionId: 'hp', value: 12}],
  resources: [{definitionId: 'mana', current: 4, max: 8}],
  inventory: [],
  inventoryEntries: [{id: 'item-1', mode: 'quick', name: 'Torch', quantity: 2}],
  equipmentEntries: [{id: 'item-2', mode: 'quick', name: 'Torch', quantity: 1}],
  statuses: ['Inspired'],
  createdAt: 1,
  updatedAt: 1
};

function makeEvent(
  overrides: Partial<StateMutationEvent> & Pick<StateMutationEvent, 'id' | 'commands'>
): StateMutationEvent {
  return {
    id: overrides.id,
    projectId: 'project-1',
    sceneId: overrides.sceneId ?? 'scene-1',
    sceneTitle: overrides.sceneTitle ?? 'Scene 1',
    sceneOrder: overrides.sceneOrder ?? 1,
    sceneSequence: overrides.sceneSequence ?? 1,
    sourceRevision: overrides.sourceRevision ?? 100,
    sourceHash: overrides.sourceHash ?? 'h1234',
    status: overrides.status ?? 'accepted',
    commands: overrides.commands,
    createdAt: overrides.createdAt ?? 1,
    invalidatedAt: overrides.invalidatedAt,
    invalidationReason: overrides.invalidationReason
  };
}

describe('stateReplay', () => {
  it('sorts accepted events by scene order, then same-scene sequence, then createdAt', () => {
    const events = getAcceptedStateMutationEvents([
      makeEvent({
        id: 'later-scene',
        sceneOrder: 2,
        sceneSequence: 1,
        createdAt: 40,
        commands: [{type: 'location_set', actorId: 'sheet-1', locationName: 'Dock'}]
      }),
      makeEvent({
        id: 'same-scene-second',
        sceneOrder: 1,
        sceneSequence: 2,
        createdAt: 30,
        commands: [{type: 'status_apply', actorId: 'sheet-1', statusName: 'Hidden'}]
      }),
      makeEvent({
        id: 'invalidated',
        status: 'invalidated',
        sceneOrder: 0,
        sceneSequence: 1,
        createdAt: 5,
        commands: [{type: 'status_remove', actorId: 'sheet-1', statusName: 'Inspired'}]
      }),
      makeEvent({
        id: 'same-scene-first',
        sceneOrder: 1,
        sceneSequence: 1,
        createdAt: 20,
        commands: [{type: 'inventory_add', actorId: 'sheet-1', itemName: 'Rope', quantity: 1}]
      }),
      makeEvent({
        id: 'same-sequence-earlier-created',
        sceneOrder: 1,
        sceneSequence: 2,
        createdAt: 10,
        commands: [{type: 'resource_change', actorId: 'sheet-1', resourceDefinitionId: 'mana', delta: 1}]
      })
    ]);

    expect(events.map((event) => event.id)).toEqual([
      'same-scene-first',
      'same-sequence-earlier-created',
      'same-scene-second',
      'later-scene'
    ]);
  });

  it('replays accepted mutations up to the requested scene boundary', () => {
    const events = [
      makeEvent({
        id: 'gain-mana',
        sceneOrder: 1,
        sceneSequence: 1,
        commands: [
          {type: 'resource_change', actorId: 'character-1', resourceDefinitionId: 'mana', delta: 2}
        ]
      }),
      makeEvent({
        id: 'move-and-equip',
        sceneOrder: 1,
        sceneSequence: 2,
        commands: [
          {type: 'location_set', actorId: 'sheet-1', locationName: 'Harbor'},
          {type: 'inventory_equip', actorId: 'sheet-1', itemName: 'Torch'}
        ]
      }),
      makeEvent({
        id: 'future-scene',
        sceneOrder: 2,
        sceneSequence: 1,
        commands: [
          {type: 'status_apply', actorId: 'sheet-1', statusName: 'Wounded'},
          {type: 'inventory_consume', actorId: 'sheet-1', itemName: 'Torch', quantity: 1}
        ]
      }),
      makeEvent({
        id: 'ignored-invalidated',
        status: 'invalidated',
        sceneOrder: 1,
        sceneSequence: 3,
        commands: [{type: 'resource_set', actorId: 'sheet-1', resourceDefinitionId: 'mana', value: 0}]
      }),
      makeEvent({
        id: 'ignored-proposed',
        status: 'proposed',
        sceneOrder: 1,
        sceneSequence: 4,
        commands: [{type: 'resource_set', actorId: 'sheet-1', resourceDefinitionId: 'mana', value: 1}]
      })
    ];

    const replayed = replayCharacterState({
      sheet,
      ruleset,
      events,
      target: {
        actorId: 'sheet-1',
        characterId: 'character-1',
        sheetId: 'sheet-1'
      },
      upToSceneOrder: 1
    });

    expect(replayed.resources.current.mana).toBe(6);
    expect(replayed.locationName).toBe('Harbor');
    expect(replayed.inventory.equipped).toEqual(['Torch']);
    expect(replayed.statuses).toEqual(['Inspired']);
    expect(replayed.inventory.items).toEqual([{name: 'Torch', quantity: 2}]);
  });

  it('validates command semantics against current replay state', () => {
    const baseline = replayCharacterState({
      sheet,
      ruleset,
      events: [],
      target: {actorId: 'sheet-1'}
    });

    expect(
      validateStateMutationCommandAgainstState({
        state: baseline,
        command: {
          type: 'resource_change',
          actorId: 'sheet-1',
          resourceDefinitionId: 'mana',
          delta: -10
        }
      })
    ).toEqual(['Resource "mana" would drop below zero (4 + -10).']);

    expect(
      validateStateMutationCommandAgainstState({
        state: baseline,
        command: {
          type: 'inventory_equip',
          actorId: 'sheet-1',
          itemName: 'Lantern'
        }
      })
    ).toEqual(['Item "Lantern" is not present in inventory.']);
  });

  it('validates event commands against the ruleset schema', () => {
    const errors = validateStateMutationEventForRuleset({
      ruleset,
      event: makeEvent({
        id: 'invalid-event',
        commands: [
          {
            type: 'stat_set',
            actorId: 'sheet-1',
            statDefinitionId: 'title',
            value: 4
          },
          {
            type: 'resource_change',
            actorId: 'sheet-1',
            resourceDefinitionId: 'stamina',
            delta: 1
          }
        ]
      })
    });

    expect(errors).toEqual([
      'Stat "title" expects text but received number.',
      'Unknown resource definition "stamina".'
    ]);
  });
});
