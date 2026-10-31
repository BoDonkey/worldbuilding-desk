import type {Page} from '@playwright/test';
import {expect, openFromRail, packagedExecutable, test} from './fixtures';
import {startFakeUpdateFeed, type FakeUpdateFeed} from './fakeUpdateFeed';

// Slice 5.1: the packaged app asks before it contacts the update server, then
// checks on request or at startup, and applies an update only when asked.
// The startup check waits 8 s, so the quiet periods below outlast it.
const STARTUP_CHECK_WAIT_MS = 11_000;
const manifestRequests = (feed: FakeUpdateFeed) => feed.requests.filter((path) => path.endsWith('.yml'));

let feed: FakeUpdateFeed;

test.skip(!packagedExecutable(), 'Updates run only in the packaged app (E2E_APP=packaged).');

test.beforeAll(async () => {
  feed = await startFakeUpdateFeed('99.0.0');
  process.env.SAGASPINE_TEST_UPDATE_FEED = feed.url;
});

test.afterAll(async () => {
  delete process.env.SAGASPINE_TEST_UPDATE_FEED;
  await feed?.close();
});

test.beforeEach(() => {
  feed.requests.length = 0;
});

async function openUpdatesSettings(page: Page) {
  await openFromRail(page, 'Settings');
  await page.locator('summary', {hasText: 'Updates'}).click();
}

test('asks before contacting the update server, and checks only on request when declined', async ({desktop}) => {
  const {page} = desktop;
  const question = page.getByText('Check for updates automatically?');
  await expect(question).toBeVisible();
  await expect(page.getByText(/sends no project data/).first()).toBeVisible();
  await page.waitForTimeout(STARTUP_CHECK_WAIT_MS);
  expect(manifestRequests(feed), 'no contact before the author answers').toEqual([]);

  await page.getByRole('button', {name: "Don't check automatically"}).click();
  await expect(question).toBeHidden();
  await desktop.relaunch();
  await desktop.page.waitForTimeout(STARTUP_CHECK_WAIT_MS);
  await expect(desktop.page.getByText('Check for updates automatically?')).toBeHidden();
  expect(manifestRequests(feed), 'no contact after declining').toEqual([]);

  await openUpdatesSettings(desktop.page);
  await expect(
    desktop.page.getByRole('checkbox', {name: 'Check for updates automatically when SagaSpine starts'})
  ).not.toBeChecked();
  await desktop.page.getByRole('button', {name: 'Check for updates'}).click();
  await expect(desktop.page.getByRole('status').filter({hasText: 'SagaSpine 99.0.0 is available'})).toBeVisible();
  expect(manifestRequests(feed).length).toBe(1);
  expect(feed.requests.some((path) => !path.endsWith('.yml')), 'nothing downloaded without asking').toBe(false);
});

test('checks at startup once allowed, and downloads the update only when asked', async ({desktop}) => {
  await desktop.page.getByRole('button', {name: 'Check automatically', exact: true}).click();
  await desktop.relaunch();
  const {page} = desktop;
  const card = page.getByRole('region', {name: 'SagaSpine update'});
  await expect(card).toContainText('SagaSpine 99.0.0 is available', {timeout: 30_000});
  expect(manifestRequests(feed).length).toBe(1);
  expect(feed.requests.some((path) => !path.endsWith('.yml'))).toBe(false);

  if (process.platform === 'darwin') {
    // Unsigned macOS builds cannot install in place (5.2); the author gets the release page.
    await expect(card.getByRole('button', {name: 'Open download page'})).toBeVisible();
    await expect(card.getByRole('button', {name: 'Download update'})).toHaveCount(0);
    return;
  }
  await card.getByRole('button', {name: 'Download update'}).click();
  // electron-updater verifies the payload against the manifest's sha512.
  await expect(card).toContainText('SagaSpine 99.0.0 is ready', {timeout: 30_000});
  await expect(card.getByRole('button', {name: 'Restart to update'})).toBeVisible();
  expect(desktop.rendererErrors).toEqual([]);
});
