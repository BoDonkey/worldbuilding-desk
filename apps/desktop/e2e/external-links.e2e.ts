import type {ElectronApplication} from '@playwright/test';
import {expect, test} from './fixtures';

/** Records what the app would open in the system browser instead of opening it. */
async function recordExternalOpens(app: ElectronApplication) {
  await app.evaluate(({shell}) => {
    const opened: string[] = [];
    (globalThis as unknown as {externalOpens: string[]}).externalOpens = opened;
    shell.openExternal = async (url: string) => {
      opened.push(url);
    };
  });
  return () => app.evaluate(() => (globalThis as unknown as {externalOpens: string[]}).externalOpens);
}

test('web links open in the system browser, never in an app window', async ({desktop}) => {
  const {app, page} = desktop;
  await expect(page.getByRole('heading', {level: 1, name: 'Writing Workspace'})).toBeVisible();
  const externalOpens = await recordExternalOpens(app);

  await page.evaluate(() => {
    window.open('https://example.com/help');
  });
  await expect.poll(externalOpens).toEqual(['https://example.com/help']);
  expect(app.windows()).toHaveLength(1);
});

test('links with other schemes are refused', async ({desktop}) => {
  const {app, page} = desktop;
  await expect(page.getByRole('heading', {level: 1, name: 'Writing Workspace'})).toBeVisible();
  const externalOpens = await recordExternalOpens(app);

  await page.evaluate(() => {
    window.open('file:///etc/hosts');
    window.open('javascript:alert(1)');
    window.open('smb://example.com/share');
  });
  // A web link after them proves the refused ones were already handled.
  await page.evaluate(() => {
    window.open('https://example.com/after');
  });
  await expect.poll(externalOpens).toEqual(['https://example.com/after']);
  expect(app.windows()).toHaveLength(1);
});

test('the app window cannot be navigated away from the app', async ({desktop}) => {
  const {app, page} = desktop;
  await expect(page.getByRole('heading', {level: 1, name: 'Writing Workspace'})).toBeVisible();
  const externalOpens = await recordExternalOpens(app);
  const appUrl = page.url();

  await page.evaluate(() => {
    window.location.href = 'https://example.com/elsewhere';
  });
  await expect.poll(externalOpens).toEqual(['https://example.com/elsewhere']);
  // Asked through the main process: Playwright's page keeps waiting on the
  // navigation the app cancelled.
  const shown = await app.evaluate(async ({BrowserWindow}) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    return {
      url: contents.getURL(),
      heading: await contents.executeJavaScript('document.querySelector("h1")?.textContent')
    };
  });
  expect(shown).toEqual({url: appUrl, heading: 'Writing Workspace'});
});
