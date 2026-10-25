import type {Page} from '@playwright/test';
import {startFakeModelServer, type FakeModelServer} from './fakeModelServer';
import {expect, openFromRail, openSampleProject, test} from './fixtures';

let server: FakeModelServer;

test.beforeEach(async () => {
  server = await startFakeModelServer();
});

test.afterEach(async () => {
  await server.close();
});

const PROMPT = 'Rewrite the opening line with more menace.';

/** Points the sample project at the fake local model server and checks the connection. */
async function useLocalModelServer(page: Page) {
  await openSampleProject(page);
  await openFromRail(page, 'Settings');
  const summary = page.locator('summary', {hasText: 'AI Settings'});
  if ((await summary.locator('xpath=..').getAttribute('open')) === null) await summary.click();
  await page.locator('label', {hasText: /^Provider$/}).locator('..').locator('select')
    .selectOption({label: 'Local server (OpenAI-compatible)'});
  await page.locator('#local-server-base-url').fill(server.baseUrl);
}

async function openAssistant(page: Page) {
  await openFromRail(page, 'Workspace');
  await page.getByRole('button', {name: 'Context'}).click();
  await page.getByRole('button', {name: 'AI', exact: true}).click();
}

async function ask(page: Page, prompt: string) {
  await page.getByRole('textbox', {name: /Ask for help expanding/}).fill(prompt);
  await page.getByRole('button', {name: 'Send', exact: true}).click();
}

function chatRequests() {
  return server.requests.filter((request) => request.path === '/v1/chat/completions');
}

test('Test connection reaches the local model server from the main process', async ({desktop}) => {
  const {page} = desktop;
  await useLocalModelServer(page);
  await page.getByRole('button', {name: 'Test connection'}).click();
  await expect(page.locator('strong', {hasText: 'Local model server connection succeeded.'})).toBeVisible();

  const [chat] = chatRequests();
  // Node's fetch in the main process, not the renderer's Chromium.
  expect(chat.headers['user-agent']).toBe('node');
  expect(chat.headers.authorization).toBeUndefined();
});

test('Test connection explains a local model server that is not running', async ({desktop}) => {
  const {page} = desktop;
  await useLocalModelServer(page);
  await server.close();
  await page.getByRole('button', {name: 'Test connection'}).click();
  await expect(page.getByText(`Could not reach the local model server at ${server.baseUrl}`)).toBeVisible();
  // Reopened only so afterEach can close it again.
  server = await startFakeModelServer();
});

test('streams an assistant reply chunk by chunk over IPC', async ({desktop}) => {
  const {page} = desktop;
  await useLocalModelServer(page);
  server.setStream({first: ['The sea ', 'kept '], rest: ['its own counsel.']});
  await openAssistant(page);
  await ask(page, PROMPT);

  // The first chunks show while the server still holds the rest of the reply.
  await expect(page.getByText('The sea kept', {exact: false}).first()).toBeVisible();
  await expect(page.getByText('its own counsel.')).toHaveCount(0);
  server.release();
  await expect(page.getByText('The sea kept its own counsel.', {exact: false}).first()).toBeVisible();

  const chat = chatRequests().at(-1)!;
  const body = chat.body as {model: string; stream: boolean; messages: Array<{role: string; content: string}>};
  expect(chat.headers['user-agent']).toBe('node');
  expect(chat.headers.authorization).toBeUndefined();
  expect(body.stream).toBe(true);
  expect(body.model).toBe('e2e-local-model');
  expect(body.messages.at(-1)?.content).toContain(PROMPT);
});

test('stopping a reply aborts the request in the main process', async ({desktop}) => {
  const {page} = desktop;
  await useLocalModelServer(page);
  server.setStream({first: ['Slowly, '], rest: ['too late.']});
  await openAssistant(page);
  const hungUp = server.clientClosedEarly();
  await ask(page, PROMPT);
  await expect(page.getByText('Slowly,', {exact: false}).first()).toBeVisible();

  await page.getByRole('button', {name: /^Stop/}).click();
  await expect(page.getByText(/Stopped after \d+:\d\d\./)).toBeVisible();
  // The provider request ends too, not just the renderer's listener.
  await hungUp;
  server.release();
  await expect(page.getByText('too late.')).toHaveCount(0);
});

test('shows a failed local model reply as an error', async ({desktop}) => {
  const {page} = desktop;
  await useLocalModelServer(page);
  server.failChatWith(500);
  await openAssistant(page);
  await ask(page, PROMPT);
  await expect(page.getByText(/Failed after \d+:\d\d\./)).toBeVisible();
  await expect(page.getByText(/Your work is saved locally/).first()).toBeVisible();
});

test('the IPC boundary refuses renderer-supplied keys and remote addresses', async ({desktop}) => {
  const {page} = desktop;
  const call = (payload: unknown) =>
    page.evaluate(
      (p) =>
        (window as unknown as {electronAPI: {llmStream(payload: unknown): Promise<string>}}).electronAPI
          .llmStream(p)
          .then(() => 'resolved', (error: Error) => error.message),
      payload
    );
  const request = {messages: [{role: 'user', content: 'Hello'}]};

  expect(
    await call({providerId: 'local-openai', providerConfig: {baseUrl: 'http://192.168.1.20:5001/v1'}, request})
  ).toContain('must run on this computer');
  expect(await call({providerId: 'anthropic', apiKey: 'sk-ant-from-renderer', request})).toContain(
    'apiKey must not be sent from the renderer'
  );
  expect(await call({providerId: 'anthropic', request})).toContain('API key is missing');
  expect(server.requests).toEqual([]);
});
