import {expect, openFromRail, openSampleProject, packagedExecutable, test} from './fixtures';

test('loads the bundled renderer from disk under its Content-Security-Policy', async ({desktop}) => {
  const {app, page} = desktop;
  await expect(page.getByRole('heading', {level: 1, name: 'Writing Workspace'})).toBeVisible();

  // The route lives in the hash, so the window still points at index.html.
  expect(page.url()).toMatch(/^file:\/\/.+\/index\.html#\/workspace$/);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  expect(await app.evaluate(({app: electronApp}) => electronApp.isPackaged)).toBe(Boolean(packagedExecutable()));

  // The renderer has the narrow bridge and no Node.
  expect(await page.evaluate(() => typeof (window as unknown as {require?: unknown}).require)).toBe('undefined');
  expect(
    await page.evaluate(() => Object.keys((window as unknown as {electronAPI: object}).electronAPI).sort())
  ).toEqual([
    'llmCancelStream',
    'llmComplete',
    'llmLocalContextSize',
    'llmStream',
    'onLLMChunk',
    'onLLMComplete',
    'onLLMError',
    'providerKeys'
  ]);

  expect(desktop.rendererErrors).toEqual([]);
});

test('keeps the current page across a reload', async ({desktop}) => {
  const {page} = desktop;
  await openFromRail(page, 'Settings');
  await expect(page.getByRole('heading', {level: 1, name: 'Settings'})).toBeVisible();
  expect(page.url()).toMatch(/#\/settings$/);

  await page.reload();
  await expect(page.getByRole('heading', {level: 1, name: 'Settings'})).toBeVisible();
  expect(page.url()).toMatch(/#\/settings$/);
});

test('keeps a project and its scenes across a restart', async ({desktop}) => {
  await openSampleProject(desktop.page);
  await expect(desktop.page.locator('.tiptap[contenteditable="true"]')).toContainText('The tide went out at four bells');

  await desktop.relaunch();
  const {page} = desktop;
  await page.getByRole('link', {name: 'Projects'}).first().click();
  await expect(page.getByText('The Emberglass Key (Sample)').first()).toBeVisible();
  await page.getByRole('link', {name: 'Workspace'}).first().click();
  await expect(page.locator('.tiptap[contenteditable="true"]')).toContainText('The tide went out at four bells');
});
