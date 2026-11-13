import {describe, expect, it} from 'vitest';
import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import {replayCharacterState} from './stateReplay';
import {
  alignStateMutationEventsToScenes,
  countAcceptedSceneStateChanges,
  DELETED_SCENE_INVALIDATION_REASON,
  planStateSceneOrderRepair
} from './stateSceneOrder';

const projectId = 'project-order';

const scene = (id: string, order: number): WritingDocument => ({
  id,
  projectId,
  title: id,
  content: '',
  order,
  createdAt: order,
  updatedAt: order
});

const move = (
  sceneId: string,
  sceneOrder: number,
  locationName: string,
  status: StateMutationEvent['status'] = 'accepted'
): StateMutationEvent => ({
  id: `move-${sceneId}`,
  projectId,
  sceneId,
  sceneOrder,
  sourceType: 'manual',
  sourceRevision: 1,
  sourceHash: 'hash',
  status,
  commands: [{type: 'location_set', actorId: 'mira', locationName}],
  createdAt: sceneOrder
});

const sheet = {id: 'mira', name: 'Mira', stats: [], resources: []};
const target = {actorId: 'mira'};

// Saved while the scenes were A, B, C: Mira goes to the Gate, the Tower, the Harbor.
const savedEvents = [move('a', 1, 'Gate'), move('b', 2, 'Tower'), move('c', 3, 'Harbor')];

const locationAt = (events: StateMutationEvent[], upToSceneOrder?: number) =>
  replayCharacterState({sheet, ruleset: null, events, target, upToSceneOrder}).locationName;

describe('state changes follow the scene list', () => {
  it('renumbers changes when a scene moves', () => {
    // C moved to the front: C, A, B.
    const documents = [scene('c', 0), scene('a', 1), scene('b', 2)];
    const {events, eventsToSave} = planStateSceneOrderRepair({
      events: savedEvents,
      documents,
      now: 10
    });

    expect(events.map((event) => [event.sceneId, event.sceneOrder])).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 3]
    ]);
    expect(eventsToSave).toHaveLength(3);
    // End of the first scene (C) is the Harbor; the end of the manuscript is B's Tower.
    expect(locationAt(events, 1)).toBe('Harbor');
    expect(locationAt(events)).toBe('Tower');
    // The stored numbers alone would give the wrong answer.
    expect(locationAt(savedEvents, 1)).toBe('Gate');
  });

  it('invalidates a deleted scene and renumbers the scenes after it', () => {
    // A deleted: B is now scene 1 and C scene 2.
    const documents = [scene('b', 1), scene('c', 2)];
    const {events} = planStateSceneOrderRepair({events: savedEvents, documents, now: 10});

    const deleted = events.find((event) => event.sceneId === 'a');
    expect(deleted).toMatchObject({
      status: 'invalidated',
      invalidatedAt: 10,
      invalidationReason: DELETED_SCENE_INVALIDATION_REASON
    });
    expect(locationAt(events, 1)).toBe('Tower');
    expect(locationAt(events, 2)).toBe('Harbor');
    // Before the fix, "end of scene 1" skipped B's own change and kept A's.
    expect(locationAt(savedEvents, 1)).toBe('Gate');
  });

  it('writes nothing when every change already matches the scene list', () => {
    const documents = [scene('a', 0), scene('b', 1), scene('c', 2)];
    const {eventsToSave} = planStateSceneOrderRepair({events: savedEvents, documents, now: 10});
    expect(eventsToSave).toEqual([]);
  });

  it('leaves an already invalidated change of a deleted scene alone', () => {
    const invalidated = {...move('gone', 1, 'Gate', 'invalidated'), invalidatedAt: 5};
    const {eventsToSave, events} = planStateSceneOrderRepair({
      events: [invalidated],
      documents: [],
      now: 10
    });
    expect(eventsToSave).toEqual([]);
    expect(events[0]).toBe(invalidated);
  });

  it('aligns without writing, keeping unchanged events identical', () => {
    const documents = [scene('a', 0), scene('c', 1), scene('b', 2)];
    const aligned = alignStateMutationEventsToScenes(savedEvents, documents);
    expect(aligned[0]).toBe(savedEvents[0]);
    expect(aligned.map((event) => event.sceneOrder)).toEqual([1, 3, 2]);
  });

  it('counts only accepted changes in the scene for the delete confirm', () => {
    const events = [
      move('a', 1, 'Gate'),
      {...move('a', 1, 'Tower', 'proposed'), id: 'proposed'},
      {...move('a', 1, 'Harbor', 'invalidated'), id: 'old'},
      move('b', 2, 'Tower')
    ];
    expect(countAcceptedSceneStateChanges(events, 'a')).toBe(1);
  });
});
