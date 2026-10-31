import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {expect, launchDesktop, openSampleProject, test} from './fixtures';

/*
 * The data-folder move (Slice 5.2): an author's projects from a build that
 * kept them in "desktop" open in the SagaSpine folder, and a stray folder
 * already named SagaSpine is set aside rather than deleted or reused.
 */
test('moves projects from the old "desktop" data folder to SagaSpine', async () => {
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'sagaspine-appdata-'));
  const legacy = path.join(appData, 'desktop');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, 'update-preferences.json'), JSON.stringify({checkAutomatically: false}));
  try {
    // An older build: its profile is the "desktop" folder.
    const before = await launchDesktop({userDataDir: legacy});
    await openSampleProject(before.page);
    await before.app.close();

    fs.mkdirSync(path.join(appData, 'SagaSpine'));
    fs.writeFileSync(path.join(appData, 'SagaSpine', 'leftover.txt'), 'from a test build');

    const after = await launchDesktop({appData});
    const userData = await after.app.evaluate(({app}) => app.getPath('userData'));
    expect(path.basename(userData)).toBe('SagaSpine');
    expect(fs.existsSync(legacy)).toBe(false);
    const setAside = fs.readdirSync(appData).find((name) => name.startsWith('SagaSpine (set aside'));
    expect(setAside).toBeDefined();
    expect(fs.readFileSync(path.join(appData, setAside!, 'leftover.txt'), 'utf8')).toBe('from a test build');

    await expect(after.page.getByText('Check for updates automatically?')).toBeHidden();
    await after.page.getByRole('link', {name: 'Projects'}).first().click();
    await expect(after.page.getByText('The Emberglass Key (Sample)').first()).toBeVisible();
    await after.page.getByRole('link', {name: 'Workspace'}).first().click();
    await expect(after.page.locator('.tiptap[contenteditable="true"]')).toContainText('The tide went out at four bells');
    await after.app.close();

    // Later launches use the settled folder and move nothing.
    const again = await launchDesktop({appData});
    expect(await again.app.evaluate(({app}) => app.getPath('userData'))).toBe(userData);
    await again.app.close();
  } finally {
    fs.rmSync(appData, {recursive: true, force: true, maxRetries: 5, retryDelay: 500});
  }
});
