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
  testLocalServerConnection,
  testOllamaConnection
} from './connectionTest';
import {LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE} from './localServer';

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

describe('testHostedProviderConnection in the desktop app', () => {
  afterEach(() => {
    completeMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('saves a typed key to the vault before testing it', async () => {
    const providerKeys = {
      status: vi.fn(async () => ({anthropic: true, openai: false, gemini: false})),
      set: vi.fn(async () => ({anthropic: true, openai: false, gemini: false})),
      clear: vi.fn()
    };
    vi.stubGlobal('window', {electronAPI: {providerKeys}});
    completeMock.mockImplementation(async () => {
      expect(providerKeys.set).toHaveBeenCalledWith('anthropic', 'sk-ant-new');
      return {content: 'OK'};
    });

    const result = await testHostedProviderConnection({providerId: 'anthropic', apiKey: ' sk-ant-new '});
    expect(result.tone).toBe('success');
  });

  it('tests the saved key when the field is blank, and reports a missing one', async () => {
    const providerKeys = {
      status: vi.fn(async () => ({anthropic: false, openai: true, gemini: false})),
      set: vi.fn(),
      clear: vi.fn()
    };
    vi.stubGlobal('window', {electronAPI: {providerKeys}});
    completeMock.mockResolvedValue({content: 'OK'});

    expect((await testHostedProviderConnection({providerId: 'openai', apiKey: ''})).tone).toBe('success');
    expect(await testHostedProviderConnection({providerId: 'anthropic', apiKey: ''})).toEqual({
      tone: 'error',
      summary: 'Anthropic API key is missing.',
      details: []
    });
    expect(providerKeys.set).not.toHaveBeenCalled();
  });

  it('reports a vault refusal in plain language without calling the provider', async () => {
    const providerKeys = {
      status: vi.fn(),
      set: vi.fn(async () => {
        throw new Error('Secure key storage is unavailable on this computer, so the API key was not saved.');
      }),
      clear: vi.fn()
    };
    vi.stubGlobal('window', {electronAPI: {providerKeys}});

    const result = await testHostedProviderConnection({providerId: 'gemini', apiKey: 'AIza-x'});
    expect(result.tone).toBe('error');
    expect(result.summary).toMatch(/Secure key storage is unavailable/);
    expect(completeMock).not.toHaveBeenCalled();
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

  it('blocks a configured Ollama cloud model and hides cloud models from the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{name: 'gpt-oss:20b-cloud', remote_host: 'https://ollama.com:443'}, {name: 'mistral'}]
        })
      })
    );
    const result = await testOllamaConnection({model: 'gpt-oss:20b-cloud'});
    expect(result.tone).toBe('error');
    expect(result.summary).toMatch(/Ollama cloud model\. Private mode blocks it/);
    expect(result.detectedModels).toEqual(['mistral']);
    expect(result.details).toContain('1 Ollama cloud model(s) are hidden because they run off this computer.');
  });

  it('refuses a remote Ollama address without contacting it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await testOllamaConnection({baseUrl: 'http://192.168.1.20:11434', model: 'mistral'});
    expect(result.tone).toBe('error');
    expect(result.summary).toMatch(/Remote Ollama addresses are blocked/);
    expect(fetchMock).not.toHaveBeenCalled();
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

describe('testLocalServerConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    completeMock.mockReset();
  });

  const listing = (ids: string[] | null) =>
    vi.fn(async () =>
      ids ? {ok: true, json: async () => ({data: ids.map((id) => ({id}))})} : {ok: false, json: async () => ({})}
    );

  it('reports the listed models and succeeds when the server answers a chat request', async () => {
    vi.stubGlobal('fetch', listing(['mistral-7b', 'qwen3']));
    completeMock.mockResolvedValue({content: 'OK'});
    const result = await testLocalServerConnection({baseUrl: 'http://localhost:1234/v1'});
    expect(result.tone).toBe('success');
    expect(result.detectedModels).toEqual(['mistral-7b', 'qwen3']);
    expect(result.details).toContain('Connected to http://localhost:1234/v1.');
    expect(result.details.join(' ')).toMatch(/Requests will name "mistral-7b"/);
  });

  it('succeeds without a listing, and when the tiny test reply hits its length cap', async () => {
    vi.stubGlobal('fetch', listing(null));
    completeMock.mockRejectedValue(new Error(LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE));
    const result = await testLocalServerConnection({});
    expect(result.tone).toBe('success');
    expect(result.details.join(' ')).toMatch(/did not list its models/);
  });

  it('reports an unreachable server and passes other server errors through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    completeMock.mockRejectedValue(new Error('Could not connect to the local model server at http://localhost:5001/v1.'));
    const unreachable = await testLocalServerConnection({});
    expect(unreachable.tone).toBe('error');
    expect(unreachable.summary).toMatch(/^Could not reach the local model server at http:\/\/localhost:5001\/v1\. Check that it is running/);

    vi.stubGlobal('fetch', listing(['m']));
    completeMock.mockRejectedValue(new Error('The local model server responded with 400: No models loaded.'));
    expect((await testLocalServerConnection({})).summary).toBe('The local model server responded with 400: No models loaded.');
  });

  it('refuses a remote address without contacting it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await testLocalServerConnection({baseUrl: 'http://10.0.0.5:5001/v1'});
    expect(result.tone).toBe('error');
    expect(result.summary).toMatch(/Remote addresses are blocked/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });
});
