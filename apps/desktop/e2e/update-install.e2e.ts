import {_electron, expect, test, type ElectronApplication, type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {serveReleaseFolder} from './fakeUpdateFeed';
import {openFromRail, openSampleProject} from './fixtures';

/*
 * Update from the previous version (Slice 5.1), Windows only: CI installs an
 * older SagaSpine with its NSIS installer, then this test creates a project,
 * updates through Settings from a local copy of the newer release, and opens
 * the same profile in the updated app. Set by the Desktop update CI job:
 *   E2E_UPDATE_EXECUTABLE  installed SagaSpine.exe
 *   E2E_UPDATE_FEED_DIR    electron-builder output of the newer version
 *   E2E_UPDATE_TO_VERSION  the newer version
 */
const executable = process.env.E2E_UPDATE_EXECUTABLE ?? '';
const feedDirectory = process.env.E2E_UPDATE_FEED_DIR ?? '';
const toVersion = process.env.E2E_UPDATE_TO_VERSION ?? '';

test.skip(!executable || process.platform !== 'win32', 'Runs in the Windows Desktop update CI job.');
test.setTimeout(300_000);

const installedVersion = () =>
  execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${executable}').VersionInfo.FileVersion`], {
    encoding: 'utf8'
  }).trim();

const stopRunningApps = () => {
  try {
    execFileSync('taskkill', ['/F', '/IM', path.basename(executable)], {stdio: 'ignore'});
  } catch {
    // Nothing was running.
  }
};

async function launch(userDataDir: string, feedUrl: string): Promise<{app: ElectronApplication; page: Page}> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  delete env.ELECTRON_RUN_AS_NODE;
  env.SAGASPINE_TEST_UPDATE_FEED = feedUrl;
  const app = await _electron.launch({executablePath: executable, args: [`--user-data-dir=${userDataDir}`], env});
  await app.context().route(/^https:\/\/([a-z0-9-]+\.)*(huggingface\.co|hf\.co|jsdelivr\.net)\//, (route) => route.abort());
  const page = await app.firstWindow();
  await page.waitForURL(/#\/(workspace|projects)$/, {timeout: 60_000});
  return {app, page};
}

test('updates an installed SagaSpine to the next version and keeps the project', async () => {
  const fromVersion = installedVersion();
  expect(fromVersion).not.toBe(toVersion);
  const feed = await serveReleaseFolder(feedDirectory);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sagaspine-update-'));
  try {
    const first = await launch(userDataDir, feed.url);
    expect(await first.app.evaluate(({app}) => app.getVersion())).toBe(fromVersion);
    await first.page.getByRole('button', {name: "Don't check automatically"}).click();
    await openSampleProject(first.page);

    await openFromRail(first.page, 'Settings');
    await first.page.locator('summary', {hasText: 'Updates'}).click();
    await first.page.getByRole('button', {name: 'Check for updates'}).click();
    await expect(first.page.getByRole('status').filter({hasText: `SagaSpine ${toVersion} is available`})).toBeVisible();
    await first.page.getByRole('button', {name: 'Download update'}).first().click();
    const restart = first.page.getByRole('button', {name: 'Restart to update'}).first();
    await expect(restart).toBeVisible({timeout: 120_000});
    const closed = first.app.waitForEvent('close');
    await restart.click();
    await closed;

    // The installer replaces the app, then starts it again on the author's own profile.
    await expect.poll(installedVersion, {timeout: 180_000, intervals: [2_000]}).toBe(toVersion);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    stopRunningApps();

    const updated = await launch(userDataDir, feed.url);
    expect(await updated.app.evaluate(({app}) => app.getVersion())).toBe(toVersion);
    await expect(updated.page.getByText('Check for updates automatically?')).toBeHidden();
    await updated.page.getByRole('link', {name: 'Projects'}).first().click();
    await expect(updated.page.getByText('The Emberglass Key (Sample)').first()).toBeVisible();
    await updated.page.getByRole('link', {name: 'Workspace'}).first().click();
    await expect(updated.page.locator('.tiptap[contenteditable="true"]')).toContainText('The tide went out at four bells');
    await updated.app.close();
  } finally {
    // Cleanup must not hide the test's own failure.
    stopRunningApps();
    await feed.close();
    try {
      fs.rmSync(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 500});
    } catch (error) {
      console.warn('Could not remove the test profile.', error);
    }
  }
});
