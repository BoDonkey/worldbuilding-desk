import {app, BrowserWindow, safeStorage, session, shell} from 'electron';
import {autoUpdater} from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {setupAPIHandlers} from './apiHandler';
import {resolveDataFolder, testAppDataFolder} from './dataFolder';
import {openExternalIfSafe} from './externalLinks';
import {ProviderKeyVault} from './providerKeyVault';
import {setupUpdateHandlers, testUpdateFeedUrl} from './updateIpc';
import {UpdateController, UpdatePreferenceStore} from './updates';
import {buildDevContentSecurityPolicy, isRendererNavigation} from './windowPolicy';

const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

/** Settles the data folder before anything opens it; `--user-data-dir` wins. */
function useSagaSpineDataFolder() {
  if (app.commandLine.hasSwitch('user-data-dir')) return;
  const appData = testAppDataFolder(process.env.SAGASPINE_TEST_APP_DATA) ?? app.getPath('appData');
  try {
    const choice = resolveDataFolder({appData, fs});
    if (choice.outcome === 'moved' || choice.outcome === 'kept-legacy') {
      console.log(`Data folder ${choice.outcome}: ${choice.directory}`, choice.setAside ?? '');
    }
    app.setPath('userData', choice.directory);
  } catch (error) {
    console.error('Could not prepare the SagaSpine data folder; using the default.', error);
  }
}
useSagaSpineDataFolder();
/** Startup checks wait so they never slow the first window. */
const STARTUP_UPDATE_CHECK_DELAY_MS = 8_000;

function createUpdateController(): UpdateController {
  const feedUrl = testUpdateFeedUrl(process.env.SAGASPINE_TEST_UPDATE_FEED);
  if (feedUrl) autoUpdater.setFeedURL({provider: 'generic', url: feedUrl});
  // SagaSpine ships full NSIS installers, never the web installer that fetches its payload later.
  autoUpdater.disableWebInstaller = true;
  // Linux updates only as an AppImage; other unpackaged runs have nothing to update.
  const supported = app.isPackaged && (process.platform !== 'linux' || Boolean(process.env.APPIMAGE));
  return new UpdateController({
    updater: autoUpdater,
    preferences: new UpdatePreferenceStore({directory: app.getPath('userData')}),
    currentVersion: app.getVersion(),
    supported,
    // In-app installs on macOS need a signed build (Slice 5.2).
    installMode: process.platform === 'darwin' ? 'release-page' : 'in-app',
    log: (message, error) => console.error(message, error)
  });
}

function rendererIndexHtml(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'renderer', 'index.html');
  }
  return path.resolve(__dirname, '../../../web/dist/index.html');
}

function rendererUrl(): string {
  return isDevelopment && devServerUrl ? devServerUrl : pathToFileURL(rendererIndexHtml()).href;
}

/** The packaged renderer carries its CSP as a meta tag; the dev server gets it as a header. */
function installDevContentSecurityPolicy() {
  if (!(isDevelopment && devServerUrl)) return;
  const origin = new URL(devServerUrl).origin;
  const policy = buildDevContentSecurityPolicy(devServerUrl);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith(origin)) {
      callback({});
      return;
    }
    callback({
      responseHeaders: {...details.responseHeaders, 'Content-Security-Policy': [policy]}
    });
  });
}

async function loadRenderer(win: BrowserWindow) {
  if (isDevelopment && devServerUrl) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({mode: 'detach'});
    return;
  }

  await win.loadFile(rendererIndexHtml());
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    openExternalIfSafe(url, (safeUrl) => shell.openExternal(safeUrl));
    return {action: 'deny'};
  });

  // A link or script must not navigate the app window away from the
  // renderer; web links open in the browser instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isRendererNavigation(url, rendererUrl())) return;
    event.preventDefault();
    openExternalIfSafe(url, (safeUrl) => shell.openExternal(safeUrl));
  });

  await loadRenderer(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupAPIHandlers(
    new ProviderKeyVault({directory: app.getPath('userData'), cipher: safeStorage})
  );
  const updates = createUpdateController();
  setupUpdateHandlers(updates, (url) => openExternalIfSafe(url, (safeUrl) => shell.openExternal(safeUrl)));
  installDevContentSecurityPolicy();
  createMainWindow()
    .then(() => {
      setTimeout(() => void updates.checkAtStartup(), STARTUP_UPDATE_CHECK_DELAY_MS);
    })
    .catch((error) => {
      console.error('Failed to create Electron window', error);
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error) => {
        console.error('Failed to recreate Electron window', error);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
