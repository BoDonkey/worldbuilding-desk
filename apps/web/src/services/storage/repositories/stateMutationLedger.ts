import type {StateMutationEvent} from '../../../entityTypes';
import {compareStateMutationEvents} from '@worldbuilding-desk/rules-engine';
import {openDb, STATE_MUTATION_EVENT_STORE_NAME} from '../db';
import {getAllByProject, readProjectRecords} from '../projectIndex';
import {requestToPromise} from '../idbRequest';

/**
 * The state change ledger. It stores events as given. Validation, place
 * linking, and reconciling a re-reviewed scene live in `services/state/`
 * (`stateChangeSave.ts`); save a change through there, not from here.
 */

/** Writes events as they are. */
export async function saveStateMutationEvents(events: StateMutationEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME);
  await Promise.all(events.map((event) => requestToPromise(store.put(event))));
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
}

export async function getStateMutationEventById(
  eventId: string
): Promise<StateMutationEvent | undefined> {
  const db = await openDb();
  return requestToPromise(
    db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readonly')
      .objectStore(STATE_MUTATION_EVENT_STORE_NAME)
      .get(eventId)
  ) as Promise<StateMutationEvent | undefined>;
}

export async function getStateMutationEventsByProject(
  projectId: string
): Promise<StateMutationEvent[]> {
  const all = await readProjectRecords<StateMutationEvent>(STATE_MUTATION_EVENT_STORE_NAME, projectId);
  return all.sort(compareStateMutationEvents);
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

/**
 * Replaces one scene's live events of one source in a single transaction.
 * `plan` receives those events and returns every event to write.
 */
export async function replaceSceneStateMutationEvents(params: {
  projectId: string;
  sceneId: string;
  sourceType: NonNullable<StateMutationEvent['sourceType']>;
  plan: (existingEvents: StateMutationEvent[]) => StateMutationEvent[];
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME);
  const all = await getAllByProject<StateMutationEvent>(store, params.projectId);
  const matching = all.filter(
    (event) =>
      event.sceneId === params.sceneId &&
      event.sourceType === params.sourceType &&
      event.status !== 'invalidated'
  );
  await Promise.all(params.plan(matching).map((event) => requestToPromise(store.put(event))));
  window.dispatchEvent(new CustomEvent('wbd:state-mutation-events-changed'));
}
