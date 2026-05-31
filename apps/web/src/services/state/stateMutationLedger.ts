import type {StateMutationEvent} from '../../entityTypes';
import {openDb, STATE_MUTATION_EVENT_STORE_NAME} from '../../db';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

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

function getEventCommandFingerprint(event: StateMutationEvent): string {
  return JSON.stringify(event.commands.map((command) => normalizeCommandValue(command)));
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

export async function saveStateMutationEvent(event: StateMutationEvent): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  await requestToPromise(tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME).put(event));
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
}

export async function getStateMutationEventsByProject(
  projectId: string
): Promise<StateMutationEvent[]> {
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readonly');
  const all = (await requestToPromise(
    tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME).getAll()
  )) as StateMutationEvent[];
  return all
    .filter((event) => event.projectId === projectId)
    .sort((a, b) => {
      const orderDelta = (a.sceneOrder ?? Number.MAX_SAFE_INTEGER) - (b.sceneOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) return orderDelta;
      if (a.sceneId === b.sceneId) {
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
  const all = (await requestToPromise(store.getAll())) as StateMutationEvent[];
  const invalidatedAt = params.invalidatedAt ?? Date.now();
  const matching = all.filter(
    (event) =>
      event.projectId === params.projectId &&
      event.sceneId === params.sceneId &&
      event.status !== 'invalidated'
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
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as StateMutationEvent[];
  const invalidatedAt = params.invalidatedAt ?? Date.now();
  const matching = all.filter(
    (event) =>
      event.projectId === params.projectId &&
      event.sceneId === params.sceneId &&
      event.sourceType === params.sourceType &&
      event.status !== 'invalidated'
  );
  const {eventsToInvalidate, eventsToSave} = reconcileSceneStateMutationEvents({
    existingEvents: matching,
    nextEvents: params.nextEvents,
    invalidationReason: params.invalidationReason,
    invalidatedAt
  });

  await Promise.all([
    ...eventsToInvalidate.map((event) => requestToPromise(store.put(event))),
    ...eventsToSave.map((event) => requestToPromise(store.put(event)))
  ]);
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
}
