import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {LLMService} from './LLMService';

const ollamaSettings = {
  provider: 'ollama',
  configs: {ollama: {model: 'cache-test-model', baseUrl: 'http://localhost:11434'}}
} as ProjectAISettings;

describe('LLMService response cache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('replays an identical request by default but always reaches the model with cache: false', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({message: {content: 'reply'}})));
    vi.stubGlobal('fetch', fetchMock);
    const service = new LLMService(ollamaSettings);
    const request = {messages: [{role: 'user' as const, content: `cache probe ${Math.random()}`}]};

    await service.complete(request);
    await service.complete(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await service.complete({...request, cache: false});
    await service.complete({...request, cache: false});
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
