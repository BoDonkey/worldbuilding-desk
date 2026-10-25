import fs from 'node:fs';
import type {ElectronApplication} from '@playwright/test';
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

test('exports a project backup to disk and imports it back as a new project', async ({desktop}, testInfo) => {
  const {app, page} = desktop;
  await openSampleProject(page);
  await openFromRail(page, 'Projects');

  const zipPath = testInfo.outputPath('backup.zip');
  const download = await saveNextDownload(app, zipPath);
  const sampleCard = page.getByRole('listitem')
    .filter({has: page.locator('strong', {hasText: /^The Emberglass Key \(Sample\)$/})});
  await expect(sampleCard.getByRole('button', {name: 'Export Backup (.zip)'})).toHaveCount(1);
  await sampleCard.getByRole('button', {name: 'Export Backup (.zip)'}).click();

  await expect.poll(async () => (await download()).done, {timeout: 30_000}).toBe(true);
  const result = await download();
  expect(result.outcome).toBe('completed');
  expect(result.fileName).toMatch(/Emberglass.*-backup-\d{4}-\d{2}-\d{2}\.zip$/i);
  const bytes = fs.readFileSync(zipPath);
  expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
  expect(bytes.length).toBeGreaterThan(1000);

  // Bring the same file back in through the file input the picker fills.
  await page.locator('input[type="file"][accept=".zip,application/zip"]').first().setInputFiles(zipPath);
  await expect(page.getByText('Loaded backup preview for "The Emberglass Key (Sample)".')).toBeVisible();
  await page.getByRole('button', {name: 'Apply Import'}).click();
  await expect(page.getByText(/Count check passed\./)).toBeVisible();
});
