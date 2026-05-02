import {describe, expect, it} from 'vitest';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import type {ObservationProposal} from '../worldEngine';
import {buildDerivedStateMutationEvents} from './stateMutationDerivation';

const ruleset: StoredRuleset = {
  id: 'ruleset-1',
  projectId: 'project-1',
  name: 'Test Ruleset',
  version: '1.0.0',
  statDefinitions: [],
  resourceDefinitions: [],
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
  stats: [],
  resources: [],
  inventory: [],
  inventoryEntries: [{id: 'item-1', mode: 'quick', name: 'Torch', quantity: 1}],
  createdAt: 1,
  updatedAt: 1
};

function makeObservation(
  overrides: Partial<Extract<ObservationProposal, {type: 'state_delta_candidate'}>> & {
    id: string;
    operation: Extract<ObservationProposal, {type: 'state_delta_candidate'}>['operation'];
  }
): Extract<ObservationProposal, {type: 'state_delta_candidate'}> {
  return {
    id: overrides.id,
    projectId: 'project-1',
    type: 'state_delta_candidate',
    operation: overrides.operation,
    actor: overrides.actor ?? 'character-1',
    target: overrides.target ?? 'Torch',
    amount: overrides.amount,
    confidence: overrides.confidence ?? 0.8,
    evidence: overrides.evidence ?? {start: 0, end: 10, text: 'Kael did something'},
    createdAt: overrides.createdAt ?? 1,
    stat: overrides.stat
  };
}

describe('stateMutationDerivation', () => {
  it('builds accepted deterministic-review events after existing manual scene steps', () => {
    const existingEvents: StateMutationEvent[] = [
      {
        id: 'manual-event',
        projectId: 'project-1',
        sceneId: 'scene-1',
        sceneOrder: 1,
        sceneSequence: 2,
        sourceType: 'manual',
        sourceRevision: 10,
        sourceHash: 'h1',
        status: 'accepted',
        commands: [{type: 'location_set', actorId: 'character-1', locationName: 'Camp'}],
        createdAt: 1
      },
      {
        id: 'old-generated',
        projectId: 'project-1',
        sceneId: 'scene-1',
        sceneOrder: 1,
        sceneSequence: 3,
        sourceType: 'deterministic-review',
        sourceRevision: 9,
        sourceHash: 'h0',
        status: 'accepted',
        commands: [{type: 'inventory_add', actorId: 'character-1', itemName: 'Old Key'}],
        createdAt: 1
      }
    ];

    const derived = buildDerivedStateMutationEvents({
      projectId: 'project-1',
      sceneId: 'scene-1',
      sceneTitle: 'Scene 1',
      sceneOrder: 1,
      sourceRevision: 10,
      sourceHash: 'h2',
      observations: [
        makeObservation({
          id: 'obs-1',
          operation: 'inventory_add',
          target: 'Rope',
          amount: 1
        }),
        makeObservation({
          id: 'obs-2',
          operation: 'inventory_equip',
          target: 'Rope'
        }),
        makeObservation({
          id: 'obs-3',
          operation: 'inventory_equip',
          target: 'Lantern'
        })
      ],
      characterSheets: [sheet],
      ruleset,
      existingEvents
    });

    expect(derived).toHaveLength(2);
    expect(
      derived.map((event) => ({
        sourceType: event.sourceType,
        status: event.status,
        sceneSequence: event.sceneSequence,
        command: event.commands[0]
      }))
    ).toEqual([
      {
        sourceType: 'deterministic-review',
        status: 'proposed',
        sceneSequence: 3,
        command: {
          type: 'inventory_add',
          actorId: 'character-1',
          itemName: 'Rope',
          quantity: 1
        }
      },
      {
        sourceType: 'deterministic-review',
        status: 'proposed',
        sceneSequence: 4,
        command: {
          type: 'inventory_equip',
          actorId: 'character-1',
          itemName: 'Rope'
        }
      }
    ]);
  });
});
