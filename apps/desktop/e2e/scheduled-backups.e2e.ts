import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {ElectronApplication, Page} from '@playwright/test';
import {expect, openFromRail, openSampleProject, test} from './fixtures';

/*
 * Scheduled automatic backups (slice 4.94): the author picks a folder, a
 * schedule, and how many copies to keep. The folder dialog is answered in the
 * main process, the way the author's choice would arrive.
 */

const SAMPLE_FOLDER = 'the-emberglass-key-sample';
const BACKUP_NAME = /^the-emberglass-key-sample-backup-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/;

async function answerFolderDialog(app: ElectronApplication, folder: string) {
  await app.evaluate(({dialog}, chosen) => {
    dialog.showOpenDialog = (async () => ({canceled: false, filePaths: [chosen]})) as typeof dialog.showOpenDialog;
  }, folder);
}

async function openBackupSettings(page: Page) {
  await openFromRail(page, 'Settings');
  await page.locator('summary', {hasText: 'Backups'}).click();
}

async function chooseFolder(app: ElectronApplication, page: Page, folder: string) {
  await answerFolderDialog(app, folder);
  await page.getByRole('button', {name: /Choose folder|Change folder/}).click();
  await expect(page.getByTestId('backup-folder')).toHaveText(folder);
}

function backupsIn(folder: string): string[] {
  const projectFolder = path.join(folder, SAMPLE_FOLDER);
  return fs.existsSync(projectFolder) ? fs.readdirSync(projectFolder).sort() : [];
}

let backupRoot: string;

test.beforeEach(() => {
  backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sagaspine-auto-backups-'));
});

test.afterEach(() => {
  fs.rmSync(backupRoot, {recursive: true, force: true});
});

test('a daily backup writes a restorable copy and keeps only the newest copies', async ({desktop}) => {
  const {app, page} = desktop;
  await openSampleProject(page);
  // Older backups already in the folder, and a file that is not a backup.
  const projectFolder = path.join(backupRoot, SAMPLE_FOLDER);
  fs.mkdirSync(projectFolder);
  for (const day of ['01', '02', '03', '04']) {
    fs.writeFileSync(path.join(projectFolder, `${SAMPLE_FOLDER}-backup-2020-01-${day}-090000.zip`), 'old');
  }
  fs.writeFileSync(path.join(projectFolder, 'notes.txt'), 'keep me');

  await openBackupSettings(page);
  await chooseFolder(app, page, backupRoot);
  await page.getByLabel('Copies to keep per project').selectOption('3');
  await page.getByLabel('Back up', {exact: true}).selectOption('daily');

  await expect(page.getByTestId('backup-last-run')).toContainText(/backed up \d+ projects?/, {timeout: 30_000});
  const files = backupsIn(backupRoot);
  const fresh = files.filter((name) => BACKUP_NAME.test(name) && !name.includes('-2020-'));
  expect(fresh).toHaveLength(1);
  // The newest three backups stay; the other file is never touched.
  expect(files).toEqual(
    [`${SAMPLE_FOLDER}-backup-2020-01-03-090000.zip`, `${SAMPLE_FOLDER}-backup-2020-01-04-090000.zip`, fresh[0], 'notes.txt'].sort()
  );
  expect(fs.readFileSync(path.join(projectFolder, 'notes.txt'), 'utf8')).toBe('keep me');
  const backupPath = path.join(projectFolder, fresh[0]);
  expect(fs.readFileSync(backupPath).subarray(0, 2).toString('latin1')).toBe('PK');

  // Nothing changed, so backing up again writes nothing new.
  await page.getByRole('button', {name: 'Back up changed projects now'}).click();
  await expect(page.getByTestId('backup-last-run')).toContainText(/unchanged/);
  expect(backupsIn(backupRoot)).toEqual(files);

  // The automatic backup counts as the project's last backup (4.93).
  await openFromRail(page, 'Projects');
  const sampleCard = page.getByRole('listitem').filter({has: page.locator('strong', {hasText: /^The Emberglass Key \(Sample\)$/})});
  await expect(sampleCard.getByText('Last backup: today')).toBeVisible();

  // And it restores: import it back as a new project and check the counts.
  await page.locator('input[type="file"][accept*=".sagabackup"]').first().setInputFiles(backupPath);
  await expect(page.getByText('Loaded backup preview for "The Emberglass Key (Sample)".')).toBeVisible();
  await page.getByRole('button', {name: 'Apply Import'}).click();
  await expect(page.getByText(/Count check passed\./)).toBeVisible();
});

test('the on-close schedule backs up before the window closes', async ({desktop}) => {
  const {app, page} = desktop;
  await openSampleProject(page);
  await openBackupSettings(page);
  await chooseFolder(app, page, backupRoot);
  await page.getByLabel('Back up', {exact: true}).selectOption('on-close');
  await expect(page.getByLabel('Back up', {exact: true})).toHaveValue('on-close');
  expect(backupsIn(backupRoot)).toEqual([]);

  await app.evaluate(({BrowserWindow}) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await expect.poll(() => backupsIn(backupRoot).filter((name) => BACKUP_NAME.test(name)).length, {timeout: 30_000}).toBe(1);
  await expect.poll(() => app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().length), {timeout: 30_000}).toBe(0);
});

test('a missing folder pauses backups and says why', async ({desktop}) => {
  const {app, page} = desktop;
  await openSampleProject(page);
  await openBackupSettings(page);
  const folder = path.join(backupRoot, 'Synced');
  fs.mkdirSync(folder);
  await chooseFolder(app, page, folder);
  await page.getByLabel('Back up', {exact: true}).selectOption('on-close');
  fs.rmSync(folder, {recursive: true});

  await openFromRail(page, 'Projects');
  await openBackupSettings(page);
  await expect(page.getByText('Automatic backups are paused: the backup folder is missing.')).toBeVisible();
  await page.getByRole('button', {name: 'Back up changed projects now'}).click();
  await expect(page.getByTestId('backup-last-run')).toContainText('paused because the backup folder is missing');
  expect(fs.existsSync(folder)).toBe(false);
});
