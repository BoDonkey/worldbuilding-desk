import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Project} from '../../entityTypes';
import type {ProjectSnapshot} from '../storage';
import {DAY_MS} from './backupReminder';
import {
  backupFileName,
  backupFolderNames,
  backupStamp,
  describeBackupRun,
  isDailyBackupDue,
  runScheduledBackups,
  type ScheduledBackupDeps
} from './scheduledBackups';

const NOW = new Date(2026, 10, 23, 14, 5, 1).getTime();

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key)
    }
  });
  return () => vi.unstubAllGlobals();
});

function project(id: string, name: string): Project {
  return {id, name, createdAt: 1, updatedAt: 1} as Project;
}

function snapshotState(overrides: Partial<ElectronBackupSnapshot> = {}): ElectronBackupSnapshot {
  return {folder: '/Backups', folderAvailable: true, schedule: 'daily', keep: 10, lastRun: null, ...overrides};
}

function setup(options: {projects?: Project[]; state?: Partial<ElectronBackupSnapshot>; protectedIds?: string[]} = {}) {
  let state = snapshotState(options.state);
  const content = new Map<string, string>();
  const api = {
    get: vi.fn(async () => state),
    write: vi.fn(async (request: {fileName: string; bytes: Uint8Array}) => ({
      ok: true as const,
      fileName: request.fileName,
      pruned: []
    })),
    recordRun: vi.fn(async (run: ElectronBackupRunResult) => {
      state = {...state, lastRun: run};
      return state;
    })
  };
  let clock = NOW;
  const deps: ScheduledBackupDeps = {
    api: api as unknown as ElectronBackupsAPI,
    getAllProjects: async () => options.projects ?? [project('p1', 'Emberglass Key')],
    isProtectedProject: (id) => (options.protectedIds ?? []).includes(id),
    buildProjectBackup: async (projectId) => ({
      snapshot: {
        generatedAt: clock,
        projectId,
        project: {...project(projectId, projectId), lastBackupAt: clock},
        data: {text: content.get(projectId) ?? 'first draft'}
      } as unknown as ProjectSnapshot,
      zipBytes: new Uint8Array([1, 2, 3])
    }),
    recordProjectBackup: vi.fn(async () => null),
    now: () => clock
  };
  return {
    api,
    deps,
    edit: (projectId: string, text: string) => content.set(projectId, text),
    tick: (ms: number) => {
      clock += ms;
    },
    setState: (patch: Partial<ElectronBackupSnapshot>) => {
      state = {...state, ...patch};
    }
  };
}

describe('backup file names', () => {
  it('uses the local date and time, sortable', () => {
    expect(backupStamp(NOW)).toBe('2026-11-23-140501');
    expect(backupFileName('emberglass-key', NOW)).toBe('emberglass-key-backup-2026-11-23-140501.zip');
  });

  it('gives projects with the same safe name their own folders', () => {
    const names = backupFolderNames([
      project('aaaaaaaa-1', 'Saga'),
      project('bbbbbbbb-2', 'saga!'),
      project('c', 'Other Book')
    ]);
    expect(names.get('aaaaaaaa-1')).toBe('saga-aaaaaaaa');
    expect(names.get('bbbbbbbb-2')).toBe('saga-bbbbbbbb');
    expect(names.get('c')).toBe('other-book');
  });
});

describe('isDailyBackupDue', () => {
  it('is due when never run, a day after the last run, or when a paused folder is back', () => {
    expect(isDailyBackupDue(snapshotState(), NOW)).toBe(true);
    const ran = (finishedAt: number, status: ElectronBackupRunResult['status'] = 'completed') =>
      snapshotState({lastRun: {finishedAt, status, written: [], skipped: [], failed: [], unchanged: 0}});
    expect(isDailyBackupDue(ran(NOW - DAY_MS + 1), NOW)).toBe(false);
    expect(isDailyBackupDue(ran(NOW - DAY_MS), NOW)).toBe(true);
    expect(isDailyBackupDue(ran(NOW - 60_000, 'folder-missing'), NOW)).toBe(true);
  });

  it('is never due when off, on close, without a folder, or with the folder missing', () => {
    expect(isDailyBackupDue(snapshotState({schedule: 'off'}), NOW)).toBe(false);
    expect(isDailyBackupDue(snapshotState({schedule: 'on-close'}), NOW)).toBe(false);
    expect(isDailyBackupDue(snapshotState({folder: null}), NOW)).toBe(false);
    expect(isDailyBackupDue(snapshotState({folderAvailable: false}), NOW)).toBe(false);
  });
});

describe('runScheduledBackups', () => {
  it('writes changed projects, records the backup time, and skips unchanged ones next time', async () => {
    const {api, deps, edit, tick} = setup();
    const first = await runScheduledBackups(deps);
    expect(api.write).toHaveBeenCalledWith({
      fileName: 'emberglass-key-backup-2026-11-23-140501.zip',
      bytes: new Uint8Array([1, 2, 3])
    });
    expect(deps.recordProjectBackup).toHaveBeenCalledWith('p1', NOW);
    expect(first?.written).toEqual([
      {projectName: 'Emberglass Key', fileName: 'emberglass-key/emberglass-key-backup-2026-11-23-140501.zip'}
    ]);

    // Only the time changed: nothing new to back up.
    tick(DAY_MS);
    const second = await runScheduledBackups(deps);
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({status: 'completed', written: [], unchanged: 1});

    edit('p1', 'second draft');
    await runScheduledBackups(deps);
    expect(api.write).toHaveBeenCalledTimes(2);
  });

  it('backs everything up again in a newly chosen folder', async () => {
    const {api, deps, setState} = setup();
    await runScheduledBackups(deps);
    setState({folder: '/Elsewhere'});
    await runScheduledBackups(deps);
    expect(api.write).toHaveBeenCalledTimes(2);
  });

  it('skips protected projects and lists them', async () => {
    const {api, deps} = setup({
      projects: [project('p1', 'Open Book'), project('p2', 'Locked Book')],
      protectedIds: ['p2']
    });
    const run = await runScheduledBackups(deps);
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(run?.skipped).toEqual([{projectName: 'Locked Book', message: 'Protected with a passphrase'}]);
    expect(deps.recordProjectBackup).not.toHaveBeenCalledWith('p2', expect.anything());
  });

  it('pauses on a missing folder without building or recording backups', async () => {
    const {api, deps} = setup({state: {folderAvailable: false}});
    const run = await runScheduledBackups(deps);
    expect(run?.status).toBe('folder-missing');
    expect(api.write).not.toHaveBeenCalled();
    expect(api.recordRun).toHaveBeenCalledWith(expect.objectContaining({status: 'folder-missing'}));
  });

  it('stops when the folder goes missing mid-run and backs up again once it is back', async () => {
    const {api, deps} = setup();
    api.write.mockResolvedValueOnce({ok: false, reason: 'folder-missing'} as never);
    const run = await runScheduledBackups(deps);
    expect(run?.status).toBe('folder-missing');
    expect(deps.recordProjectBackup).not.toHaveBeenCalled();
    await runScheduledBackups(deps);
    expect(api.write).toHaveBeenCalledTimes(2);
  });

  it('records a failed project and goes on to the next', async () => {
    const {api, deps} = setup({projects: [project('p1', 'One'), project('p2', 'Two')]});
    api.write.mockRejectedValueOnce(
      new Error("Error invoking remote method 'backups:write': Error: The disk with the backup folder is full.")
    );
    const run = await runScheduledBackups(deps);
    expect(run?.failed).toEqual([{projectName: 'One', message: 'The disk with the backup folder is full.'}]);
    expect(run?.written.map((item) => item.projectName)).toEqual(['Two']);
  });

  it('does nothing without a folder', async () => {
    const {api, deps} = setup({state: {folder: null}});
    expect(await runScheduledBackups(deps)).toBeNull();
    expect(api.recordRun).not.toHaveBeenCalled();
  });
});

describe('describeBackupRun', () => {
  it('says what the last run did in one sentence', () => {
    expect(describeBackupRun(null, NOW)).toBe('No automatic backup has run yet.');
    const text = describeBackupRun(
      {
        finishedAt: NOW,
        status: 'completed',
        written: [{projectName: 'A'}],
        skipped: [{projectName: 'Locked'}],
        failed: [],
        unchanged: 2
      },
      NOW
    );
    expect(text).toMatch(/^Today at .*: backed up 1 project; 2 projects unchanged; skipped "Locked" \(protected/);
    expect(
      describeBackupRun({finishedAt: NOW, status: 'folder-missing', written: [], skipped: [], failed: [], unchanged: 0}, NOW)
    ).toMatch(/paused because the backup folder is missing/);
  });
});
