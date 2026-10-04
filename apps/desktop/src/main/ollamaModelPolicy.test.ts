import {describe, expect, it, vi} from 'vitest';
import {parseOllamaTags, resolveLocalOllamaModel, resolveOllamaRequestModel} from './ollamaModelPolicy';

const tags = (models: Array<Record<string, unknown>>) => ({models});
const installed = parseOllamaTags(
  tags([
    {name: 'gpt-oss:120b-cloud', remote_host: 'https://ollama.com:443', remote_model: 'gpt-oss:120b'},
    {name: 'mirror:latest', remote_host: 'https://ollama.com:443'},
    {name: 'qwen3:8b'},
    {name: 'llama3.1:latest'}
  ])
);

describe('Ollama private-local model policy (main process)', () => {
  it('marks cloud models by remote fields or cloud tag', () => {
    expect(installed.map((entry) => entry.cloud)).toEqual([true, true, false, false]);
  });

  it('accepts a configured model only when it is installed and local', () => {
    expect(resolveLocalOllamaModel(installed, 'qwen3:8b')).toBe('qwen3:8b');
    expect(resolveLocalOllamaModel(installed, 'llama3.1')).toBe('llama3.1');
    expect(() => resolveLocalOllamaModel(installed, 'gpt-oss:120b-cloud')).toThrow(/cloud model/);
    expect(() => resolveLocalOllamaModel(installed, 'mirror')).toThrow(/cloud model/);
    expect(() => resolveLocalOllamaModel(installed, 'mistral:7b')).toThrow(/not installed on this computer/);
  });

  it('auto-picks the first local model, never a cloud one, and fails with none installed', () => {
    expect(resolveLocalOllamaModel(installed)).toBe('qwen3:8b');
    expect(() => resolveLocalOllamaModel(installed.filter((entry) => entry.cloud))).toThrow(/No Ollama model is installed/);
  });

  it('refuses a cloud model before contacting Ollama', async () => {
    const fetchImpl = vi.fn();
    await expect(
      resolveOllamaRequestModel('http://localhost:11434', 'deepseek-v3.1:671b-cloud', {fetchImpl})
    ).rejects.toThrow(/cloud model/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reads the installed list from the loopback address and fails closed when Ollama does not answer', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(tags([{name: 'qwen3:8b'}]))));
    expect(await resolveOllamaRequestModel('http://127.0.0.1:11434/', undefined, {fetchImpl: ok})).toBe('qwen3:8b');
    expect(ok).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', expect.anything());

    const down = vi.fn(async () => new Response('', {status: 503, statusText: 'Service Unavailable'}));
    await expect(resolveOllamaRequestModel('http://localhost:11434', 'qwen3:8b', {fetchImpl: down})).rejects.toThrow(
      /model lookup failed/
    );
  });
});
