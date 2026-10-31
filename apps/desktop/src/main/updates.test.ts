import {EventEmitter} from 'node:events';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {
  CHECK_FAILED_MESSAGE,
  DOWNLOAD_FAILED_MESSAGE,
  RELEASES_URL,
  UpdateController,
  UpdatePreferenceStore,
  releasePageUrl,
  type UpdateSnapshot
} from './updates';

class FakeUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = false;
  checkResult: () => void = () => this.emit('update-not-available', {version: '1.0.0'});
  downloadResult: () => void = () => {
    this.emit('download-progress', {percent: 40});
    this.emit('update-downloaded', {version: '1.1.0'});
  };
  checkForUpdates = vi.fn(async () => this.checkResult());
  downloadUpdate = vi.fn(async () => this.downloadResult());
  quitAndInstall = vi.fn();
}

async function setup(options: {stored?: object; supported?: boolean; installMode?: UpdateSnapshot['installMode']} = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sagaspine-updates-'));
  if (options.stored) {
    await writeFile(path.join(directory, 'update-preferences.json'), JSON.stringify(options.stored));
  }
  const updater = new FakeUpdater();
  const log = vi.fn();
  const controller = new UpdateController({
    updater,
    preferences: new UpdatePreferenceStore({directory}),
    currentVersion: '1.0.0',
    supported: options.supported ?? true,
    installMode: options.installMode ?? 'in-app',
    log
  });
  return {controller, updater, directory, log};
}

describe('UpdateController', () => {
  it('never downloads on its own, and installs a downloaded update on quit', async () => {
    const {controller, updater} = await setup();
    await controller.getSnapshot();
    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(true);
  });

  it('does not contact the update server at startup until the author opts in', async () => {
    const unanswered = await setup();
    expect((await unanswered.controller.checkAtStartup()).checkAutomatically).toBeNull();
    expect(unanswered.updater.checkForUpdates).not.toHaveBeenCalled();

    const declined = await setup({stored: {checkAutomatically: false}});
    await declined.controller.checkAtStartup();
    expect(declined.updater.checkForUpdates).not.toHaveBeenCalled();

    const accepted = await setup({stored: {checkAutomatically: true}});
    expect((await accepted.controller.checkAtStartup()).status).toEqual({state: 'up-to-date'});
    expect(accepted.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('saves the author answer for the next launch', async () => {
    const {controller, directory} = await setup();
    expect((await controller.setCheckAutomatically(true)).checkAutomatically).toBe(true);
    expect(JSON.parse(await readFile(path.join(directory, 'update-preferences.json'), 'utf8'))).toEqual({
      checkAutomatically: true
    });
    const next = new UpdatePreferenceStore({directory});
    expect(await next.load()).toBe(true);
  });

  it('treats an unreadable preference file as unanswered', async () => {
    const {controller} = await setup({stored: {checkAutomatically: 'yes'}});
    expect((await controller.getSnapshot()).checkAutomatically).toBeNull();
  });

  it('reports an available update, downloads it only when asked, then restarts into it', async () => {
    const {controller, updater} = await setup();
    updater.checkResult = () => updater.emit('update-available', {version: '1.1.0'});
    await controller.getSnapshot();
    const seen: string[] = [];
    controller.onChange((snapshot) => seen.push(snapshot.status.state));

    expect((await controller.check()).status).toEqual({
      state: 'available',
      version: '1.1.0',
      releaseUrl: `${RELEASES_URL}/tag/v1.1.0`
    });
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(controller.install()).toBe(false);

    expect((await controller.download()).status).toEqual({state: 'downloaded', version: '1.1.0'});
    expect(seen).toEqual(['checking', 'available', 'downloading', 'downloading', 'downloaded']);
    expect(controller.install()).toBe(true);
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('leaves macOS updates to the release page until builds are signed', async () => {
    const {controller, updater} = await setup({installMode: 'release-page'});
    updater.checkResult = () => updater.emit('update-available', {version: '1.1.0'});
    await controller.check();
    await controller.download();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect((await controller.getSnapshot()).status.state).toBe('available');
  });

  it('shows plain messages for failed checks and downloads, logging details locally', async () => {
    const {controller, updater, log} = await setup();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('net::ERR_INTERNET_DISCONNECTED'));
    expect((await controller.check()).status).toEqual({state: 'error', message: CHECK_FAILED_MESSAGE});
    expect(log).toHaveBeenCalled();

    updater.checkResult = () => updater.emit('update-available', {version: '1.1.0'});
    await controller.check();
    updater.downloadUpdate.mockRejectedValueOnce(new Error('sha512 checksum mismatch'));
    expect((await controller.download()).status).toEqual({state: 'error', message: DOWNLOAD_FAILED_MESSAGE});
  });

  it('rejects a malformed version instead of offering it', async () => {
    const {controller, updater} = await setup();
    updater.checkResult = () => updater.emit('update-available', {version: '1.1.0/../../evil'});
    expect((await controller.check()).status).toEqual({state: 'error', message: CHECK_FAILED_MESSAGE});
    expect(releasePageUrl('../x')).toBe(RELEASES_URL);
  });

  it('does nothing in builds that cannot update, and ignores a second check while one runs', async () => {
    const unsupported = await setup({supported: false, stored: {checkAutomatically: true}});
    await unsupported.controller.check();
    await unsupported.controller.checkAtStartup();
    expect(unsupported.updater.checkForUpdates).not.toHaveBeenCalled();

    const {controller, updater} = await setup();
    let finish: () => void = () => {};
    updater.checkForUpdates.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const first = controller.check();
    await vi.waitFor(() => expect(updater.checkForUpdates).toHaveBeenCalledTimes(1));
    await controller.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    updater.emit('update-not-available', {});
    finish();
    expect((await first).status).toEqual({state: 'up-to-date'});
  });
});
