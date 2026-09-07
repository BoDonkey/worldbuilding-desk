import {afterEach, describe, expect, it, vi} from 'vitest';

const completeMock = vi.fn();

vi.mock('./LLMService', () => ({
  LLMService: class {
    complete(...args: unknown[]) {
      return completeMock(...args);
    }
  }
}));

import {
  describeConnectionTestError,
  testHostedProviderConnection,
  testOllamaConnection
} from './connectionTest';

describe('describeConnectionTestError', () => {
  it('passes through an already-plain missing-key message', () => {
    expect(describeConnectionTestError('anthropic', new Error('Anthropic API key is missing.'))).toBe(
      'Anthropic API key is missing.'
    );
  });

  it('recognizes an auth failure', () => {
    expect(describeConnectionTestError('openai', new Error('OpenAI API error: 401 Unauthorized'))).toMatch(
      /rejected the key/
    );
  });

  it('recognizes a rate limit as a valid key', () => {
    expect(describeConnectionTestError('gemini', new Error('429 Too Many Requests'))).toMatch(
      /rate-limited/
    );
  });

  it('recognizes a network failure', () => {
    expect(describeConnectionTestError('anthropic', new TypeError('Failed to fetch'))).toMatch(
      /Could not reach Anthropic/
    );
  });

  it('falls back to a labeled raw message for anything unrecognized', () => {
    expect(describeConnectionTestError('openai', new Error('Something odd happened'))).toBe(
      'OpenAI test failed: Something odd happened'
    );
  });
});

describe('testHostedProviderConnection', () => {
  afterEach(() => {
    completeMock.mockReset();
  });

  it('reports a missing key without calling the provider', async () => {
    const result = await testHostedProviderConnection({providerId: 'anthropic', apiKey: '  '});
    expect(result).toEqual({tone: 'error', summary: 'Anthropic API key is missing.', details: []});
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('reports success after one real completion call', async () => {
    completeMock.mockResolvedValue({content: 'OK'});
    const result = await testHostedProviderConnection({
      providerId: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini'
    });
    expect(result.tone).toBe('success');
    expect(result.summary).toBe('OpenAI connection succeeded.');
    expect(result.details).toContain('Configured model: gpt-4o-mini.');
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock.mock.calls[0]![0]).toMatchObject({maxTokens: 5});
  });

  it('reports a plain-language error when the call fails', async () => {
    completeMock.mockRejectedValue(new Error('OpenAI API error: 401 Unauthorized'));
    const result = await testHostedProviderConnection({providerId: 'openai', apiKey: 'sk-bad'});
    expect(result.tone).toBe('error');
    expect(result.summary).toMatch(/rejected the key/);
  });
});

describe('testOllamaConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports success and lists detected models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({models: [{name: 'llama3.1'}, {name: 'mistral'}]})
      })
    );
    const result = await testOllamaConnection({model: 'llama3.1'});
    expect(result.tone).toBe('success');
    expect(result.detectedModels).toEqual(['llama3.1', 'mistral']);
    expect(result.details).toContain('Configured model "llama3.1" is installed.');
  });

  it('flags a configured model that is not installed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({models: [{name: 'mistral'}]})
      })
    );
    const result = await testOllamaConnection({model: 'llama3.1'});
    expect(result.tone).toBe('error');
    expect(result.summary).toMatch(/not installed/);
  });

  it('reports an unreachable server in plain language', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const result = await testOllamaConnection({});
    expect(result.tone).toBe('error');
    expect(result.summary).toMatch(/Could not reach Ollama/);
  });
});
