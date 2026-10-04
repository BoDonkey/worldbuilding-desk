import {app, BrowserWindow, safeStorage, session, shell} from 'electron';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {setupAPIHandlers} from './apiHandler';
import {openExternalIfSafe} from './externalLinks';
import {ProviderKeyVault} from './providerKeyVault';
import {buildDevContentSecurityPolicy, isRendererNavigation} from './windowPolicy';

const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

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
  installDevContentSecurityPolicy();
  createMainWindow().catch((error) => {
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
