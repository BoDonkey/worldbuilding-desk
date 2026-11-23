import fs from 'node:fs';
import {mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

/*
 * Scheduled automatic backups (slice 4.94). The author picks a folder through
 * a native dialog, a schedule, and how many copies to keep per project. The
 * renderer builds each backup (the same file as Export Backup) and sends only
 * its bytes and file name; this module writes it inside the chosen folder and
 * prunes older copies. It never reads, writes, or deletes anything else.
 */

export type BackupSchedule = 'off' | 'daily' | 'on-close';
export const BACKUP_SCHEDULES: readonly BackupSchedule[] = ['off', 'daily', 'on-close'];
export const DEFAULT_KEEP_COPIES = 10;
export const MAX_KEEP_COPIES = 100;
/** Larger than any real project backup; a guard against a runaway payload. */
export const MAX_BACKUP_BYTES = 1024 * 1024 * 1024;
const MAX_RESULT_ITEMS = 500;
const MAX_TEXT = 300;

/** `<project>-backup-<yyyy-mm-dd-hhmmss>.zip`; the project part is a sanitized name, so no dots or separators. */
const BACKUP_FILE_PATTERN = /^([a-z0-9_-]{1,100})-backup-(\d{4}-\d{2}-\d{2}-\d{6})\.zip$/;

export interface BackupRunItem {
  projectName: string;
  fileName?: string;
  message?: string;
}

/** What the last run did, shown in Settings. */
export interface BackupRunResult {
  finishedAt: number;
  status: 'completed' | 'folder-missing';
  written: BackupRunItem[];
  /** Protected projects: their passphrase is never stored, so they cannot be backed up unattended. */
  skipped: BackupRunItem[];
  failed: BackupRunItem[];
  unchanged: number;
}

export interface BackupPreferences {
  folder: string | null;
  schedule: BackupSchedule;
  keep: number;
  lastRun: BackupRunResult | null;
}

export interface BackupSnapshot extends BackupPreferences {
  /** False when a folder is chosen but missing (an unplugged drive, a deleted folder). */
  folderAvailable: boolean;
}

export type BackupWriteResult =
  | {ok: true; fileName: string; pruned: string[]}
  | {ok: false; reason: 'no-folder' | 'folder-missing'};

const DEFAULT_PREFERENCES: BackupPreferences = {
  folder: null,
  schedule: 'off',
  keep: DEFAULT_KEEP_COPIES,
  lastRun: null
};

export function normalizeKeep(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_KEEP_COPIES
    ? value
    : DEFAULT_KEEP_COPIES;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : undefined;
}

function items(value: unknown): BackupRunItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_RESULT_ITEMS).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const projectName = text(record.projectName);
    if (!projectName) return [];
    return [{projectName, fileName: text(record.fileName), message: text(record.message)}];
  });
}

/** Accepts a run result from the renderer only in the expected shape, with bounded sizes. */
export function normalizeRunResult(value: unknown): BackupRunResult | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.finishedAt !== 'number' || !Number.isFinite(record.finishedAt)) return null;
  if (record.status !== 'completed' && record.status !== 'folder-missing') return null;
  const unchanged = typeof record.unchanged === 'number' && Number.isInteger(record.unchanged) ? record.unchanged : 0;
  return {
    finishedAt: record.finishedAt,
    status: record.status,
    written: items(record.written),
    skipped: items(record.skipped),
    failed: items(record.failed),
    unchanged: Math.max(0, unchanged)
  };
}

function normalizePreferences(value: unknown): BackupPreferences {
  if (!value || typeof value !== 'object') return {...DEFAULT_PREFERENCES};
  const record = value as Record<string, unknown>;
  return {
    folder: typeof record.folder === 'string' && path.isAbsolute(record.folder) ? record.folder : null,
    schedule: BACKUP_SCHEDULES.includes(record.schedule as BackupSchedule) ? (record.schedule as BackupSchedule) : 'off',
    keep: normalizeKeep(record.keep),
    lastRun: normalizeRunResult(record.lastRun)
  };
}

/** The author's backup choices, in one small file in the app's data folder. */
export class BackupPreferenceStore {
  private readonly filePath: string;
  private current: BackupPreferences = {...DEFAULT_PREFERENCES};
  private loading: Promise<BackupPreferences> | null = null;

  constructor(params: {directory: string; fileName?: string}) {
    this.filePath = path.join(params.directory, params.fileName ?? 'scheduled-backups.json');
  }

  load(): Promise<BackupPreferences> {
    this.loading = (async () => {
      try {
        this.current = normalizePreferences(JSON.parse(await readFile(this.filePath, 'utf8')));
      } catch {
        this.current = {...DEFAULT_PREFERENCES};
      }
      return this.get();
    })();
    return this.loading;
  }

  /** Waits for the file to be read, so an early change never replaces it with defaults. */
  async whenLoaded(): Promise<BackupPreferences> {
    await (this.loading ?? this.load());
    return this.get();
  }

  /** The last loaded or saved preferences, read synchronously by the close guard. */
  get(): BackupPreferences {
    return {...this.current};
  }

  async update(patch: Partial<BackupPreferences>): Promise<BackupPreferences> {
    await this.whenLoaded();
    const next = normalizePreferences({...this.current, ...patch});
    await mkdir(path.dirname(this.filePath), {recursive: true});
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(next), 'utf8');
    await rename(temporary, this.filePath);
    this.current = next;
    return this.get();
  }
}

export function snapshotOf(preferences: BackupPreferences): BackupSnapshot {
  return {...preferences, folderAvailable: preferences.folder !== null && isDirectory(preferences.folder)};
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/** The project part of a valid backup file name, or null for anything else. */
export function parseBackupFileName(fileName: unknown): {project: string; stamp: string} | null {
  if (typeof fileName !== 'string') return null;
  const match = BACKUP_FILE_PATTERN.exec(fileName);
  return match ? {project: match[1], stamp: match[2]} : null;
}

/** True when `target` is `folder` itself or inside it. */
export function isInsideFolder(folder: string, target: string): boolean {
  const relative = path.relative(folder, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Whether `candidate` may be the backup folder: an absolute path outside the
 * app's data folder (a backup kept beside the data it protects is lost with it).
 */
export function backupFolderProblem(candidate: string, dataFolder: string): string | null {
  if (!path.isAbsolute(candidate)) return 'Choose a folder by its full path.';
  if (isInsideFolder(dataFolder, candidate) || isInsideFolder(candidate, dataFolder)) {
    return "Choose a folder outside SagaSpine's data folder, so the backups survive if it is lost.";
  }
  return null;
}

/**
 * Writes one backup into `<folder>/<project>/` and keeps the newest `keep`
 * copies there. The project folder comes from the file name, which must match
 * the backup pattern; the resolved path must stay inside the chosen folder.
 */
export async function writeBackupFile(params: {
  folder: string | null;
  fileName: unknown;
  bytes: unknown;
  keep: number;
}): Promise<BackupWriteResult> {
  const {folder, keep} = params;
  if (!folder) return {ok: false, reason: 'no-folder'};
  const parsed = parseBackupFileName(params.fileName);
  if (!parsed) throw new Error('Not a backup file name.');
  const fileName = params.fileName as string;
  const bytes = params.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Not a backup file.');
  }
  if (!isDirectory(folder)) return {ok: false, reason: 'folder-missing'};

  const root = await realpath(folder);
  const projectFolder = path.join(root, parsed.project);
  await mkdir(projectFolder, {recursive: true});
  // A project folder replaced by a link that leads elsewhere is refused.
  const realProjectFolder = await realpath(projectFolder);
  if (!isInsideFolder(root, realProjectFolder) || realProjectFolder === root) {
    throw new Error('The backup folder for this project is outside the chosen folder.');
  }
  const target = path.join(realProjectFolder, fileName);
  const partial = path.join(realProjectFolder, `.${fileName}.partial`);
  await writeFile(partial, bytes);
  await rename(partial, target);
  const pruned = await pruneBackups({projectFolder: realProjectFolder, project: parsed.project, keep});
  return {ok: true, fileName, pruned};
}

/** A file-system failure as a sentence an author can act on. */
export function describeWriteFailure(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === 'ENOSPC') return 'The disk with the backup folder is full.';
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
    return 'SagaSpine is not allowed to write in the backup folder.';
  }
  if (code === 'ENOENT') return 'The backup folder is missing.';
  return error instanceof Error ? error.message : 'The backup could not be written.';
}

/**
 * Deletes the oldest backups beyond `keep` in one project folder. Only files
 * named like this project's backups count; anything else is left alone.
 */
export async function pruneBackups(params: {projectFolder: string; project: string; keep: number}): Promise<string[]> {
  const keep = normalizeKeep(params.keep);
  const names = await readdir(params.projectFolder);
  const backups = names.filter((name) => parseBackupFileName(name)?.project === params.project).sort();
  const excess = backups.slice(0, Math.max(0, backups.length - keep));
  const removed: string[] = [];
  for (const name of excess) {
    const target = path.join(params.projectFolder, name);
    if (!(await stat(target)).isFile()) continue;
    await rm(target);
    removed.push(name);
  }
  return removed;
}
