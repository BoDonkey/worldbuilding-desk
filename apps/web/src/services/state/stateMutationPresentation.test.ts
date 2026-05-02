import {describe, expect, it} from 'vitest';
import type {CharacterSheet, StateMutationEvent, StoredRuleset} from '../../entityTypes';
import {
  buildStateMutationPreview,
  describeStateMutationAcceptance,
  computeBatchAcceptableStateMutationEventIds
} from './stateMutationPresentation';

const ruleset: StoredRuleset = {
  id: 'ruleset-1',
  projectId: 'project-1',
  name: 'Test Ruleset',
  version: '1.0.0',
  statDefinitions: [{id: 'hp', name: 'HP', type: 'number', defaultValue: 10}],
  resourceDefinitions: [{id: 'mana', name: 'Mana', type: 'number', defaultValue: 4, max: 8}],
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
  inventoryEntries: [{id: 'item-1', mode: 'quick', name: 'Torch', quantity: 1}],
  createdAt: 1,
  updatedAt: 1
};

const acceptedEvent: StateMutationEvent = {
  id: 'event-1',
  projectId: 'project-1',
  sceneId: 'scene-1',
  sceneTitle: 'Scene 1',
  sceneOrder: 1,
  sceneSequence: 1,
  sourceType: 'manual',
  sourceRevision: 10,
  sourceHash: 'h1',
  status: 'accepted',
  commands: [{type: 'inventory_add', actorId: 'character-1', itemName: 'Rope', quantity: 1}],
  createdAt: 1
};

describe('stateMutationPresentation', () => {
  it('builds a reusable preview with summary, effect lines, and validation issues', () => {
    const preview = buildStateMutationPreview({
      sheet,
      ruleset,
      events: [acceptedEvent],
      target: {
        actorId: 'character-1',
        characterId: 'character-1',
        sheetId: 'sheet-1',
        actorName: 'Kael'
      },
      command: {
        type: 'inventory_equip',
        actorId: 'character-1',
        itemName: 'Rope'
      }
    });

    expect(preview.summaryLine).toBe('Equip Rope');
    expect(preview.effectLines).toEqual(['Rope: equipped']);
    expect(preview.validationIssues).toEqual([]);
  });

  it('computes batch-acceptable proposed event ids incrementally within a scene', () => {
    const batchAcceptableIds = computeBatchAcceptableStateMutationEventIds({
      proposedEvents: [
        {
          id: 'proposed-1',
          projectId: 'project-1',
          sceneId: 'scene-2',
          sceneTitle: 'Scene 2',
          sceneOrder: 2,
          sceneSequence: 1,
          sourceType: 'deterministic-review',
          sourceRevision: 20,
          sourceHash: 'h2',
          status: 'proposed',
          commands: [
            {type: 'inventory_add', actorId: 'character-1', itemName: 'Rope', quantity: 1}
          ],
          createdAt: 2
        },
        {
          id: 'proposed-2',
          projectId: 'project-1',
          sceneId: 'scene-2',
          sceneTitle: 'Scene 2',
          sceneOrder: 2,
          sceneSequence: 2,
          sourceType: 'deterministic-review',
          sourceRevision: 20,
          sourceHash: 'h2',
          status: 'proposed',
          commands: [{type: 'inventory_equip', actorId: 'character-1', itemName: 'Rope'}],
          createdAt: 2
        },
        {
          id: 'proposed-3',
          projectId: 'project-1',
          sceneId: 'scene-2',
          sceneTitle: 'Scene 2',
          sceneOrder: 2,
          sceneSequence: 3,
          sourceType: 'deterministic-review',
          sourceRevision: 20,
          sourceHash: 'h2',
          status: 'proposed',
          commands: [{type: 'inventory_equip', actorId: 'character-1', itemName: 'Lantern'}],
          createdAt: 2
        }
      ],
      acceptedEvents: [acceptedEvent],
      characterSheets: [sheet],
      ruleset
    });

    expect(Array.from(batchAcceptableIds)).toEqual(['proposed-1', 'proposed-2']);
  });

  it('describes batch-only and blocked acceptance states for authors', () => {
    expect(
      describeStateMutationAcceptance({
        canAccept: false,
        canAcceptInBatch: true,
        validationIssues: ['Item "Rope" is not present in inventory.']
      })
    ).toBe('Becomes valid if you accept earlier suggested changes in this scene first.');

    expect(
      describeStateMutationAcceptance({
        canAccept: false,
        canAcceptInBatch: false,
        validationIssues: ['Item "Lantern" is not present in inventory.']
      })
    ).toBe('Still blocked after earlier scene steps. Review the issue below before accepting.');
  });
});
