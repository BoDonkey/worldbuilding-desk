import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import {
  getDocumentsByProject,
  getStateMutationEventsByProject,
  invalidateStateMutationEventsFromScene,
  saveStateMutationEvents,
  sortWritingDocuments
} from '../storage';
import {compareStateMutationEvents} from './stateReplay';

/**
 * Scene order for state changes (slice 3.38).
 *
 * Replay orders changes, and cuts them off at a scene, by `sceneOrder`. That
 * number is a cache of the scene's 1-based place in the manuscript. The scene
 * list is the truth: these functions keep the cache in step when scenes move,
 * and invalidate a deleted scene's changes so replay ignores them.
 */

export const DELETED_SCENE_INVALIDATION_REASON = 'Its scene was deleted.';

/** 1-based manuscript order for each scene id. */
export const getSceneOrderById = (documents: WritingDocument[]): Map<string, number> =>
  new Map(sortWritingDocuments(documents).map((scene, index) => [scene.id, index + 1]));

/**
 * Sets each change's `sceneOrder` from the current scene list. A change whose
 * scene is gone keeps its stored number; `planStateSceneOrderRepair` deals with
 * it. Unchanged events are returned as the same objects.
 */
export function alignStateMutationEventsToScenes(
  events: StateMutationEvent[],
  documents: WritingDocument[]
): StateMutationEvent[] {
  const orderById = getSceneOrderById(documents);
  return events.map((event) => {
    const order = orderById.get(event.sceneId);
    return order === undefined || order === event.sceneOrder
      ? event
      : {...event, sceneOrder: order};
  });
}

/**
 * The writes that bring a project's changes in line with its scenes: new scene
 * numbers for changes whose scene moved, and invalidation for live changes
 * whose scene no longer exists. `events` is the repaired list, in replay order.
 */
export function planStateSceneOrderRepair(params: {
  events: StateMutationEvent[];
  documents: WritingDocument[];
  now: number;
}): {events: StateMutationEvent[]; eventsToSave: StateMutationEvent[]} {
  const orderById = getSceneOrderById(params.documents);
  const eventsToSave: StateMutationEvent[] = [];
  const events = alignStateMutationEventsToScenes(params.events, params.documents).map(
    (event, index) => {
      let next = event;
      if (!orderById.has(event.sceneId) && event.status !== 'invalidated') {
        next = {
          ...event,
          status: 'invalidated',
          invalidatedAt: params.now,
          invalidationReason: DELETED_SCENE_INVALIDATION_REASON
        };
      }
      if (next !== params.events[index]) eventsToSave.push(next);
      return next;
    }
  );
  return {events: events.sort(compareStateMutationEvents), eventsToSave};
}

/**
 * Loads a project's state changes in current manuscript order, saving any
 * repair first. Use this, not the ledger repository, wherever changes are read
 * for replay or display.
 */
export async function loadStateMutationEventsInSceneOrder(
  projectId: string,
  documents?: WritingDocument[]
): Promise<StateMutationEvent[]> {
  const [storedEvents, scenes] = await Promise.all([
    getStateMutationEventsByProject(projectId),
    documents ? Promise.resolve(documents) : getDocumentsByProject(projectId)
  ]);
  const {events, eventsToSave} = planStateSceneOrderRepair({
    events: storedEvents,
    documents: scenes,
    now: Date.now()
  });
  await saveStateMutationEvents(eventsToSave);
  return events;
}

/** Live accepted changes recorded in one scene, for the delete confirm. */
export const countAcceptedSceneStateChanges = (
  events: StateMutationEvent[],
  sceneId: string
): number =>
  events.filter((event) => event.sceneId === sceneId && event.status === 'accepted').length;

/**
 * After a scene is deleted: invalidate its changes, then renumber the rest
 * against the remaining scenes.
 */
export async function removeDeletedSceneStateChanges(params: {
  projectId: string;
  sceneId: string;
  remainingDocuments: WritingDocument[];
}): Promise<void> {
  await invalidateStateMutationEventsFromScene({
    projectId: params.projectId,
    sceneId: params.sceneId,
    reason: DELETED_SCENE_INVALIDATION_REASON
  });
  await loadStateMutationEventsInSceneOrder(params.projectId, params.remainingDocuments);
}
