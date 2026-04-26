import type {StateMutationEvent} from '../../entityTypes';
import {openDb, STATE_MUTATION_EVENT_STORE_NAME} from '../../db';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveStateMutationEvent(event: StateMutationEvent): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STATE_MUTATION_EVENT_STORE_NAME, 'readwrite');
  await requestToPromise(tx.objectStore(STATE_MUTATION_EVENT_STORE_NAME).put(event));
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
  return matching.length;
}
