import {app, BrowserWindow, shell} from 'electron';
import path from 'node:path';
import {setupAPIHandlers} from './apiHandler';

const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

function rendererIndexHtml(): string {
  return path.resolve(__dirname, '../../web/dist/index.html');
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
    shell.openExternal(url);
    return {action: 'deny'};
  });

  await loadRenderer(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupAPIHandlers();
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
