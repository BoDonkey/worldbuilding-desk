import type {CanonDecisionCluster} from '../../entityTypes';
import {CANON_DECISION_CLUSTER_STORE_NAME, openDb} from '../../db';

function emitCanonDecisionRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:canon-decision-records-changed'));
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllCanonDecisionClusters(): Promise<CanonDecisionCluster[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CANON_DECISION_CLUSTER_STORE_NAME, 'readonly');
    const request = tx.objectStore(CANON_DECISION_CLUSTER_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as CanonDecisionCluster[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getCanonDecisionClustersByProject(
  projectId: string
): Promise<CanonDecisionCluster[]> {
  const all = await getAllCanonDecisionClusters();
  return all
    .filter((cluster) => cluster.projectId === projectId)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function replaceCanonDecisionClusters(params: {
  projectId: string;
  clusters: CanonDecisionCluster[];
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CANON_DECISION_CLUSTER_STORE_NAME, 'readwrite');
  const store = tx.objectStore(CANON_DECISION_CLUSTER_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as CanonDecisionCluster[];
  for (const cluster of all) {
    if (cluster.projectId === params.projectId) {
      await requestToPromise(store.delete(cluster.id));
    }
  }
  for (const cluster of params.clusters) {
    await requestToPromise(store.put(cluster));
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  emitCanonDecisionRecordsChanged();
}

export async function saveCanonDecisionCluster(cluster: CanonDecisionCluster): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CANON_DECISION_CLUSTER_STORE_NAME, 'readwrite');
    const request = tx.objectStore(CANON_DECISION_CLUSTER_STORE_NAME).put(cluster);
    request.onsuccess = () => {
      emitCanonDecisionRecordsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
