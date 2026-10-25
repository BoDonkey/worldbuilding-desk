import fs from 'node:fs';
import type {ElectronApplication, Page} from '@playwright/test';
import {expect, openFromRail, openSampleProject, test} from './fixtures';

/**
 * Saves the next download to `savePath` instead of asking where to put it
 * (the installed app shows a save dialog), and resolves with how it ended.
 */
async function saveNextDownload(app: ElectronApplication, savePath: string) {
  await app.evaluate(({session}, target) => {
    const state = {done: false, outcome: '', fileName: ''};
    (globalThis as unknown as {downloadState: typeof state}).downloadState = state;
    session.defaultSession.once('will-download', (_event, item) => {
      state.fileName = item.getFilename();
      item.setSavePath(target);
      item.once('done', (_doneEvent, outcome) => {
        state.outcome = outcome;
        state.done = true;
      });
    });
  }, savePath);
  return () =>
    app.evaluate(() => (globalThis as unknown as {downloadState: {done: boolean; outcome: string; fileName: string}}).downloadState);
}

const SAMPLE = 'The Emberglass Key (Sample)';
const PASSPHRASE = 'tide-and-salt-door';
// The first file input in Backup and import tools is Import Backup.
const importInput = (page: Page) => page.locator('input[type="file"][accept*=".sagabackup"]').first();

/** Exports the sample project's backup through the export dialog and returns the saved file's bytes. */
async function exportSampleBackup(app: ElectronApplication, page: Page, savePath: string, passphrase?: string) {
  const download = await saveNextDownload(app, savePath);
  const sampleCard = page.getByRole('listitem').filter({has: page.locator('strong', {hasText: /^The Emberglass Key \(Sample\)$/})});
  await sampleCard.getByRole('button', {name: 'Export Backup'}).click();
  const dialog = page.getByRole('dialog', {name: `Export a backup of “${SAMPLE}”`});
  if (passphrase) {
    await dialog.getByLabel('Encrypted backup (.sagabackup)').check();
    await dialog.getByLabel('Passphrase', {exact: true}).fill(passphrase);
    await dialog.getByLabel('Confirm passphrase').fill(passphrase);
  }
  await dialog.getByRole('button', {name: 'Export Backup'}).click();

  await expect.poll(async () => (await download()).done, {timeout: 30_000}).toBe(true);
  const result = await download();
  expect(result.outcome).toBe('completed');
  return {fileName: result.fileName, bytes: fs.readFileSync(savePath)};
}

test('exports a project backup to disk and imports it back as a new project', async ({desktop}, testInfo) => {
  const {app, page} = desktop;
  await openSampleProject(page);
  await openFromRail(page, 'Projects');

  const zipPath = testInfo.outputPath('backup.zip');
  const {fileName, bytes} = await exportSampleBackup(app, page, zipPath);
  expect(fileName).toMatch(/Emberglass.*-backup-\d{4}-\d{2}-\d{2}\.zip$/i);
  expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
  expect(bytes.length).toBeGreaterThan(1000);

  // Bring the same file back in through the file input the picker fills.
  await importInput(page).setInputFiles(zipPath);
  await expect(page.getByText(`Loaded backup preview for "${SAMPLE}".`)).toBeVisible();
  await page.getByRole('button', {name: 'Apply Import'}).click();
  await expect(page.getByText(/Count check passed\./)).toBeVisible();
});

test('exports an encrypted backup to disk and opens it only with its passphrase (5.14)', async ({desktop}, testInfo) => {
  const {app, page} = desktop;
  await openSampleProject(page);
  await openFromRail(page, 'Projects');

  const lockedPath = testInfo.outputPath('backup.sagabackup');
  const {fileName, bytes} = await exportSampleBackup(app, page, lockedPath, PASSPHRASE);
  expect(fileName).toMatch(/Emberglass.*-backup-\d{4}-\d{2}-\d{2}\.sagabackup$/i);
  const text = bytes.toString('utf8');
  expect(JSON.parse(text).format).toBe('sagaspine-encrypted-backup');
  expect(text).not.toContain('Emberglass');
  expect(text).not.toContain(PASSPHRASE);

  await importInput(page).setInputFiles(lockedPath);
  const unlock = page.getByRole('dialog', {name: 'Open an encrypted backup'});
  await unlock.getByLabel('Passphrase').fill('not the passphrase');
  await unlock.getByRole('button', {name: 'Open Backup'}).click();
  await expect(unlock.getByRole('alert')).toContainText('That passphrase does not open this backup.');
  await expect(page.getByRole('heading', {name: 'Backup Import Preview'})).toHaveCount(0);

  await unlock.getByLabel('Passphrase').fill(PASSPHRASE);
  await unlock.getByRole('button', {name: 'Open Backup'}).click();
  await expect(page.getByText(`Loaded backup preview for "${SAMPLE}".`)).toBeVisible();
  await page.getByRole('button', {name: 'Apply Import'}).click();
  await expect(page.getByText(/Count check passed\./)).toBeVisible();
});
