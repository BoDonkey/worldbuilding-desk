import 'fake-indexeddb/auto';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Project, StoredRuleset} from '../../entityTypes';
import {
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  PROJECT_SCOPED_STORE_NAMES,
  PROJECT_STORE_NAME
} from '../../db';
import {
  getRulesetByProjectId,
  replaceRulesetSnapshot
} from '../rules/rulesetService';
import {
  createProjectMigrationBackup,
  ensureProjectStorageCurrent,
  listProjectMigrationBackups,
  ProjectMigrationError,
  restoreProjectMigrationBackup,
  runProjectMigrationPlan
} from './projectSchemaMigrations';

const openedDatabases: Array<{name: string; db: IDBDatabase}> = [];

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function createMigrationTestDb(): Promise<IDBDatabase> {
  const name = `project-migration-${crypto.randomUUID()}`;
  const request = indexedDB.open(name, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore(PROJECT_STORE_NAME, {keyPath: 'id'});
    db.createObjectStore(PROJECT_MIGRATION_BACKUP_STORE_NAME, {keyPath: 'id'});
    PROJECT_SCOPED_STORE_NAMES.forEach((storeName) => {
      db.createObjectStore(storeName, {keyPath: 'id'});
    });
  };
  const db = await requestToPromise(request);
  openedDatabases.push({name, db});
  return db;
}

async function put(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await transactionToPromise(transaction);
}

afterEach(async () => {
  await Promise.all(
    openedDatabases.splice(0).map(
      ({name, db}) =>
        new Promise<void>((resolve) => {
          db.close();
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        })
    )
  );
});

describe('runProjectMigrationPlan', () => {
  const context = {db: {} as IDBDatabase, projectId: 'project-1'};

  it('does nothing and creates no backup when the project is current', async () => {
    const createBackup = vi.fn(async () => 'backup-1');
    const writeVersion = vi.fn(async () => undefined);

    const report = await runProjectMigrationPlan({
      projectId: 'project-1',
      fromVersion: 1,
      targetVersion: 1,
      migrations: [],
      createBackup,
      writeVersion,
      context
    });

    expect(report).toEqual({
      fromVersion: 1,
      toVersion: 1,
      appliedVersions: [],
      backupId: null
    });
    expect(createBackup).not.toHaveBeenCalled();
    expect(writeVersion).not.toHaveBeenCalled();
  });

  it('backs up once, runs contiguous migrations, and checkpoints each version', async () => {
    const calls: string[] = [];

    const report = await runProjectMigrationPlan({
      projectId: 'project-1',
      fromVersion: 1,
      targetVersion: 3,
      migrations: [
        {
          fromVersion: 2,
          toVersion: 3,
          migrate: async () => {
            calls.push('migrate-3');
          }
        },
        {
          fromVersion: 1,
          toVersion: 2,
          migrate: async () => {
            calls.push('migrate-2');
          }
        }
      ],
      createBackup: async () => {
        calls.push('backup');
        return 'backup-1';
      },
      writeVersion: async (version) => {
        calls.push(`write-${version}`);
      },
      context
    });

    expect(calls).toEqual(['backup', 'migrate-2', 'write-2', 'migrate-3', 'write-3']);
    expect(report).toEqual({
      fromVersion: 1,
      toVersion: 3,
      appliedVersions: [2, 3],
      backupId: 'backup-1'
    });
  });

  it('rejects incomplete plans before creating a backup', async () => {
    const createBackup = vi.fn(async () => 'backup-1');

    await expect(
      runProjectMigrationPlan({
        projectId: 'project-1',
        fromVersion: 1,
        targetVersion: 3,
        migrations: [
          {fromVersion: 1, toVersion: 2, migrate: async () => undefined}
        ],
        createBackup,
        writeVersion: async () => undefined,
        context
      })
    ).rejects.toThrow('No project migration is registered for schema 2->3.');
    expect(createBackup).not.toHaveBeenCalled();
  });

  it('does not checkpoint a migration that fails', async () => {
    const writeVersion = vi.fn(async () => undefined);

    const result = runProjectMigrationPlan({
      projectId: 'project-1',
      fromVersion: 1,
      targetVersion: 2,
      migrations: [
        {
          fromVersion: 1,
          toVersion: 2,
          migrate: async () => {
            throw new Error('migration failed');
          }
        }
      ],
      createBackup: async () => 'backup-1',
      writeVersion,
      context
    });

    await expect(result).rejects.toThrow('Restore backup "backup-1" before retrying.');
    await expect(result).rejects.toBeInstanceOf(ProjectMigrationError);
    expect(writeVersion).not.toHaveBeenCalled();
  });

  it('rejects projects written by a newer app', async () => {
    await expect(
      runProjectMigrationPlan({
        projectId: 'project-1',
        fromVersion: 3,
        targetVersion: 2,
        migrations: [],
        createBackup: async () => 'backup-1',
        writeVersion: async () => undefined,
        context
      })
    ).rejects.toThrow('Update the app before opening it.');
  });
});

describe('project migration backup', () => {
  it('stamps an unversioned legacy project at the current baseline', async () => {
    const db = await createMigrationTestDb();
    const project: Project = {
      id: 'project-1',
      name: 'Legacy',
      createdAt: 1,
      updatedAt: 1
    };
    await put(db, PROJECT_STORE_NAME, project);

    const current = await ensureProjectStorageCurrent(db, project);
    const stored = await requestToPromise(
      db.transaction(PROJECT_STORE_NAME, 'readonly').objectStore(PROJECT_STORE_NAME).get(project.id)
    );
    const backups = await requestToPromise(
      db
        .transaction(PROJECT_MIGRATION_BACKUP_STORE_NAME, 'readonly')
        .objectStore(PROJECT_MIGRATION_BACKUP_STORE_NAME)
        .getAll()
    );

    expect(current.storageSchemaVersion).toBe(1);
    expect((stored as Project).storageSchemaVersion).toBe(1);
    expect(backups).toEqual([]);
  });

  it('restores the project and its scoped records without touching another project', async () => {
    const db = await createMigrationTestDb();
    const project: Project = {
      id: 'project-1',
      name: 'Before migration',
      storageSchemaVersion: 1,
      createdAt: 1,
      updatedAt: 1
    };
    await put(db, PROJECT_STORE_NAME, project);
    await put(db, 'entities', {id: 'entity-1', projectId: project.id, name: 'Original'});
    await put(db, 'entities', {id: 'entity-2', projectId: 'project-2', name: 'Untouched'});
    const ruleset = {
      id: 'ruleset-1',
      projectId: project.id,
      name: 'Original ruleset'
    } as StoredRuleset;
    await replaceRulesetSnapshot(project.id, ruleset);

    const backup = await createProjectMigrationBackup({
      db,
      project,
      fromVersion: 1,
      toVersion: 2
    });
    expect((await listProjectMigrationBackups(db, project.id)).map((item) => item.id)).toEqual([
      backup.id
    ]);

    await put(db, PROJECT_STORE_NAME, {
      ...project,
      name: 'After migration',
      storageSchemaVersion: 2
    });
    await put(db, 'entities', {id: 'entity-1', projectId: project.id, name: 'Changed'});
    await put(db, 'entities', {id: 'entity-3', projectId: project.id, name: 'Added'});
    await replaceRulesetSnapshot(project.id, {
      ...ruleset,
      name: 'Changed ruleset'
    });

    const restoredProject = await restoreProjectMigrationBackup(db, backup.id);
    const entities = (await requestToPromise(
      db.transaction('entities', 'readonly').objectStore('entities').getAll()
    )) as Array<{id: string; projectId: string; name: string}>;

    expect(restoredProject).toEqual(project);
    expect(await getRulesetByProjectId(project.id)).toEqual(ruleset);
    expect(entities).toEqual([
      {id: 'entity-1', projectId: project.id, name: 'Original'},
      {id: 'entity-2', projectId: 'project-2', name: 'Untouched'}
    ]);
    await replaceRulesetSnapshot(project.id, null);
  });
});
