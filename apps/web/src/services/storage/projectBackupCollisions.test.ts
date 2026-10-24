import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {
  findProjectBackupCollisions,
  ID_PRESERVING_IMPORT_STORES,
  ProjectBackupCollisionError
} from './projectBackupCollisions';
import {importProjectBackup, normalizeProjectSnapshot} from './projectBackupImport';
import {buildProjectSnapshot, serializeProjectSnapshot, type ProjectSnapshot} from './projectSnapshotService';
import {deleteProject, getAllProjects, saveProject} from './repositories/projectStorage';
import {getEntitiesByProject} from './repositories/entityStorage';
import {getDocumentsByProject} from './repositories/writingStorage';
import {createDefaultSettings, getProjectSettings} from './repositories/settingsStorage';
import {getRuleset, putRulesetRecord} from './repositories/rulesetStorage';
import {ENTITY_STORE_NAME, openDb, WRITING_STORE_NAME} from './db';
import {transactionToPromise} from './idbRequest';

/* Slice 3.24a: import must never take records away from another project. */

async function seedProject(name: string): Promise<string> {
  const projectId = `guard-${crypto.randomUUID()}`;
  await saveProject({id: projectId, name, createdAt: 1, updatedAt: 1});
  await createDefaultSettings(projectId);
  const db = await openDb();
  const tx = db.transaction([ENTITY_STORE_NAME, WRITING_STORE_NAME], 'readwrite');
  tx.objectStore(ENTITY_STORE_NAME).put({
    id: `${projectId}-entity`, projectId, categoryId: 'c', name: 'Mira', fields: {}, links: [], createdAt: 1, updatedAt: 1
  });
  tx.objectStore(WRITING_STORE_NAME).put({
    id: `${projectId}-scene`, projectId, title: 'Opening', content: '<p>Rain.</p>', createdAt: 1, updatedAt: 1
  });
  await transactionToPromise(tx);
  return projectId;
}

const backupOf = async (projectId: string): Promise<ProjectSnapshot> =>
  normalizeProjectSnapshot(JSON.parse(serializeProjectSnapshot(await buildProjectSnapshot(projectId))));

const expectIntact = async (projectId: string) => {
  expect((await getEntitiesByProject(projectId)).map((entity) => entity.name)).toEqual(['Mira']);
  expect((await getDocumentsByProject(projectId)).map((doc) => doc.title)).toEqual(['Opening']);
  expect((await getProjectSettings(projectId))?.projectId).toBe(projectId);
};

const refusal = async (promise: Promise<unknown>): Promise<ProjectBackupCollisionError> => {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(ProjectBackupCollisionError);
  return error as ProjectBackupCollisionError;
};

describe('backup import collision guard', () => {
  it('refuses a new-project import in the browser the backup came from and writes nothing', async () => {
    const sourceId = await seedProject('Ember Archive');
    const backup = await backupOf(sourceId);
    const projectCount = (await getAllProjects()).length;

    const error = await refusal(importProjectBackup({snapshot: backup, mode: 'new'}));

    // Entity, scene, and settings all belong to the source.
    expect(error.report).toEqual({
      recordCount: 3,
      owners: [{projectId: sourceId, projectName: 'Ember Archive', recordCount: 3}]
    });
    expect(error.message).toContain('Nothing was imported. 3 records in this backup already belong to “Ember Archive”');
    expect(error.message).toContain('merge it into “Ember Archive” to restore that project');
    expect((await getAllProjects()).length).toBe(projectCount);
    await expectIntact(sourceId);
  });

  it('refuses a merge into a different project and leaves both untouched', async () => {
    const sourceId = await seedProject('Source');
    const otherId = await seedProject('Other');
    const backup = await backupOf(sourceId);

    const error = await refusal(importProjectBackup({snapshot: backup, mode: 'merge', targetProjectId: otherId}));

    // The target has its own settings, which merge reuses, so only entity and scene collide.
    expect(error.report.recordCount).toBe(2);
    expect(error.message).toContain('Merging it into this project would move them out of that project');
    await expectIntact(sourceId);
    await expectIntact(otherId);
  });

  it('allows restoring a backup into the project it came from', async () => {
    const sourceId = await seedProject('Restorable');
    const backup = await backupOf(sourceId);
    expect((await findProjectBackupCollisions({snapshot: backup, targetProjectId: sourceId})).recordCount).toBe(0);

    await expect(importProjectBackup({snapshot: backup, mode: 'merge', targetProjectId: sourceId})).resolves.toMatchObject({
      projectId: sourceId, mode: 'merge'
    });
    await expectIntact(sourceId);
  });

  it('imports normally when the ids are not in this browser (a backup from another computer)', async () => {
    const sourceId = await seedProject('Travelling');
    const backup = await backupOf(sourceId);
    await deleteProject(sourceId);

    const result = await importProjectBackup({snapshot: backup, mode: 'new'});
    await expectIntact(result.projectId);
  });

  it('counts a ruleset that belongs to another project', async () => {
    const sourceId = await seedProject('Rules owner');
    await putRulesetRecord({
      id: 'shared-ruleset', projectId: sourceId, name: 'Rules', version: '1', statDefinitions: [],
      resourceDefinitions: [], rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
    });
    const freshId = await seedProject('Fresh');
    const backup = await backupOf(freshId);
    await deleteProject(freshId);
    const withRuleset: ProjectSnapshot = {
      ...backup,
      data: {...backup.data, ruleset: {...(await getRuleset('shared-ruleset'))!, projectId: freshId}}
    };

    const error = await refusal(importProjectBackup({snapshot: withRuleset, mode: 'new'}));
    expect(error.report.owners).toEqual([{projectId: sourceId, projectName: 'Rules owner', recordCount: 1}]);
    expect((await getRuleset('shared-ruleset'))?.projectId).toBe(sourceId);
  });

  it('checks every snapshot collection whose import keeps record ids', () => {
    // A new snapshot collection fails to typecheck here until it is classified.
    const importIds: Record<keyof ProjectSnapshot['data'], 'kept' | 'rebuilt'> = {
      settings: 'rebuilt', ruleset: 'rebuilt', scratchpads: 'rebuilt', worldCanvases: 'rebuilt',
      consistencyAliases: 'rebuilt', actorResolutions: 'rebuilt', characterIdentityReports: 'rebuilt',
      mechanicsDrafts: 'rebuilt',
      categories: 'kept', entities: 'kept', writingDocuments: 'kept', corkboardChapterCards: 'kept',
      characters: 'kept', characterSheets: 'kept', loreDocuments: 'kept', loreDocumentLinks: 'kept',
      loreEntityProposals: 'kept', loreFactProposals: 'kept', canonicalFacts: 'kept',
      canonDecisionClusters: 'kept', canonDecisionSuppressions: 'kept', compendiumEntries: 'kept',
      compendiumMilestones: 'kept', compendiumRecipes: 'kept', compendiumProgressRecords: 'kept',
      compendiumActionLogs: 'kept', zoneAffinityProfiles: 'kept', zoneAffinityProgressRecords: 'kept',
      settlementModules: 'kept', settlementStateRecords: 'kept', stateMutationEvents: 'kept'
    };
    // settings and ruleset are checked separately; the rest build ids from the target project.
    const kept = Object.entries(importIds).filter(([, kind]) => kind === 'kept').map(([key]) => key);
    expect(ID_PRESERVING_IMPORT_STORES.map(([, dataKey]) => dataKey).sort()).toEqual(kept.sort());
  });
});
