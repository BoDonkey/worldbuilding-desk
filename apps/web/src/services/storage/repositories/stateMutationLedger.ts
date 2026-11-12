import type {StateMutationEvent} from '../../../entityTypes';
import {openDb, STATE_MUTATION_EVENT_STORE_NAME} from '../db';
import {getAllByProject, readProjectRecords} from '../projectIndex';
import {requestToPromise} from '../idbRequest';
import {
  buildPlaceNameIndex,
  keepManualPlaceLinks,
  linkEventPlaces,
  type PlaceNameIndex
} from '../../worldBible/placePositions';
import {getAliasesByProject} from './aliasStorage';
import {getCategoriesByProject} from './categoryStorage';
import {getEntitiesByProject} from './entityStorage';

function normalizeCommandValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeCommandValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, normalizeCommandValue(nestedValue)])
    );
  }
  return value;
}

/**
 * What a change does, for matching re-derived changes to accepted ones. A
 * position's place link (slice 4.77) is left out: it is added after the change
 * is derived, so it must not make an accepted move look different.
 */
function getEventCommandFingerprint(event: StateMutationEvent): string {
  return JSON.stringify(event.commands.map((command) =>
    normalizeCommandValue(command.type === 'location_set' ? {...command, placeId: undefined} : command)
  ));
}

export function reconcileSceneStateMutationEvents(params: {
  existingEvents: StateMutationEvent[];
  nextEvents: StateMutationEvent[];
  invalidationReason: string;
  invalidatedAt: number;
}): {
  eventsToSave: StateMutationEvent[];
  eventsToInvalidate: StateMutationEvent[];
} {
  const pendingNextEvents = [...params.nextEvents];
  const eventsToSave: StateMutationEvent[] = [];
  const eventsToInvalidate: StateMutationEvent[] = [];

  params.existingEvents
    .filter((event) => event.status === 'accepted')
    .forEach((existingEvent) => {
      const existingFingerprint = getEventCommandFingerprint(existingEvent);
      const matchingIndex = pendingNextEvents.findIndex(
        (event) => getEventCommandFingerprint(event) === existingFingerprint
      );
      if (matchingIndex === -1) {
        eventsToInvalidate.push({
          ...existingEvent,
          status: 'invalidated',
          invalidatedAt: params.invalidatedAt,
          invalidationReason: params.invalidationReason
        });
        return;
      }

      const nextEvent = pendingNextEvents.splice(matchingIndex, 1)[0];
      eventsToSave.push({
        ...existingEvent,
        sceneTitle: nextEvent.sceneTitle,
        sceneOrder: nextEvent.sceneOrder,
        sceneSequence: nextEvent.sceneSequence,
        scenePosition: nextEvent.scenePosition,
        sceneAnchor: nextEvent.sceneAnchor,
        label: nextEvent.label,
        sourceRevision: nextEvent.sourceRevision,
        sourceHash: nextEvent.sourceHash,
        invalidatedAt: undefined,
        invalidationReason: undefined,
        status: 'accepted'
      });
    });

  params.existingEvents
    .filter((event) => event.status !== 'accepted')
    .forEach((existingEvent) => {
      eventsToInvalidate.push({
        ...existingEvent,
        status: 'invalidated',
        invalidatedAt: params.invalidatedAt,
        invalidationReason: params.invalidationReason
      });
    });

  eventsToSave.push(...pendingNextEvents);

  return {
    eventsToSave,
    eventsToInvalidate
  };
}

async function loadPlaceNameIndex(projectId: string): Promise<PlaceNameIndex> {
  const [categories, entities, aliases] = await Promise.all([
    getCategoriesByProject(projectId),
    getEntitiesByProject(projectId),
    getAliasesByProject(projectId)
  ]);
  return buildPlaceNameIndex({categories, entities, aliases});
}

/**
 * Saves a scene change. A position whose name means exactly one place record
 * is linked to it, and an edit that keeps a position's name keeps its earlier
 * link (slice 4.77). Returns the event as saved.
 */
export async function saveStateMutationEvent(event: StateMutationEvent): Promise<StateMutationEvent> {
  let saved = event;
  if (event.commands.some((command) => command.type === 'location_set')) {
    const [index, previous] = await Promise.all([
      loadPlaceNameIndex(event.projectId),
      openDb().then((db) => requestToPromise(
        db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readonly')
          .objectStore(STATE_MUTATION_EVENT_STORE_NAME)
          .get(event.id)
      ) as Promise<StateMutationEvent | undefined>)
    ]);
    saved = linkEventPlaces(keepManualPlaceLinks(event, previous), index);
  }
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  await requestToPromise(tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME).put(saved));
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
  return saved;
}

/** Saves several changed events at once, as they are (no place linking). */
export async function saveStateMutationEvents(events: StateMutationEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME);
  await Promise.all(events.map((event) => requestToPromise(store.put(event))));
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
}

export async function getStateMutationEventsByProject(
  projectId: string
): Promise<StateMutationEvent[]> {
  const all = await readProjectRecords<StateMutationEvent>(STATE_MUTATION_EVENT_STORE_NAME, projectId);
  return all
    .sort((a, b) => {
      const orderDelta = (a.sceneOrder ?? Number.MAX_SAFE_INTEGER) - (b.sceneOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) return orderDelta;
      if (a.sceneId === b.sceneId) {
        const positionDelta =
          (a.scenePosition ?? Number.MAX_SAFE_INTEGER) -
          (b.scenePosition ?? Number.MAX_SAFE_INTEGER);
        if (positionDelta !== 0) return positionDelta;
        const sequenceDelta =
          (a.sceneSequence ?? Number.MAX_SAFE_INTEGER) -
          (b.sceneSequence ?? Number.MAX_SAFE_INTEGER);
        if (sequenceDelta !== 0) return sequenceDelta;
      }
      if (a.sourceRevision !== b.sourceRevision) return a.sourceRevision - b.sourceRevision;
      return a.createdAt - b.createdAt;
    });
}

export async function getStateMutationEventsByScene(
  projectId: string,
  sceneId: string
): Promise<StateMutationEvent[]> {
  const events = await getStateMutationEventsByProject(projectId);
  return events.filter((event) => event.sceneId === sceneId);
}

export async function invalidateStateMutationEventsFromScene(params: {
  projectId: string;
  sceneId: string;
  reason: string;
  invalidatedAt?: number;
}): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME);
  const all = await getAllByProject<StateMutationEvent>(store, params.projectId);
  const invalidatedAt = params.invalidatedAt ?? Date.now();
  const matching = all.filter(
    (event) => event.sceneId === params.sceneId && event.status !== 'invalidated'
  );
  await Promise.all(
    matching.map((event) =>
      requestToPromise(
        store.put({
          ...event,
          status: 'invalidated',
          invalidatedAt,
          invalidationReason: params.reason
        } satisfies StateMutationEvent)
      )
    )
  );
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
  return matching.length;
}

export async function invalidateStateMutationEventById(params: {
  eventId: string;
  reason: string;
  invalidatedAt?: number;
}): Promise<StateMutationEvent | null> {
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME);
  const existing = (await requestToPromise(
    store.get(params.eventId)
  )) as StateMutationEvent | undefined;

  if (!existing) {
    return null;
  }

  const updated: StateMutationEvent = {
    ...existing,
    status: 'invalidated',
    invalidatedAt: params.invalidatedAt ?? Date.now(),
    invalidationReason: params.reason
  };
  await requestToPromise(store.put(updated));
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
  return updated;
}

export async function replaceSceneStateMutationEventsBySourceType(params: {
  projectId: string;
  sceneId: string;
  sourceType: NonNullable<StateMutationEvent['sourceType']>;
  nextEvents: StateMutationEvent[];
  invalidationReason: string;
  invalidatedAt?: number;
}): Promise<void> {
  // Read before opening the write transaction, which would close while waiting.
  const index = params.nextEvents.some((event) =>
    event.commands.some((command) => command.type === 'location_set')
  )
    ? await loadPlaceNameIndex(params.projectId)
    : null;
  const nextEvents = index
    ? params.nextEvents.map((event) => linkEventPlaces(event, index))
    : params.nextEvents;
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME);
  const all = await getAllByProject<StateMutationEvent>(store, params.projectId);
  const invalidatedAt = params.invalidatedAt ?? Date.now();
  const matching = all.filter(
    (event) =>
      event.sceneId === params.sceneId &&
      event.sourceType === params.sourceType &&
      event.status !== 'invalidated'
  );
  const {eventsToInvalidate, eventsToSave} = reconcileSceneStateMutationEvents({
    existingEvents: matching,
    nextEvents,
    invalidationReason: params.invalidationReason,
    invalidatedAt
  });

  await Promise.all([
    ...eventsToInvalidate.map((event) => requestToPromise(store.put(event))),
    ...eventsToSave.map((event) => requestToPromise(store.put(event)))
  ]);
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
}
