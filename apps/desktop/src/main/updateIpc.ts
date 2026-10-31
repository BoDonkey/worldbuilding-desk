import {BrowserWindow, ipcMain} from 'electron';
import {releasePageUrl, RELEASES_URL, type UpdateController} from './updates';

/**
 * Packaged-app tests point updates at a local feed. Only a loopback HTTP
 * address is accepted, so this cannot redirect an installed app to a remote
 * update server.
 */
export function testUpdateFeedUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    return url.protocol === 'http:' && loopback ? url.href : null;
  } catch {
    return null;
  }
}

/** The renderer can ask for state, check, download, install, and set the one preference. */
export function setupUpdateHandlers(controller: UpdateController, openExternal: (url: string) => void) {
  controller.onChange((snapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('updates:changed', snapshot);
    }
  });
  ipcMain.handle('updates:get', () => controller.getSnapshot());
  ipcMain.handle('updates:check', () => controller.check());
  ipcMain.handle('updates:download', () => controller.download());
  ipcMain.handle('updates:install', () => controller.install());
  ipcMain.handle('updates:set-check-automatically', (_event, value: unknown) => {
    if (typeof value !== 'boolean') throw new Error('Expected true or false');
    return controller.setCheckAutomatically(value);
  });
  // Opens only this app's own release pages, never a renderer-supplied URL.
  ipcMain.handle('updates:open-release-page', async () => {
    const {status} = await controller.getSnapshot();
    openExternal('version' in status ? releasePageUrl(status.version) : RELEASES_URL);
  });
}
