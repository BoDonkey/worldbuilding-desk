import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';

/*
 * App updates (Slice 5.1). The author decides whether SagaSpine checks for
 * updates automatically; until they answer, it never contacts the update
 * server on its own. A check sends no project data. Nothing downloads or
 * installs without the author choosing to, and on macOS the update opens
 * the release page until signed builds (5.2) allow in-app installs.
 */

export const RELEASES_URL = 'https://github.com/BoDonkey/worldbuilding-desk/releases';

export type UpdateStatus =
  | {state: 'idle'}
  | {state: 'checking'}
  | {state: 'up-to-date'}
  | {state: 'available'; version: string; releaseUrl: string}
  | {state: 'downloading'; version: string; percent: number}
  | {state: 'downloaded'; version: string}
  | {state: 'error'; message: string};

export interface UpdateSnapshot {
  /** False in development and unpackaged builds, which have nothing to update. */
  supported: boolean;
  currentVersion: string;
  /** null until the author answers the one-time question. */
  checkAutomatically: boolean | null;
  /** How an available update is applied on this platform. */
  installMode: 'in-app' | 'release-page';
  status: UpdateStatus;
}

/** The parts of electron-updater's `autoUpdater` used here, injectable for tests. */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: never[]) => void): unknown;
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const CHECK_FAILED_MESSAGE =
  'SagaSpine could not check for updates. Check your internet connection and try again.';
export const DOWNLOAD_FAILED_MESSAGE = 'The update could not be downloaded. Try again later.';

export function releasePageUrl(version: string): string {
  return VERSION_PATTERN.test(version) ? `${RELEASES_URL}/tag/v${version}` : RELEASES_URL;
}

/** The author's answer, stored in one small file in the app's data folder. */
export class UpdatePreferenceStore {
  private readonly filePath: string;

  constructor(params: {directory: string; fileName?: string}) {
    this.filePath = path.join(params.directory, params.fileName ?? 'update-preferences.json');
  }

  async load(): Promise<boolean | null> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as {checkAutomatically?: unknown};
      return typeof parsed.checkAutomatically === 'boolean' ? parsed.checkAutomatically : null;
    } catch {
      return null;
    }
  }

  async save(checkAutomatically: boolean): Promise<void> {
    await mkdir(path.dirname(this.filePath), {recursive: true});
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify({checkAutomatically}), 'utf8');
    await rename(temporary, this.filePath);
  }
}

export class UpdateController {
  private snapshot: UpdateSnapshot;
  private readonly listeners = new Set<(snapshot: UpdateSnapshot) => void>();
  private readonly ready: Promise<void>;

  constructor(
    private readonly params: {
      updater: UpdaterLike;
      preferences: UpdatePreferenceStore;
      currentVersion: string;
      supported: boolean;
      installMode: UpdateSnapshot['installMode'];
      log?: (message: string, error: unknown) => void;
    }
  ) {
    this.snapshot = {
      supported: params.supported,
      currentVersion: params.currentVersion,
      checkAutomatically: null,
      installMode: params.installMode,
      status: {state: 'idle'}
    };
    // Downloads wait for the author; a downloaded update installs when the
    // author restarts from the app or quits.
    params.updater.autoDownload = false;
    params.updater.autoInstallOnAppQuit = true;
    this.listen();
    this.ready = params.preferences.load().then((checkAutomatically) => {
      this.update({checkAutomatically});
    });
  }

  async getSnapshot(): Promise<UpdateSnapshot> {
    await this.ready;
    return this.snapshot;
  }

  onChange(listener: (snapshot: UpdateSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Checks at startup only when the author chose automatic checks. */
  async checkAtStartup(): Promise<UpdateSnapshot> {
    await this.ready;
    if (this.snapshot.checkAutomatically !== true) return this.snapshot;
    return this.check();
  }

  async setCheckAutomatically(checkAutomatically: boolean): Promise<UpdateSnapshot> {
    await this.ready;
    await this.params.preferences.save(checkAutomatically);
    this.update({checkAutomatically});
    return this.snapshot;
  }

  async check(): Promise<UpdateSnapshot> {
    await this.ready;
    if (!this.snapshot.supported || this.isBusy()) return this.snapshot;
    this.setStatus({state: 'checking'});
    try {
      await this.params.updater.checkForUpdates();
    } catch (error) {
      this.fail(CHECK_FAILED_MESSAGE, error);
    }
    // An updater that resolves without reporting a result found nothing.
    if (this.snapshot.status.state === 'checking') this.setStatus({state: 'up-to-date'});
    return this.snapshot;
  }

  async download(): Promise<UpdateSnapshot> {
    await this.ready;
    const {status} = this.snapshot;
    if (status.state !== 'available' || this.snapshot.installMode !== 'in-app') return this.snapshot;
    this.setStatus({state: 'downloading', version: status.version, percent: 0});
    try {
      await this.params.updater.downloadUpdate();
    } catch (error) {
      this.fail(DOWNLOAD_FAILED_MESSAGE, error);
    }
    return this.snapshot;
  }

  /** Restarts into the downloaded update. Returns false when none is ready. */
  install(): boolean {
    if (this.snapshot.status.state !== 'downloaded') return false;
    this.params.updater.quitAndInstall(false, true);
    return true;
  }

  private isBusy(): boolean {
    const {state} = this.snapshot.status;
    return state === 'checking' || state === 'downloading' || state === 'downloaded';
  }

  private listen() {
    const {updater} = this.params;
    updater.on('update-available', ((info: {version?: unknown}) => {
      const version = typeof info?.version === 'string' ? info.version : '';
      if (!VERSION_PATTERN.test(version)) {
        this.fail(CHECK_FAILED_MESSAGE, new Error(`Unexpected update version: ${String(info?.version)}`));
        return;
      }
      this.setStatus({state: 'available', version, releaseUrl: releasePageUrl(version)});
    }) as (...args: never[]) => void);
    updater.on('update-not-available', (() => {
      this.setStatus({state: 'up-to-date'});
    }) as (...args: never[]) => void);
    updater.on('download-progress', ((progress: {percent?: unknown}) => {
      const {status} = this.snapshot;
      if (status.state !== 'downloading') return;
      const percent = typeof progress?.percent === 'number' ? Math.max(0, Math.min(100, progress.percent)) : 0;
      this.setStatus({...status, percent});
    }) as (...args: never[]) => void);
    updater.on('update-downloaded', ((info: {version?: unknown}) => {
      const {status} = this.snapshot;
      const version =
        typeof info?.version === 'string' ? info.version : 'version' in status ? status.version : '';
      this.setStatus({state: 'downloaded', version});
    }) as (...args: never[]) => void);
    updater.on('error', ((error: unknown) => {
      const message =
        this.snapshot.status.state === 'downloading' ? DOWNLOAD_FAILED_MESSAGE : CHECK_FAILED_MESSAGE;
      this.fail(message, error);
    }) as (...args: never[]) => void);
  }

  private fail(message: string, error: unknown) {
    this.params.log?.('Update failed', error);
    this.setStatus({state: 'error', message});
  }

  private setStatus(status: UpdateStatus) {
    this.update({status});
  }

  private update(changes: Partial<UpdateSnapshot>) {
    this.snapshot = {...this.snapshot, ...changes};
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
