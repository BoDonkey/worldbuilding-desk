import {describe, expect, it} from 'vitest';
import type {StateMutationEvent} from '../../entityTypes';
import {reconcileSceneStateMutationEvents} from './stateMutationLedger';

function makeEvent(
  overrides: Partial<StateMutationEvent> & Pick<StateMutationEvent, 'id' | 'commands'>
): StateMutationEvent {
  return {
    id: overrides.id,
    projectId: overrides.projectId ?? 'project-1',
    sceneId: overrides.sceneId ?? 'scene-1',
    sceneTitle: overrides.sceneTitle ?? 'Scene 1',
    sceneOrder: overrides.sceneOrder ?? 1,
    sceneSequence: overrides.sceneSequence ?? 1,
    sourceType: overrides.sourceType ?? 'deterministic-review',
    sourceRevision: overrides.sourceRevision ?? 10,
    sourceHash: overrides.sourceHash ?? 'h1',
    status: overrides.status ?? 'proposed',
    commands: overrides.commands,
    createdAt: overrides.createdAt ?? 1,
    invalidatedAt: overrides.invalidatedAt,
    invalidationReason: overrides.invalidationReason
  };
}

describe('stateMutationLedger reconciliation', () => {
  it('preserves accepted deterministic-review events when regenerated commands are equivalent', () => {
    const existingAccepted = makeEvent({
      id: 'accepted-existing',
      status: 'accepted',
      sceneSequence: 3,
      sourceRevision: 4,
      sourceHash: 'old-hash',
      commands: [
        {
          type: 'inventory_add',
          actorId: 'character-1',
          itemName: 'Rope',
          quantity: 1
        }
      ]
    });
    const existingProposed = makeEvent({
      id: 'stale-proposed',
      status: 'proposed',
      sceneSequence: 4,
      commands: [
        {
          type: 'inventory_equip',
          actorId: 'character-1',
          itemName: 'Old Torch'
        }
      ]
    });
    const regeneratedEquivalent = makeEvent({
      id: 'new-proposed-1',
      status: 'proposed',
      sceneSequence: 5,
      sourceRevision: 11,
      sourceHash: 'new-hash',
      commands: [
        {
          type: 'inventory_add',
          actorId: 'character-1',
          itemName: 'Rope',
          quantity: 1
        }
      ]
    });
    const regeneratedNew = makeEvent({
      id: 'new-proposed-2',
      status: 'proposed',
      sceneSequence: 6,
      sourceRevision: 11,
      sourceHash: 'new-hash',
      commands: [
        {
          type: 'inventory_equip',
          actorId: 'character-1',
          itemName: 'Rope'
        }
      ]
    });

    const result = reconcileSceneStateMutationEvents({
      existingEvents: [existingAccepted, existingProposed],
      nextEvents: [regeneratedEquivalent, regeneratedNew],
      invalidationReason: 'Replaced deterministic review-derived state changes after scene save.',
      invalidatedAt: 99
    });

    expect(result.eventsToSave).toEqual([
      {
        ...existingAccepted,
        sceneSequence: 5,
        sourceRevision: 11,
        sourceHash: 'new-hash',
        invalidatedAt: undefined,
        invalidationReason: undefined,
        status: 'accepted'
      },
      regeneratedNew
    ]);
    expect(result.eventsToInvalidate).toEqual([
      {
        ...existingProposed,
        status: 'invalidated',
        invalidatedAt: 99,
        invalidationReason: 'Replaced deterministic review-derived state changes after scene save.'
      }
    ]);
  });
});
