import type {StateMutationEvent, StoredRuleset} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import {
  getAliasesByProject,
  getCategoriesByProject,
  getEntitiesByProject,
  getStateMutationEventById,
  replaceSceneStateMutationEvents,
  saveStateMutationEvents
} from '../storage';
import {
  buildPlaceNameIndex,
  keepManualPlaceLinks,
  linkEventPlaces,
  type PlaceNameIndex
} from '../worldBible/placePositions';
import {reconcileSceneStateMutationEvents} from './stateChangeReconcile';
import {
  assertStateChangeValid,
  findStateChangeAcceptanceIssues,
  type StateBeforeChange
} from './stateChangeValidation';
import {loadStateMutationEventsInSceneOrder} from './stateSceneOrder';
import type {StateSubject} from './stateSubjects';

/**
 * Saving a state change (slice 3.40). Every path that records or accepts a
 * change goes through `saveStateChange`, so nothing reaches the ledger
 * without the checks in `stateChangeValidation.ts`.
 */

async function loadPlaceNameIndex(projectId: string): Promise<PlaceNameIndex> {
  const [categories, entities, aliases] = await Promise.all([
    getCategoriesByProject(projectId),
    getEntitiesByProject(projectId),
    getAliasesByProject(projectId)
  ]);
  return buildPlaceNameIndex({categories, entities, aliases});
}

const hasPosition = (event: StateMutationEvent): boolean =>
  event.commands.some((command) => command.type === 'location_set');

/**
 * Writes an event whose commands are already checked, such as one that only
 * moved within its scene. A position whose name means exactly one place record
 * is linked to it, and an edit that keeps a position's name keeps its earlier
 * link (slice 4.77). Returns the event as saved.
 */
export async function saveStateChangeRecord(
  event: StateMutationEvent
): Promise<StateMutationEvent> {
  let saved = event;
  if (hasPosition(event)) {
    const [index, previous] = await Promise.all([
      loadPlaceNameIndex(event.projectId),
      getStateMutationEventById(event.id)
    ]);
    saved = linkEventPlaces(keepManualPlaceLinks(event, previous), index);
  }
  await saveStateMutationEvents([saved]);
  return saved;
}

/**
 * Checks a change (shape, ruleset, replayed state for every command), then
 * saves it. Throws with the reasons when a check fails. Returns the event as
 * saved.
 */
export async function saveStateChange(params: {
  event: StateMutationEvent;
  ruleset: StoredRuleset | null;
  before: StateBeforeChange;
}): Promise<StateMutationEvent> {
  assertStateChangeValid(params);
  return saveStateChangeRecord(params.event);
}

/**
 * Accepts a suggested change. The suggestion and the ledger are loaded again
 * first, so the check runs against the story as it is now, not as it was when
 * the suggestion was made or listed.
 */
export async function acceptStateChangeProposal(params: {
  eventId: string;
  projectId: string;
  stateSubjects: StateSubject[];
  actorResolutions?: ActorResolution[];
  ruleset: StoredRuleset | null;
}): Promise<StateMutationEvent> {
  const events = await loadStateMutationEventsInSceneOrder(params.projectId);
  const event = events.find((entry) => entry.id === params.eventId);
  if (!event || event.status !== 'proposed') {
    throw new Error('This suggested change is no longer waiting for review.');
  }
  const accepted: StateMutationEvent = {
    ...event,
    status: 'accepted',
    invalidatedAt: undefined,
    invalidationReason: undefined
  };
  const issues = findStateChangeAcceptanceIssues({
    event: accepted,
    events,
    stateSubjects: params.stateSubjects,
    actorResolutions: params.actorResolutions,
    ruleset: params.ruleset
  });
  if (issues.length > 0) throw new Error(issues.join(' '));
  return saveStateChangeRecord(accepted);
}

/**
 * Replaces a scene's changes from one source after the scene is reviewed
 * again. Accepted changes the new review still derives are kept; the rest are
 * invalidated with the reason given.
 */
export async function replaceSceneStateChangesBySource(params: {
  projectId: string;
  sceneId: string;
  sourceType: NonNullable<StateMutationEvent['sourceType']>;
  nextEvents: StateMutationEvent[];
  invalidationReason: string;
  invalidatedAt?: number;
}): Promise<void> {
  const index = params.nextEvents.some(hasPosition)
    ? await loadPlaceNameIndex(params.projectId)
    : null;
  const nextEvents = index
    ? params.nextEvents.map((event) => linkEventPlaces(event, index))
    : params.nextEvents;
  const invalidatedAt = params.invalidatedAt ?? Date.now();
  await replaceSceneStateMutationEvents({
    projectId: params.projectId,
    sceneId: params.sceneId,
    sourceType: params.sourceType,
    plan: (existingEvents) => {
      const {eventsToInvalidate, eventsToSave} = reconcileSceneStateMutationEvents({
        existingEvents,
        nextEvents,
        invalidationReason: params.invalidationReason,
        invalidatedAt
      });
      return [...eventsToInvalidate, ...eventsToSave];
    }
  });
}
