import {describe, expect, it} from 'vitest';
import type {StateMutationCommand, StateMutationEvent} from '../types';
import {buildDescriptiveReplaySheet} from '../descriptive';
import {replayCharacterState} from '../replay';
import {LocationSetStateMutationCommandSchema} from './location';

// Slice 4.77: a position may name a place record id; older entries are text only.
const sera = buildDescriptiveReplaySheet({entityId: 'entity-sera', name: 'Sera'});

const event = (sceneOrder: number, command: StateMutationCommand): StateMutationEvent => ({
  id: `e${sceneOrder}`,
  projectId: 'project-1',
  sceneId: `scene-${sceneOrder}`,
  sceneOrder,
  sourceRevision: 1,
  sourceHash: 'h',
  status: 'accepted',
  commands: [command],
  createdAt: sceneOrder
});

const events: StateMutationEvent[] = [
  event(1, {type: 'location_set', actorId: 'entity-sera', locationName: 'the old mill'}),
  event(2, {
    type: 'location_set',
    actorId: 'entity-sera',
    locationName: 'Ember Archive',
    placeId: 'place-archive'
  }),
  event(3, {type: 'location_set', actorId: 'entity-sera', locationName: 'Highmoor'})
];

const at = (upToSceneOrder: number) =>
  replayCharacterState({
    sheet: sera,
    ruleset: null,
    events,
    target: {actorId: 'entity-sera'},
    upToSceneOrder
  });

describe('location_set with and without a place record', () => {
  it('replays old text entries and new id entries side by side', () => {
    expect(at(1)).toMatchObject({locationName: 'the old mill', locationPlaceId: undefined});
    expect(at(2)).toMatchObject({locationName: 'Ember Archive', locationPlaceId: 'place-archive'});
  });

  it('clears the place id when a later move is text only', () => {
    expect(at(3).locationName).toBe('Highmoor');
    expect(at(3).locationPlaceId).toBeUndefined();
  });

  it('accepts commands with or without a place id, but not an empty one', () => {
    const base = {type: 'location_set', actorId: 'entity-sera', locationName: 'Highmoor'};
    expect(LocationSetStateMutationCommandSchema.safeParse(base).success).toBe(true);
    expect(LocationSetStateMutationCommandSchema.safeParse({...base, placeId: 'place-1'}).success).toBe(true);
    expect(LocationSetStateMutationCommandSchema.safeParse({...base, placeId: ''}).success).toBe(false);
  });
});
