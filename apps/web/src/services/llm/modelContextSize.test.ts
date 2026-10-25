import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {
  clearModelContextSizeCache,
  parseOllamaLoadedContext,
  resolveModelContextSize
} from './modelContextSize';

const config = (provider: ProjectAISettings['provider'], configs: ProjectAISettings['configs'] = {}) =>
  ({provider, configs}) as Pick<ProjectAISettings, 'provider' | 'configs'>;

const json = (body: unknown, ok = true) => ({ok, json: async () => body}) as Response;

beforeEach(() => clearModelContextSizeCache());
afterEach(() => vi.unstubAllGlobals());

describe('parseOllamaLoadedContext', () => {
  const ps = {
    models: [
      {name: 'qwen3:8b', model: 'qwen3:8b', context_length: 40960},
      {name: 'gem:latest', model: 'gem:latest', context_length: 8192}
    ]
  };
  it('reads the configured model, with or without its tag', () => {
    expect(parseOllamaLoadedContext(ps, 'qwen3:8b')).toBe(40960);
    expect(parseOllamaLoadedContext(ps, 'gem')).toBe(8192);
    expect(parseOllamaLoadedContext(ps, 'other')).toBeUndefined();
  });
  it('uses the only loaded model when none is configured, and nothing otherwise', () => {
    expect(parseOllamaLoadedContext({models: [ps.models[1]]}, undefined)).toBe(8192);
    expect(parseOllamaLoadedContext(ps, undefined)).toBeUndefined();
    expect(parseOllamaLoadedContext({models: [{name: 'x', context_length: -1}]}, 'x')).toBeUndefined();
    expect(parseOllamaLoadedContext('nope', 'x')).toBeUndefined();
  });
});

describe('resolveModelContextSize', () => {
  it('uses the provider context for hosted models, without asking anything', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveModelContextSize(config('anthropic'))).toEqual({tokens: 200_000, source: 'provider'});
    expect(await resolveModelContextSize(config('openai'))).toEqual({tokens: 128_000, source: 'provider'});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks Ollama for the loaded model, and assumes 4,096 when it is not loaded', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('http://localhost:11434/api/ps');
      return json({models: [{name: 'qwen3:8b', context_length: 40960}]});
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveModelContextSize(config('ollama', {ollama: {model: 'qwen3:8b'}}))).toEqual({tokens: 40960, source: 'reported'});
    expect(await resolveModelContextSize(config('ollama', {ollama: {model: 'other'}}))).toEqual({tokens: 4096, source: 'assumed'});
  });

  it('never asks an Ollama that is not on this computer', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveModelContextSize(config('ollama', {ollama: {baseUrl: 'http://192.168.1.9:11434'}}))).toEqual({
      tokens: 4096,
      source: 'assumed'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the local model server, and assumes 4,096 when it does not say', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === 'http://localhost:5001/props' ? json({default_generation_settings: {n_ctx: 16384}}) : json({}, false))));
    expect(await resolveModelContextSize(config('local-openai'))).toEqual({tokens: 16384, source: 'reported'});

    vi.stubGlobal('fetch', vi.fn(async () => json({}, false)));
    expect(await resolveModelContextSize(config('local-openai', {'local-openai': {baseUrl: 'http://localhost:1234/v1'}}))).toEqual({
      tokens: 4096,
      source: 'assumed'
    });
  });

  it('asks once for the same model within half a minute', async () => {
    const fetchMock = vi.fn(async () => json({models: [{name: 'm', context_length: 8192}]}));
    vi.stubGlobal('fetch', fetchMock);
    await resolveModelContextSize(config('ollama', {ollama: {model: 'm'}}));
    await resolveModelContextSize(config('ollama', {ollama: {model: 'm'}}));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
