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

  it('fails fast when the vault reports no key for the provider', async () => {
    desktopWindow({anthropic: false, openai: true, gemini: true});
    await getProviderKeyStatus();

    expect(() => new LLMService(settings('anthropic'))).toThrow('Anthropic API key is missing. Please add it in Settings.');
    expect(() => new LLMService(settings('openai'))).not.toThrow();
  });
});
