import 'fake-indexeddb/auto';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Project} from '../../entityTypes';
import {CURRENT_PROJECT_SCHEMA_VERSION} from './projectSchemaMigrations';
import {getProjectById, recordProjectBackup, saveProject} from './repositories/projectStorage';
import {exportProjectBackupZip} from './projectBackupExport';
import {importProjectBackup, parseProjectBackupZip} from './projectBackupImport';

const downloads = vi.hoisted(() => [] as Uint8Array[]);
vi.mock('../../utils/downloadJson', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/downloadJson')>()),
  triggerBytesDownload: (_name: string, data: Uint8Array) => {
    downloads.push(data);
  }
}));

/* Slice 4.93: the last-backup time lives on the project record. */
function project(overrides: Partial<Project> = {}): Project {
  return {
    id: `backup-time-${crypto.randomUUID()}`,
    name: 'Backup Time',
    storageSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

beforeEach(() => {
  downloads.length = 0;
});

describe('last backup time', () => {
  it('is recorded without counting as an edit', async () => {
    const stored = project();
    await saveProject(stored);
    await recordProjectBackup(stored.id, 5000);
    const after = await getProjectById(stored.id);
    expect(after?.lastBackupAt).toBe(5000);
    expect(after?.updatedAt).toBe(1);
  });

  it('survives a later save of an older copy of the project', async () => {
    const stale = project();
    await saveProject(stale);
    await recordProjectBackup(stale.id, 5000);
    await saveProject({...stale, description: 'edited', updatedAt: 2});
    const after = await getProjectById(stale.id);
    expect(after?.description).toBe('edited');
    expect(after?.lastBackupAt).toBe(5000);
  });

  it('travels in the backup file and comes back on restore', async () => {
    const source = project();
    await saveProject(source);
    const result = await exportProjectBackupZip({projectId: source.id, projectName: source.name});
    expect((await getProjectById(source.id))?.lastBackupAt).toBeUndefined();
    expect(downloads).toHaveLength(1);

    const file = new File([new Uint8Array(downloads[0])], result.fileName, {type: 'application/zip'});
    const {snapshot} = await parseProjectBackupZip(file);
    expect(snapshot.project.lastBackupAt).toBe(result.backedUpAt);
    const {projectId} = await importProjectBackup({snapshot, mode: 'new'});
    expect((await getProjectById(projectId))?.lastBackupAt).toBe(result.backedUpAt);
  });
});
