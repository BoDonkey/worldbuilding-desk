import type {CanonDecisionCluster} from '../../../entityTypes';
import {CANON_DECISION_CLUSTER_STORE_NAME, openDb} from '../db';
import {getAllByProject, readProjectRecords} from '../projectIndex';
import {requestToPromise} from '../idbRequest';

function emitCanonDecisionRecordsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wbd:canon-decision-records-changed'));
}

export async function getCanonDecisionClustersByProject(
  projectId: string
): Promise<CanonDecisionCluster[]> {
  return (await readProjectRecords<CanonDecisionCluster>(CANON_DECISION_CLUSTER_STORE_NAME, projectId))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function replaceCanonDecisionClusters(params: {
  projectId: string;
  clusters: CanonDecisionCluster[];
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CANON_DECISION_CLUSTER_STORE_NAME, 'readwrite');
  const store = tx.objectStore(CANON_DECISION_CLUSTER_STORE_NAME);
  const existing = await getAllByProject<CanonDecisionCluster>(store, params.projectId);
  for (const cluster of existing) {
    await requestToPromise(store.delete(cluster.id));
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
