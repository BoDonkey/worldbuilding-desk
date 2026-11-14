import type {WorldMap} from '../../../entityTypes';
import {MAP_STORE_NAME, openDb} from '../db';
import {transactionToPromise} from '../idbRequest';
import {readProjectRecords} from '../projectIndex';

/**
 * Maps of the world (slice 4.79). Validation lives in
 * `services/worldBible/maps.ts`; this file only stores what it is given.
 * Placements and child maps that point at a deleted map are ignored when
 * read, as links to deleted records are.
 */

export const MAPS_CHANGED_EVENT = 'wbd:maps-changed';

function emitMapsChanged(projectId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MAPS_CHANGED_EVENT, {detail: {projectId}}));
}

export async function getMapsByProject(projectId: string): Promise<WorldMap[]> {
  const maps = await readProjectRecords<WorldMap>(MAP_STORE_NAME, projectId);
  return maps.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveMap(map: WorldMap): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MAP_STORE_NAME, 'readwrite');
  tx.objectStore(MAP_STORE_NAME).put(map);
  await transactionToPromise(tx);
  emitMapsChanged(map.projectId);
}

export async function deleteMap(projectId: string, mapId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MAP_STORE_NAME, 'readwrite');
  tx.objectStore(MAP_STORE_NAME).delete(mapId);
  await transactionToPromise(tx);
  emitMapsChanged(projectId);
}
