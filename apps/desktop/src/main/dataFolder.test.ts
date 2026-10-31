import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {DATA_FOLDER_MARKER, resolveDataFolder, testAppDataFolder, type DataFolderFs} from './dataFolder';

let appData: string;
const now = () => new Date('2026-10-31T12:00:00.000Z');
const setAsideName = 'SagaSpine (set aside 2026-10-31T12-00-00-000Z)';
const read = (...parts: string[]) => fs.readFileSync(path.join(appData, ...parts), 'utf8');

beforeEach(() => {
  appData = fs.mkdtempSync(path.join(os.tmpdir(), 'sagaspine-data-folder-'));
});

afterEach(() => {
  fs.rmSync(appData, {recursive: true, force: true});
});

function writeLegacyProfile() {
  fs.mkdirSync(path.join(appData, 'desktop', 'IndexedDB'), {recursive: true});
  fs.writeFileSync(path.join(appData, 'desktop', 'IndexedDB', 'projects'), 'author data');
}

describe('resolveDataFolder', () => {
  it('creates the SagaSpine folder on a fresh install', () => {
    const choice = resolveDataFolder({appData, fs, now});
    expect(choice).toEqual({directory: path.join(appData, 'SagaSpine'), outcome: 'created'});
    expect(fs.existsSync(path.join(appData, 'SagaSpine', DATA_FOLDER_MARKER))).toBe(true);
  });

  it('moves the legacy folder with everything in it', () => {
    writeLegacyProfile();
    const choice = resolveDataFolder({appData, fs, now});
    expect(choice.outcome).toBe('moved');
    expect(choice.directory).toBe(path.join(appData, 'SagaSpine'));
    expect(read('SagaSpine', 'IndexedDB', 'projects')).toBe('author data');
    expect(fs.existsSync(path.join(appData, 'desktop'))).toBe(false);
  });

  it('sets an unmarked SagaSpine folder aside instead of skipping the move', () => {
    writeLegacyProfile();
    fs.mkdirSync(path.join(appData, 'SagaSpine'));
    fs.writeFileSync(path.join(appData, 'SagaSpine', 'leftover'), 'test build');
    const choice = resolveDataFolder({appData, fs, now});
    expect(choice.outcome).toBe('moved');
    expect(read('SagaSpine', 'IndexedDB', 'projects')).toBe('author data');
    expect(choice.setAside).toBe(path.join(appData, setAsideName));
    expect(read(setAsideName, 'leftover')).toBe('test build');
  });

  it('never moves anything once the folder is settled', () => {
    resolveDataFolder({appData, fs, now});
    writeLegacyProfile();
    expect(resolveDataFolder({appData, fs, now}).outcome).toBe('ready');
    expect(read('desktop', 'IndexedDB', 'projects')).toBe('author data');
  });

  it('keeps using the legacy folder when the move fails', () => {
    writeLegacyProfile();
    const failingFs: DataFolderFs = {
      ...fs,
      renameSync: () => {
        throw new Error('EBUSY');
      }
    } as DataFolderFs;
    const choice = resolveDataFolder({appData, fs: failingFs, now});
    expect(choice).toEqual({directory: path.join(appData, 'desktop'), outcome: 'kept-legacy', setAside: undefined});
    expect(read('desktop', 'IndexedDB', 'projects')).toBe('author data');
    expect(resolveDataFolder({appData, fs, now}).outcome).toBe('moved');
  });
});

describe('testAppDataFolder', () => {
  it('accepts only an absolute path', () => {
    expect(testAppDataFolder(undefined)).toBeNull();
    expect(testAppDataFolder('relative/dir')).toBeNull();
    expect(testAppDataFolder(appData)).toBe(appData);
  });
});
