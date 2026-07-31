import {describe, expect, it} from 'vitest';
import type {
  CharacterSheet,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../../entityTypes';
import {
  buildStateMutationReviewItems,
  countHiddenStateMutationReviewsByScene,
  getHiddenStateMutationReviewKey
} from './mutationReviewGrouping';

const ruleset = {
  id: 'rules', projectId: 'project', name: 'Rules', description: '', version: '1',
  statDefinitions: [],
  resourceDefinitions: [{id: 'hp', name: 'Health', type: 'number', defaultValue: 10}],
  rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
} satisfies StoredRuleset;

const sheet: CharacterSheet = {
  id: 'sheet', projectId: 'project', characterId: 'character', name: 'Mira',
  level: 1, experience: 0, stats: [],
  resources: [{definitionId: 'hp', current: 10, max: 10}], inventory: [],
  createdAt: 1, updatedAt: 1
};

const document: WritingDocument = {
  id: 'scene', projectId: 'project', title: 'Arrival', content: 'Scene text',
  order: 1, createdAt: 1, updatedAt: 1
};

const proposedEvent: StateMutationEvent = {
  id: 'event', projectId: 'project', sceneId: 'scene', sceneTitle: 'Arrival',
  sceneOrder: 1, sceneSequence: 1, sourceRevision: 1, sourceHash: 'old-hash',
  sourceType: 'deterministic-review', status: 'proposed',
  commands: [
    {type: 'resource_change', actorId: 'character', resourceDefinitionId: 'hp', delta: -2}
  ],
  createdAt: 1
};

describe('mutation review grouping', () => {
  it('uses a stable hidden key for equivalent command objects', () => {
    const first = getHiddenStateMutationReviewKey(proposedEvent);
    const second = getHiddenStateMutationReviewKey({
      ...proposedEvent,
      commands: [
        {delta: -2, resourceDefinitionId: 'hp', actorId: 'character', type: 'resource_change'}
      ]
    });
    expect(first).toBe(second);
  });

  it('builds labeled preview items and filters hidden suggestions', () => {
    const items = buildStateMutationReviewItems({
      characterSheets: [sheet],
      documents: [document],
      hiddenReviewKeys: [],
      ruleset,
      stateMutationEvents: [proposedEvent]
    });
    expect(items).toEqual([
      expect.objectContaining({
        id: 'event', actorLabel: 'Mira', summaryLines: ['Health -2'],
        effectLines: ['Health: 10 -> 8'], canAccept: true
      })
    ]);

    expect(
      buildStateMutationReviewItems({
        characterSheets: [sheet], documents: [document], ruleset,
        hiddenReviewKeys: [getHiddenStateMutationReviewKey(proposedEvent)],
        stateMutationEvents: [proposedEvent]
      })
    ).toEqual([]);
  });

  it('counts hidden deterministic suggestions by scene only', () => {
    const hiddenKey = getHiddenStateMutationReviewKey(proposedEvent);
    expect(
      countHiddenStateMutationReviewsByScene({
        stateMutationEvents: [
          proposedEvent,
          {...proposedEvent, id: 'accepted', status: 'accepted'}
        ],
        hiddenReviewKeys: [hiddenKey]
      })
    ).toEqual({scene: 1});
  });
});
