import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {OllamaProvider} from './providers/ollama';
import {
  classifyProviderRoute,
  describeRouteDataFlow,
  parseOllamaTags,
  PRIVATE_LOCAL_DISCLOSURE
} from './providerRoute';

const ollama = (config: {baseUrl?: string; model?: string}) =>
  ({provider: 'ollama', configs: {ollama: config}}) as unknown as ProjectAISettings;
const installed = parseOllamaTags({
  models: [{name: 'qwen3:8b'}, {name: 'gpt-oss:20b-cloud', remote_host: 'https://ollama.com:443'}]
});

describe('classifyProviderRoute', () => {
  it('is private-local only for a loopback endpoint with an installed local model', () => {
    const route = classifyProviderRoute(ollama({baseUrl: 'http://localhost:11434', model: 'qwen3:8b'}), installed);
    expect(route).toMatchObject({kind: 'private-local', isPrivateLocal: true, allowsRequests: true, model: 'qwen3:8b'});
    expect(describeRouteDataFlow(route, 'the scene')).toBe(PRIVATE_LOCAL_DISCLOSURE);
    expect(classifyProviderRoute(ollama({}), installed)).toMatchObject({kind: 'private-local', model: 'qwen3:8b'});
  });

  it('blocks an Ollama cloud model, by name even before Ollama answers', () => {
    for (const models of [installed, null]) {
      const route = classifyProviderRoute(ollama({model: 'gpt-oss:20b-cloud'}), models);
      expect(route).toMatchObject({kind: 'ollama-cloud', isPrivateLocal: false, allowsRequests: false});
      expect(describeRouteDataFlow(route, 'x')).toMatch(/cloud model.*leave this computer/);
    }
  });

  it('blocks a remote endpoint', () => {
    const route = classifyProviderRoute(ollama({baseUrl: 'http://192.168.1.20:11434', model: 'qwen3:8b'}), installed);
    expect(route).toMatchObject({kind: 'ollama-remote', isPrivateLocal: false, allowsRequests: false});
    expect(route.reason).toMatch(/Remote Ollama addresses are blocked/);
  });

  it('fails closed when the model cannot be verified', () => {
    expect(classifyProviderRoute(ollama({model: 'qwen3:8b'}), null)).toMatchObject({
      kind: 'ollama-unverified',
      isPrivateLocal: false
    });
    expect(classifyProviderRoute(ollama({model: 'mistral:7b'}), installed)).toMatchObject({
      kind: 'ollama-unverified',
      reason: expect.stringMatching(/not installed on this computer/)
    });
    expect(classifyProviderRoute(ollama({}), [])).toMatchObject({kind: 'ollama-unverified'});
  });

  it('treats hosted providers as hosted, never local', () => {
    const route = classifyProviderRoute({provider: 'gemini', configs: {}} as unknown as ProjectAISettings, null);
    expect(route).toMatchObject({kind: 'hosted', isPrivateLocal: false, allowsRequests: true});
    expect(describeRouteDataFlow(route, 'the scene')).toBe('Sends the scene to Google’s servers only when you send.');
  });
});

describe('browser-build Ollama request policy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubOllama = (models: Array<Record<string, unknown>>) => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      url.endsWith('/api/tags')
        ? new Response(JSON.stringify({models}))
        : new Response(JSON.stringify({message: {content: 'ok'}}))
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };
  const request = {messages: [{role: 'user' as const, content: 'Hi'}]};

  it('sends to a verified local model and auto-picks past cloud models', async () => {
    const fetchMock = stubOllama([{name: 'gpt-oss:20b-cloud', remote_model: 'gpt-oss:20b'}, {name: 'qwen3:8b'}]);
    await new OllamaProvider({baseUrl: 'http://localhost:11434'}).generateCompletion(request);
    const chat = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/chat'));
    expect(JSON.parse(String(chat?.[1]?.body)).model).toBe('qwen3:8b');
  });

  it('refuses cloud, missing, and remote models without sending the chat', async () => {
    const fetchMock = stubOllama([{name: 'qwen3:8b'}]);
    await expect(
      new OllamaProvider({baseUrl: 'http://localhost:11434', model: 'gpt-oss:20b-cloud'}).generateCompletion(request)
    ).rejects.toThrow(/cloud model/);
    await expect(
      new OllamaProvider({baseUrl: 'http://localhost:11434', model: 'mistral:7b'}).generateCompletion(request)
    ).rejects.toThrow(/not installed/);
    await expect(
      new OllamaProvider({baseUrl: 'http://10.0.0.2:11434', model: 'qwen3:8b'}).generateCompletion(request)
    ).rejects.toThrow(/Remote Ollama addresses are blocked/);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/chat'))).toBe(false);
  });
});
