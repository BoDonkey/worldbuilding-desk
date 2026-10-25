import {test as base, _electron, expect, type ElectronApplication, type Page} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const desktopRoot = path.resolve(__dirname, '..');

/**
 * The app under test. `E2E_APP=packaged` runs the `electron-builder --dir`
 * output in `release/` (or the executable named by `E2E_EXECUTABLE`), which is
 * what authors install. Otherwise the built `dist/` runs with `web/dist`.
 */
export function packagedExecutable(): string | undefined {
  if (process.env.E2E_EXECUTABLE) return process.env.E2E_EXECUTABLE;
  if (process.env.E2E_APP !== 'packaged') return undefined;
  const release = path.join(desktopRoot, 'release');
  const dirs = fs.existsSync(release) ? fs.readdirSync(release) : [];
  const candidates =
    process.platform === 'darwin'
      ? dirs.map((dir) => path.join(release, dir, 'SagaSpine.app', 'Contents', 'MacOS', 'SagaSpine'))
      : process.platform === 'win32'
        ? [path.join(release, 'win-unpacked', 'SagaSpine.exe')]
        : [path.join(release, 'linux-unpacked', 'desktop')];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`No packaged app in ${release}. Run "pnpm --filter desktop package:dir" first.`);
  }
  return found;
}

async function launch(userDataDir: string): Promise<{app: ElectronApplication; page: Page}> {
  const executablePath = packagedExecutable();
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  // Set by some editors' terminals; it makes Electron start as plain Node.
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VITE_DEV_SERVER_URL;
  const app = await _electron.launch({
    executablePath,
    args: [...(executablePath ? [] : [path.join(desktopRoot, 'dist', 'main', 'main.js')]), `--user-data-dir=${userDataDir}`],
    env
  });
  // Keep runs offline and repeatable: the in-app embedding model and its
  // runtime normally download on first use, and the app must cope without them.
  await app.context().route(/^https:\/\/([a-z0-9-]+\.)*(huggingface\.co|hf\.co|jsdelivr\.net)\//, (route) => route.abort());
  const page = await app.firstWindow();
  // The start page renders nothing until first-run setup finishes, then
  // redirects. Navigating before that redirect would be undone by it.
  await page.waitForURL(/#\/(workspace|projects)$/, {timeout: 30_000});
  return {app, page};
}

export interface Desktop {
  app: ElectronApplication;
  page: Page;
  /** Errors the renderer logged or threw, including CSP violations. */
  rendererErrors: string[];
  /** Quits and starts the app again on the same profile. */
  relaunch(): Promise<void>;
}

export const test = base.extend<{desktop: Desktop}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here.
  desktop: async ({}, use, testInfo) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sagaspine-e2e-'));
    const desktop = {rendererErrors: []} as unknown as Desktop;
    const open = async () => {
      const launched = await launch(userDataDir);
      desktop.app = launched.app;
      desktop.page = launched.page;
      desktop.page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const source = message.location().url;
        // The app looks for a local Ollama on startup; a refused loopback
        // connection just means none is running on this machine.
        if (/net::ERR_CONNECTION_REFUSED/.test(message.text()) && /^http:\/\/(localhost|127\.0\.0\.1):/.test(source)) return;
        desktop.rendererErrors.push(source ? `${message.text()} (${source})` : message.text());
      });
      desktop.page.on('pageerror', (error) => desktop.rendererErrors.push(error.message));
    };
    desktop.relaunch = async () => {
      await desktop.app.close();
      await open();
    };
    await open();

    await use(desktop);

    if (testInfo.status !== testInfo.expectedStatus) {
      await desktop.page
        .screenshot({path: testInfo.outputPath('failure.png')})
        .catch(() => undefined);
    }
    await desktop.app.close().catch(() => undefined);
    fs.rmSync(userDataDir, {recursive: true, force: true});
  }
});

export {expect};

/** Loads the bundled sample project from a fresh profile and waits for the Workspace. */
export async function openSampleProject(page: Page): Promise<void> {
  await page.getByRole('link', {name: 'Projects'}).first().click();
  await page.getByRole('button', {name: 'Explore a sample project'}).click();
  await page.getByRole('heading', {level: 1, name: 'Writing Workspace'}).waitFor();
}

/** Opens a destination from the side rail, through More when it is not a primary link. */
export async function openFromRail(page: Page, name: string): Promise<void> {
  const rail = page.getByRole('navigation', {name: 'Primary navigation'});
  const link = rail.getByRole('link', {name, exact: true});
  if (await link.isVisible()) {
    await link.click();
    return;
  }
  // First-run setup can re-render the shell and close the menu on a slow
  // machine, so open it again until the click lands.
  const item = page.getByRole('menuitem', {name, exact: true});
  await expect(async () => {
    if (!(await item.isVisible())) await rail.getByRole('button', {name: 'More'}).click();
    await item.click({timeout: 2_000});
  }).toPass({timeout: 20_000});
}
