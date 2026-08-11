import {
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME,
  openDb
} from '../../db';
import type {
  ActorResolution,
  CharacterIdentityMigrationReport
} from './characterIdentity';

function getProjectRecords<T extends {projectId: string}>(
  storeName: string,
  projectId: string
): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => {
          resolve(
            (request.result as T[]).filter((record) => record.projectId === projectId)
          );
        };
        request.onerror = () => reject(request.error);
      })
  );
}

export const getActorResolutionsByProject = (projectId: string): Promise<ActorResolution[]> =>
  getProjectRecords<ActorResolution>(ACTOR_RESOLUTION_STORE_NAME, projectId);

export async function getCharacterIdentityMigrationReport(
  projectId: string
): Promise<CharacterIdentityMigrationReport | null> {
  const reports = await getProjectRecords<CharacterIdentityMigrationReport>(
    CHARACTER_IDENTITY_REPORT_STORE_NAME,
    projectId
  );
  return reports.sort((left, right) => right.generatedAt - left.generatedAt)[0] ?? null;
}
