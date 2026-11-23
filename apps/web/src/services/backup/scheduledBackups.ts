import type {Project} from '../../entityTypes';
import type {ProjectSnapshot} from '../storage';
import {readPreference, writePreference} from '../../utils/browserPreferences';
import {sanitizeFileNamePart} from '../../utils/downloadJson';
import {describeError} from '../errors';
import {DAY_MS} from './backupReminder';

/*
 * Scheduled automatic backups (slice 4.94, desktop only). For each project
 * that changed since its last automatic backup, build the same file as Export
 * Backup and hand its bytes and name to the main process, which writes it
 * into `<folder>/<project>/` and prunes old copies. Protected projects are
 * skipped: their passphrase is never stored, so no unattended copy can be made.
 */

export type BackupsApi = ElectronBackupsAPI;

export function getBackupsApi(): BackupsApi | undefined {
  return typeof window === 'undefined' ? undefined : window.electronAPI?.backups;
}

/** Per project: `scheduledBackupFingerprint:<projectId>` (removed with the project). */
const FINGERPRINT_KEY_PREFIX = 'scheduledBackupFingerprint';

export const FOLDER_MISSING_NOTE = 'Automatic backups are paused: the backup folder is missing.';

/** Local date and time, sortable: `2026-11-23-140501`. */
export function backupStamp(at: number): string {
  const date = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}-` +
    `${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`
  );
}

/**
 * Each project's folder name inside the backup folder: its name made safe.
 * Projects whose names come out the same get a part of their id added, so one
 * project's pruning never removes another's backups.
 */
export function backupFolderNames(projects: Pick<Project, 'id' | 'name'>[]): Map<string, string> {
  const counts = new Map<string, number>();
  const base = new Map(projects.map((project) => [project.id, sanitizeFileNamePart(project.name).slice(0, 60)]));
  for (const name of base.values()) counts.set(name, (counts.get(name) ?? 0) + 1);
  return new Map(
    projects.map((project) => {
      const name = base.get(project.id)!;
      const suffix = sanitizeFileNamePart(project.id, 'id').slice(0, 8);
      return [project.id, (counts.get(name) ?? 0) > 1 ? `${name}-${suffix}` : name];
    })
  );
}

export function backupFileName(folderName: string, at: number): string {
  return `${folderName}-backup-${backupStamp(at)}.zip`;
}

/**
 * What changes when the project changes, and nothing else: the snapshot
 * without the time it was made or the time of the last backup.
 */
export async function snapshotFingerprint(snapshot: ProjectSnapshot): Promise<string> {
  const comparable = {
    ...snapshot,
    generatedAt: 0,
    project: {...snapshot.project, lastBackupAt: undefined}
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(comparable)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Fingerprints are kept per folder, so choosing a new folder backs every project up again. */
function readFingerprint(projectId: string, folder: string): string | null {
  const raw = readPreference(`${FINGERPRINT_KEY_PREFIX}:${projectId}`);
  if (!raw) return null;
  const split = raw.lastIndexOf('\n');
  return split > 0 && raw.slice(0, split) === folder ? raw.slice(split + 1) : null;
}

function writeFingerprint(projectId: string, folder: string, fingerprint: string): void {
  writePreference(`${FINGERPRINT_KEY_PREFIX}:${projectId}`, `${folder}\n${fingerprint}`);
}

/** Whether the daily schedule is due: never run, paused on a missing folder, or a day since. */
export function isDailyBackupDue(snapshot: ElectronBackupSnapshot, now: number): boolean {
  if (snapshot.schedule !== 'daily' || !snapshot.folder || !snapshot.folderAvailable) return false;
  const last = snapshot.lastRun;
  return !last || last.status === 'folder-missing' || now - last.finishedAt >= DAY_MS;
}

export interface ScheduledBackupDeps {
  api: BackupsApi;
  getAllProjects: () => Promise<Project[]>;
  isProtectedProject: (projectId: string) => boolean;
  buildProjectBackup: (projectId: string) => Promise<{snapshot: ProjectSnapshot; zipBytes: Uint8Array}>;
  recordProjectBackup: (projectId: string, backedUpAt: number) => Promise<unknown>;
  now?: () => number;
}

/** One pass over every project. The result is recorded in the main process for Settings. */
export async function runScheduledBackups(deps: ScheduledBackupDeps): Promise<ElectronBackupRunResult | null> {
  const {api} = deps;
  const now = deps.now ?? Date.now;
  const state = await api.get();
  if (!state.folder) return null;
  const folder = state.folder;
  const result: ElectronBackupRunResult = {
    finishedAt: now(),
    status: 'completed',
    written: [],
    skipped: [],
    failed: [],
    unchanged: 0
  };
  if (!state.folderAvailable) {
    result.status = 'folder-missing';
    return api.recordRun(result).then(() => result);
  }

  const projects = await deps.getAllProjects();
  const folderNames = backupFolderNames(projects);
  for (const project of projects) {
    if (deps.isProtectedProject(project.id)) {
      result.skipped.push({projectName: project.name, message: 'Protected with a passphrase'});
      continue;
    }
    try {
      const {snapshot, zipBytes} = await deps.buildProjectBackup(project.id);
      const fingerprint = await snapshotFingerprint(snapshot);
      if (readFingerprint(project.id, folder) === fingerprint) {
        result.unchanged += 1;
        continue;
      }
      const fileName = backupFileName(folderNames.get(project.id)!, snapshot.generatedAt);
      const written = await api.write({fileName, bytes: zipBytes});
      if (!written.ok) {
        result.status = 'folder-missing';
        break;
      }
      writeFingerprint(project.id, folder, fingerprint);
      await deps.recordProjectBackup(project.id, snapshot.generatedAt);
      result.written.push({projectName: project.name, fileName: `${folderNames.get(project.id)}/${written.fileName}`});
    } catch (error) {
      result.failed.push({projectName: project.name, message: plainFailure(error)});
    }
  }
  result.finishedAt = now();
  await api.recordRun(result);
  return result;
}

/** The failure without Electron's "Error invoking remote method" wrapper, in plain words. */
function plainFailure(error: unknown): string {
  const unwrapped =
    error instanceof Error
      ? new Error(error.message.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, ''), {cause: error})
      : error;
  return describeError(unwrapped, 'The backup could not be written.', {context: 'scheduled backup'});
}

/** One plain sentence about the last run, for Settings. */
export function describeBackupRun(run: ElectronBackupRunResult | null, now: number): string {
  if (!run) return 'No automatic backup has run yet.';
  const when = describeWhen(run.finishedAt, now);
  if (run.status === 'folder-missing') return `${when}: paused because the backup folder is missing.`;
  const parts: string[] = [];
  if (run.written.length) parts.push(`backed up ${countOf(run.written.length, 'project')}`);
  if (run.unchanged) parts.push(`${countOf(run.unchanged, 'project')} unchanged`);
  if (run.skipped.length) {
    parts.push(`skipped ${run.skipped.map((item) => `"${item.projectName}"`).join(', ')} (protected with a passphrase)`);
  }
  if (run.failed.length) {
    parts.push(`could not back up ${run.failed.map((item) => `"${item.projectName}" (${item.message ?? 'error'})`).join(', ')}`);
  }
  return `${when}: ${parts.length ? parts.join('; ') : 'no projects to back up'}.`;
}

function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function describeWhen(at: number, now: number): string {
  const time = new Date(at).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  return sameDay ? `Today at ${time}` : `${new Date(at).toLocaleDateString()} at ${time}`;
}
