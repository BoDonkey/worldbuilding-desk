import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {LLMService} from './LLMService';
import {getProviderKeyStatus} from './providerKeyStore';

const settings = (provider: string) =>
  ({provider, configs: {[provider]: {model: `${provider}-model`}}}) as unknown as ProjectAISettings;

function desktopWindow(status = {anthropic: true, openai: true, gemini: true}) {
  const llmComplete = vi.fn(async () => 'from main');
  const providerKeys = {status: vi.fn(async () => status), set: vi.fn(), clear: vi.fn()};
  vi.stubGlobal('window', {electronAPI: {llmComplete, providerKeys}, localStorage: {getItem: () => 'leaked'}});
  return {llmComplete};
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LLMService in the desktop app', () => {
  it('routes every hosted provider, Gemini included, through the main process without a key', async () => {
    const {llmComplete} = desktopWindow();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const provider of ['anthropic', 'openai', 'gemini']) {
      const response = await new LLMService(settings(provider)).complete({
        messages: [{role: 'user', content: `Hi ${provider}`}],
        cache: false
      });
      expect(response.content).toBe('from main');
    }

    expect(fetchMock).not.toHaveBeenCalled();
    const payloads = llmComplete.mock.calls.map((call) => (call as unknown as [Record<string, unknown>])[0]);
    expect(payloads.map((payload) => payload.providerId)).toEqual(['anthropic', 'openai', 'gemini']);
    payloads.forEach((payload) => expect(payload).not.toHaveProperty('apiKey'));
  });

  it('routes the local model server through the main process with its address and no key', async () => {
    const {llmComplete} = desktopWindow();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await new LLMService({
      provider: 'local-openai',
      configs: {'local-openai': {baseUrl: 'http://127.0.0.1:8080/v1', model: 'qwen3'}}
    } as unknown as ProjectAISettings).complete({messages: [{role: 'user', content: 'Hi'}], cache: false});

    expect(fetchMock).not.toHaveBeenCalled();
    const [payload] = llmComplete.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(payload).toMatchObject({
      providerId: 'local-openai',
      providerConfig: {baseUrl: 'http://127.0.0.1:8080/v1'},
      request: {model: 'qwen3'}
    });
    expect(payload).not.toHaveProperty('apiKey');
  });

  it("passes the local server's Maximum reply length to the main process only when it is valid (4.75)", async () => {
    const {llmComplete} = desktopWindow();
    const ask = (maxReplyTokens: unknown) =>
      new LLMService({
        provider: 'local-openai',
        configs: {'local-openai': {baseUrl: 'http://127.0.0.1:8080/v1', maxReplyTokens}}
      } as unknown as ProjectAISettings).complete({messages: [{role: 'user', content: 'Hi'}], cache: false});

    await ask(1500);
    await ask(10);
    await ask(undefined);
    const configs = llmComplete.mock.calls.map((call) => (call as unknown as [{providerConfig: unknown}])[0].providerConfig);
    expect(configs).toEqual([
      {baseUrl: 'http://127.0.0.1:8080/v1', maxReplyTokens: 1500},
      {baseUrl: 'http://127.0.0.1:8080/v1'},
      {baseUrl: 'http://127.0.0.1:8080/v1'}
    ]);
  });

  it('fails fast when the vault reports no key for the provider', async () => {
    desktopWindow({anthropic: false, openai: true, gemini: true});
    await getProviderKeyStatus();

    expect(() => new LLMService(settings('anthropic'))).toThrow('Anthropic API key is missing. Please add it in Settings.');
    expect(() => new LLMService(settings('openai'))).not.toThrow();
  });
});
