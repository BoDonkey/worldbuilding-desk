import {
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME
} from '../db';
import {readProjectRecords} from '../projectIndex';
import type {
  ActorResolution,
  CharacterIdentityMigrationReport
} from '../../characters/characterIdentity';

function getProjectRecords<T extends {projectId: string}>(
  storeName: string,
  projectId: string
): Promise<T[]> {
  return readProjectRecords<T>(storeName, projectId);
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
