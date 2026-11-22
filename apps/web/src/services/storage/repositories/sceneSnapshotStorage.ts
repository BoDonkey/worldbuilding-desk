import type {SceneSnapshot} from '../../../entityTypes';
import {openDb, SCENE_SNAPSHOT_STORE_NAME} from '../db';
import {transactionToPromise} from '../idbRequest';
import {readProjectRecords} from '../projectIndex';
import {RECORDS_CHANGED} from '../../recordEvents';

/**
 * Scene snapshots (slice 4.95). Which snapshots to take and which automatic
 * ones to prune is decided in `services/editor/sceneSnapshots.ts`; this file
 * only stores what it is given. Reads go through the projectId index and
 * filter by scene, because a locked vault record exposes only id and
 * projectId.
 */

function emitSceneSnapshotsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RECORDS_CHANGED.sceneSnapshots));
}

/** The scene's snapshots, newest first. */
export async function getSceneSnapshots(projectId: string, sceneId: string): Promise<SceneSnapshot[]> {
  const snapshots = await readProjectRecords<SceneSnapshot>(SCENE_SNAPSHOT_STORE_NAME, projectId);
  return snapshots
    .filter((snapshot) => snapshot.sceneId === sceneId)
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}

/** Saves `snapshot` and deletes `pruneIds` in one transaction. */
export async function saveSceneSnapshot(snapshot: SceneSnapshot, pruneIds: readonly string[] = []): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SCENE_SNAPSHOT_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SCENE_SNAPSHOT_STORE_NAME);
  store.put(snapshot);
  for (const id of pruneIds) store.delete(id);
  await transactionToPromise(tx);
  emitSceneSnapshotsChanged();
}

export async function deleteSceneSnapshot(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SCENE_SNAPSHOT_STORE_NAME, 'readwrite');
  tx.objectStore(SCENE_SNAPSHOT_STORE_NAME).delete(id);
  await transactionToPromise(tx);
  emitSceneSnapshotsChanged();
}
