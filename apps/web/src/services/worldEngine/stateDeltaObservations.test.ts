import {describe, expect, it} from 'vitest';
import {extractStateDeltaObservations} from './stateDeltaObservations';

describe('stateDeltaObservations', () => {
  it('extracts conservative location and inventory state candidates for known characters', () => {
    const observations = extractStateDeltaObservations({
      projectId: 'project-1',
      text: [
        'Kael entered the Ember Archive.',
        'Kael picked up 2 iron keys.',
        'Kael equipped the lantern.',
        'Kael drank a potion.'
      ].join(' '),
      source: 'workspace-save',
      knownEntities: [
        {id: 'character-1', name: 'Kael', type: 'character'},
        {id: 'entity-1', name: 'Ember Archive', type: 'entity'}
      ]
    });

    expect(
      observations.map((observation) => ({
        type: observation.type,
        operation: observation.type === 'state_delta_candidate' ? observation.operation : null,
        actor: observation.type === 'state_delta_candidate' ? observation.actor : null,
        target: observation.type === 'state_delta_candidate' ? observation.target : null,
        amount: observation.type === 'state_delta_candidate' ? observation.amount : null
      }))
    ).toEqual([
      {
        type: 'state_delta_candidate',
        operation: 'location_set',
        actor: 'character-1',
        target: 'Ember Archive',
        amount: undefined
      },
      {
        type: 'state_delta_candidate',
        operation: 'inventory_add',
        actor: 'character-1',
        target: 'iron keys',
        amount: 2
      },
      {
        type: 'state_delta_candidate',
        operation: 'inventory_equip',
        actor: 'character-1',
        target: 'lantern',
        amount: undefined
      },
      {
        type: 'state_delta_candidate',
        operation: 'inventory_consume',
        actor: 'character-1',
        target: 'potion',
        amount: undefined
      }
    ]);
  });
});
