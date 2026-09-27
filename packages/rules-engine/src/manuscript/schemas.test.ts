import {describe, expect, it} from 'vitest';
import {buildCharacterReplayBaseline} from './replay';
import {validateStateMutationEvent} from './schemas';
import type {StateMutationEvent} from './types';

const event: StateMutationEvent = {
  id: 'event-1',
  projectId: 'project-1',
  sceneId: 'scene-1',
  sourceRevision: 1,
  sourceHash: 'hash',
  status: 'accepted',
  commands: [{type: 'inventory_add', actorId: 'entity-1', itemName: 'Rope', quantity: 2}],
  createdAt: 1
};

describe('manuscript state schemas', () => {
  it('accepts a well-formed event and rejects malformed commands', () => {
    expect(validateStateMutationEvent(event)).toEqual(event);
    expect(() =>
      validateStateMutationEvent({
        ...event,
        commands: [{type: 'inventory_add', actorId: 'entity-1', itemName: 'Rope', quantity: 0}]
      })
    ).toThrow();
    expect(() =>
      validateStateMutationEvent({
        ...event,
        commands: [{type: 'status_apply', actorId: '', statusName: 'Hasted'}]
      })
    ).toThrow();
  });

  it('builds the replay baseline from ruleset defaults and sheet overrides', () => {
    const baseline = buildCharacterReplayBaseline({
      sheet: {
        id: 'sheet-1',
        name: 'Kael',
        stats: [{definitionId: 'str', value: 12}],
        resources: [],
        statuses: ['Tired', '']
      },
      ruleset: {
        statDefinitions: [
          {id: 'str', name: 'Strength', type: 'number', defaultValue: 10},
          {id: 'agi', name: 'Agility', type: 'number', defaultValue: 8}
        ],
        resourceDefinitions: [{id: 'hp', name: 'Health', type: 'number', defaultValue: 20}]
      }
    });
    expect(baseline).toEqual({
      actorId: 'sheet-1',
      actorName: 'Kael',
      stats: {str: 12, agi: 8},
      resources: {current: {hp: 20}, max: {hp: 20}},
      inventory: {items: [], equipped: []},
      statuses: ['Tired'],
      locationName: undefined
    });
  });
});
