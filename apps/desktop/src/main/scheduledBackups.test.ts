import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BackupOnCloseGuard} from './scheduledBackupIpc';
import {
  BackupPreferenceStore,
  DEFAULT_KEEP_COPIES,
  backupFolderProblem,
  describeWriteFailure,
  normalizeRunResult,
  parseBackupFileName,
  pruneBackups,
  snapshotOf,
  writeBackupFile
} from './scheduledBackups';

vi.mock('electron', () => ({BrowserWindow: {}, dialog: {}, ipcMain: {}}));

let root: string;
let folder: string;
const bytes = new Uint8Array([0x50, 0x4b, 3, 4]);
const name = (project: string, stamp: string) => `${project}-backup-${stamp}.zip`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sagaspine-backups-'));
  folder = path.join(root, 'Backups');
  fs.mkdirSync(folder);
});

afterEach(() => {
  fs.rmSync(root, {recursive: true, force: true});
});

describe('parseBackupFileName', () => {
  it('accepts only the backup pattern', () => {
    expect(parseBackupFileName('emberglass-key-backup-2026-11-23-140501.zip')).toEqual({
      project: 'emberglass-key',
      stamp: '2026-11-23-140501'
    });
    for (const bad of [
      '../x-backup-2026-11-23-140501.zip',
      'a/b-backup-2026-11-23-140501.zip',
      'a\\b-backup-2026-11-23-140501.zip',
      '..-backup-2026-11-23-140501.zip',
      'Emberglass-backup-2026-11-23-140501.zip',
      'x-backup-2026-11-23.zip',
      'x-backup-2026-11-23-140501.zip.exe',
      'x-backup-2026-11-23-140501.sagabackup',
      '',
      42
    ]) {
      expect(parseBackupFileName(bad)).toBeNull();
    }
  });
});

describe('writeBackupFile', () => {
  it('writes into <folder>/<project>/ and leaves no partial file', async () => {
    const fileName = name('emberglass', '2026-11-23-140501');
    const result = await writeBackupFile({folder, fileName, bytes, keep: 10});
    expect(result).toEqual({ok: true, fileName, pruned: []});
    expect(fs.readFileSync(path.join(folder, 'emberglass', fileName))).toEqual(Buffer.from(bytes));
    expect(fs.readdirSync(path.join(folder, 'emberglass'))).toEqual([fileName]);
  });

  it('refuses names and payloads that are not backups, writing nothing', async () => {
    for (const fileName of ['../../escape-backup-2026-11-23-140501.zip', 'notes.txt', '/etc/passwd']) {
      await expect(writeBackupFile({folder, fileName, bytes, keep: 10})).rejects.toThrow('Not a backup file name.');
    }
    await expect(
      writeBackupFile({folder, fileName: name('a', '2026-11-23-140501'), bytes: 'text', keep: 10})
    ).rejects.toThrow('Not a backup file.');
    await expect(
      writeBackupFile({folder, fileName: name('a', '2026-11-23-140501'), bytes: new Uint8Array(), keep: 10})
    ).rejects.toThrow('Not a backup file.');
    expect(fs.readdirSync(folder)).toEqual([]);
    expect(fs.readdirSync(root)).toEqual(['Backups']);
  });

  it('reports a missing or unset folder instead of creating it', async () => {
    const fileName = name('a', '2026-11-23-140501');
    expect(await writeBackupFile({folder: null, fileName, bytes, keep: 10})).toEqual({ok: false, reason: 'no-folder'});
    const gone = path.join(root, 'Unplugged');
    expect(await writeBackupFile({folder: gone, fileName, bytes, keep: 10})).toEqual({
      ok: false,
      reason: 'folder-missing'
    });
    expect(fs.existsSync(gone)).toBe(false);
  });

  it('refuses a project folder that links outside the chosen folder', async () => {
    const elsewhere = path.join(root, 'Elsewhere');
    fs.mkdirSync(elsewhere);
    fs.symlinkSync(elsewhere, path.join(folder, 'linked'), 'junction');
    await expect(
      writeBackupFile({folder, fileName: name('linked', '2026-11-23-140501'), bytes, keep: 10})
    ).rejects.toThrow('outside the chosen folder');
    expect(fs.readdirSync(elsewhere)).toEqual([]);
  });

  it('keeps the newest copies and prunes the oldest', async () => {
    for (let day = 1; day <= 12; day += 1) {
      const stamp = `2026-11-${String(day).padStart(2, '0')}-120000`;
      await writeBackupFile({folder, fileName: name('saga', stamp), bytes, keep: 10});
    }
    const kept = fs.readdirSync(path.join(folder, 'saga')).sort();
    expect(kept).toHaveLength(10);
    expect(kept[0]).toBe(name('saga', '2026-11-03-120000'));
    expect(kept[9]).toBe(name('saga', '2026-11-12-120000'));
  });
});

describe('pruneBackups', () => {
  it('deletes only this project’s backup files', async () => {
    const projectFolder = path.join(folder, 'saga');
    fs.mkdirSync(projectFolder);
    const keepers = ['notes.txt', 'saga-backup-2026-11-01.zip', name('other', '2026-11-01-000000'), 'saga-backup-manual.zip'];
    for (const file of keepers) fs.writeFileSync(path.join(projectFolder, file), 'x');
    fs.mkdirSync(path.join(projectFolder, name('saga', '2026-01-01-000000')));
    for (const stamp of ['2026-11-01-000000', '2026-11-02-000000', '2026-11-03-000000']) {
      fs.writeFileSync(path.join(projectFolder, name('saga', stamp)), 'x');
    }
    const removed = await pruneBackups({projectFolder, project: 'saga', keep: 1});
    expect(removed).toEqual([name('saga', '2026-11-01-000000'), name('saga', '2026-11-02-000000')]);
    const left = fs.readdirSync(projectFolder).sort();
    expect(left).toEqual(
      [...keepers, name('saga', '2026-01-01-000000'), name('saga', '2026-11-03-000000')].sort()
    );
  });
});

describe('describeWriteFailure', () => {
  it('names common file-system failures plainly', () => {
    const failure = (code: string) => Object.assign(new Error(code), {code});
    expect(describeWriteFailure(failure('ENOSPC'))).toBe('The disk with the backup folder is full.');
    expect(describeWriteFailure(failure('EACCES'))).toMatch(/not allowed to write/);
    expect(describeWriteFailure(new Error('Not a backup file.'))).toBe('Not a backup file.');
  });
});

describe('backupFolderProblem', () => {
  it('refuses the data folder, folders inside it, and folders that hold it', () => {
    const data = path.join(root, 'AppData', 'SagaSpine');
    expect(backupFolderProblem(data, data)).toMatch(/outside SagaSpine's data folder/);
    expect(backupFolderProblem(path.join(data, 'Backups'), data)).toMatch(/outside/);
    expect(backupFolderProblem(path.join(root, 'AppData'), data)).toMatch(/outside/);
    expect(backupFolderProblem(folder, data)).toBeNull();
    expect(backupFolderProblem('relative/folder', data)).toMatch(/full path/);
  });
});

describe('BackupPreferenceStore', () => {
  it('defaults to off, keeps 10, and saves choices', async () => {
    const store = new BackupPreferenceStore({directory: root});
    expect(await store.load()).toEqual({folder: null, schedule: 'off', keep: DEFAULT_KEEP_COPIES, lastRun: null});
    await store.update({folder, schedule: 'daily', keep: 3});
    const reloaded = new BackupPreferenceStore({directory: root});
    expect(await reloaded.load()).toMatchObject({folder, schedule: 'daily', keep: 3});
    expect(snapshotOf(reloaded.get()).folderAvailable).toBe(true);
    fs.rmSync(folder, {recursive: true});
    expect(snapshotOf(reloaded.get()).folderAvailable).toBe(false);
  });

  it('applies a change made before loading finished on top of the saved file', async () => {
    fs.writeFileSync(path.join(root, 'scheduled-backups.json'), JSON.stringify({folder, schedule: 'daily', keep: 3}));
    const store = new BackupPreferenceStore({directory: root});
    void store.load();
    await store.update({keep: 5});
    expect(store.get()).toMatchObject({folder, schedule: 'daily', keep: 5});
    // Later reads see the change, not the file as first loaded.
    expect(await store.whenLoaded()).toMatchObject({keep: 5});
  });

  it('ignores a damaged or hand-edited file', async () => {
    fs.writeFileSync(
      path.join(root, 'scheduled-backups.json'),
      JSON.stringify({folder: 'relative', schedule: 'hourly', keep: 0})
    );
    expect(await new BackupPreferenceStore({directory: root}).load()).toMatchObject({
      folder: null,
      schedule: 'off',
      keep: DEFAULT_KEEP_COPIES
    });
  });
});

describe('normalizeRunResult', () => {
  it('accepts a run result and bounds its text', () => {
    const result = normalizeRunResult({
      finishedAt: 5,
      status: 'completed',
      written: [{projectName: 'Saga', fileName: 'saga-backup-2026-11-23-140501.zip'}],
      skipped: [{projectName: 'Locked'}, {nope: true}],
      failed: [{projectName: 'x'.repeat(1000), message: 'Disk full'}],
      unchanged: 2
    });
    expect(result?.written).toHaveLength(1);
    expect(result?.skipped).toEqual([{projectName: 'Locked', fileName: undefined, message: undefined}]);
    expect(result?.failed[0].projectName).toHaveLength(300);
    expect(normalizeRunResult({finishedAt: 5, status: 'exploded'})).toBeNull();
    expect(normalizeRunResult(null)).toBeNull();
  });
});

describe('BackupOnCloseGuard', () => {
  function setup(shouldRun = true) {
    const timers: Array<() => void> = [];
    const params = {
      shouldRun: vi.fn(() => shouldRun),
      requestRun: vi.fn(),
      proceed: vi.fn(),
      setTimer: vi.fn((callback: () => void) => timers.push(callback)),
      clearTimer: vi.fn()
    };
    return {guard: new BackupOnCloseGuard(params), params, timers};
  }

  it('lets the close through when no on-close backup is due', () => {
    const {guard, params} = setup(false);
    expect(guard.onClose()).toBe(false);
    expect(params.requestRun).not.toHaveBeenCalled();
  });

  it('holds the close once, asks for a run, and proceeds when it finishes', () => {
    const {guard, params} = setup();
    expect(guard.onClose()).toBe(true);
    expect(guard.onClose()).toBe(true);
    expect(params.requestRun).toHaveBeenCalledTimes(1);
    guard.finished();
    expect(params.proceed).toHaveBeenCalledTimes(1);
    expect(params.clearTimer).toHaveBeenCalledTimes(1);
    expect(guard.onClose()).toBe(false);
    guard.finished();
    expect(params.proceed).toHaveBeenCalledTimes(1);
  });

  it('closes anyway when the renderer never answers', () => {
    const {guard, params, timers} = setup();
    guard.onClose();
    timers[0]();
    expect(params.proceed).toHaveBeenCalledTimes(1);
  });

  it('steps aside for an update restart', () => {
    const {guard, params} = setup();
    guard.skipNextClose();
    expect(guard.onClose()).toBe(false);
    expect(params.requestRun).not.toHaveBeenCalled();
  });
});
