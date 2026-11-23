import {BrowserWindow, dialog, ipcMain} from 'electron';
import {
  BACKUP_SCHEDULES,
  backupFolderProblem,
  describeWriteFailure,
  normalizeKeep,
  normalizeRunResult,
  snapshotOf,
  writeBackupFile,
  type BackupPreferenceStore,
  type BackupSchedule
} from './scheduledBackups';

/** How long closing waits for the on-close backup before closing anyway. */
export const CLOSE_BACKUP_TIMEOUT_MS = 120_000;

/**
 * Holds the window open while the renderer makes the on-close backup
 * (schedule "When SagaSpine closes"). Closing again while it runs waits for
 * the same run; a renderer that never answers is given up on after a timeout.
 */
export class BackupOnCloseGuard {
  private state: 'idle' | 'running' | 'done' = 'idle';
  private skip = false;
  private finish: (() => void) | null = null;

  constructor(
    private readonly params: {
      shouldRun: () => boolean;
      requestRun: () => void;
      /** Continues the close or quit that was held. */
      proceed: () => void;
      timeoutMs?: number;
      setTimer?: (callback: () => void, ms: number) => unknown;
      clearTimer?: (timer: unknown) => void;
    }
  ) {}

  /** For a close that must not wait, such as restarting into an update. */
  skipNextClose(): void {
    this.skip = true;
  }

  /** Returns true when the close must be held (the caller calls `preventDefault`). */
  onClose(): boolean {
    if (this.skip || this.state === 'done') return false;
    if (this.state === 'running') return true;
    if (!this.params.shouldRun()) return false;
    this.state = 'running';
    const setTimer = this.params.setTimer ?? setTimeout;
    const clearTimer = this.params.clearTimer ?? ((timer: unknown) => clearTimeout(timer as NodeJS.Timeout));
    const timer = setTimer(() => this.finished(), this.params.timeoutMs ?? CLOSE_BACKUP_TIMEOUT_MS);
    this.finish = () => clearTimer(timer);
    this.params.requestRun();
    return true;
  }

  /** The renderer finished (or gave up on) the on-close backup. */
  finished(): void {
    if (this.state !== 'running') return;
    this.state = 'done';
    this.finish?.();
    this.finish = null;
    this.params.proceed();
  }
}

/**
 * The backup bridge: read the choices, pick the folder through a native
 * dialog, set the schedule and copies to keep, write one backup file, record a
 * run. The renderer never names a folder; the one write channel takes a file
 * name and bytes and writes only inside the folder the author picked.
 */
export function setupScheduledBackupHandlers(params: {
  store: BackupPreferenceStore;
  dataFolder: string;
  /** The renderer finished the on-close backup; the window's guard lets the close go on. */
  onCloseRunFinished: () => void;
}) {
  const {store, dataFolder, onCloseRunFinished} = params;
  const snapshot = () => snapshotOf(store.get());
  const broadcast = () => {
    const next = snapshot();
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('backups:changed', next);
    return next;
  };

  ipcMain.handle('backups:get', async () => {
    await store.whenLoaded();
    return snapshot();
  });

  ipcMain.handle('backups:choose-folder', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: 'Choose a folder for automatic backups',
      buttonLabel: 'Use This Folder',
      properties: ['openDirectory', 'createDirectory']
    };
    const choice = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    const folder = choice.canceled ? undefined : choice.filePaths[0];
    if (!folder) return {snapshot: snapshot()};
    const problem = backupFolderProblem(folder, dataFolder);
    if (problem) return {snapshot: snapshot(), error: problem};
    await store.update({folder});
    return {snapshot: broadcast()};
  });

  ipcMain.handle('backups:set-preferences', async (_event, value: unknown) => {
    const patch = (value && typeof value === 'object' ? value : {}) as {schedule?: unknown; keep?: unknown};
    const next: {schedule?: BackupSchedule; keep?: number} = {};
    if (patch.schedule !== undefined) {
      if (!BACKUP_SCHEDULES.includes(patch.schedule as BackupSchedule)) throw new Error('Unknown backup schedule.');
      next.schedule = patch.schedule as BackupSchedule;
    }
    if (patch.keep !== undefined) next.keep = normalizeKeep(patch.keep);
    await store.update(next);
    return broadcast();
  });

  ipcMain.handle('backups:write', async (_event, value: unknown) => {
    const request = (value && typeof value === 'object' ? value : {}) as {fileName?: unknown; bytes?: unknown};
    const {folder, keep} = await store.whenLoaded();
    try {
      return await writeBackupFile({folder, keep, fileName: request.fileName, bytes: request.bytes});
    } catch (error) {
      throw new Error(describeWriteFailure(error), {cause: error});
    }
  });

  ipcMain.handle('backups:record-run', async (_event, value: unknown) => {
    const lastRun = normalizeRunResult(value);
    if (!lastRun) throw new Error('Not a backup run result.');
    await store.update({lastRun});
    return broadcast();
  });

  ipcMain.handle('backups:close-run-finished', () => onCloseRunFinished());
}
