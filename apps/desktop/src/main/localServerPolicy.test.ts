import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE,
  localServerApiBase,
  resolveLocalServerRequestModel
} from './localServerPolicy';
import {
  buildLocalServerChatPayload,
  createCompletionAdapter,
  createStreamingAdapter
} from './providers/ProviderRegistry';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

const request = {messages: [{role: 'user' as const, content: 'Hi'}], systemPrompt: 'Be brief.', model: 'qwen3'};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local model server policy (main process)', () => {
  it('adds /v1 only to an address with no path', () => {
    expect(localServerApiBase('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/v1');
    expect(localServerApiBase('http://localhost:1234/v1')).toBe('http://localhost:1234/v1');
  });

  it('uses the configured model, else the first listed one, else none', async () => {
    const fetchImpl = vi.fn(async () => json({data: [{id: 'loaded'}, {id: 'other'}]})) as unknown as typeof fetch;
    expect(await resolveLocalServerRequestModel('http://localhost:5001/v1', ' mistral ', {fetchImpl})).toBe('mistral');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await resolveLocalServerRequestModel('http://localhost:5001/v1', undefined, {fetchImpl})).toBe('loaded');
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:5001/v1/models', expect.anything());
    const failing = vi.fn(async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    expect(await resolveLocalServerRequestModel('http://localhost:5001/v1', undefined, {fetchImpl: failing})).toBeUndefined();
  });

  it('builds an OpenAI-shaped body with no response_format and no default cap', () => {
    const payload = buildLocalServerChatPayload({request: {...request, responseFormat: 'json'}}, false);
    expect(payload).toEqual({
      model: 'qwen3',
      stream: false,
      messages: [
        {role: 'system', content: 'Be brief.'},
        {role: 'user', content: 'Hi'}
      ]
    });
  });

  it('sends no key, wraps reasoning, and refuses a reply cut off at a length limit', async () => {
    const fetchMock = vi.fn(async () =>
      json({choices: [{message: {reasoning_content: 'Hmm.', content: 'Hello.'}, finish_reason: 'stop'}]})
    );
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createCompletionAdapter('local-openai', {baseUrl: 'http://127.0.0.1:8080', request});
    expect(await adapter.complete()).toBe('<think>Hmm.</think>Hello.');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8080/v1/chat/completions');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);

    vi.stubGlobal('fetch', vi.fn(async () => json({choices: [{message: {content: '{"a'}, finish_reason: 'length'}]})));
    await expect(createCompletionAdapter('local-openai', {request}).complete()).rejects.toThrow(
      LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE
    );
  });

  it('streams answer chunks and names the server when it cannot connect', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Par"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"is"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      }
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    let text = '';
    for await (const chunk of createStreamingAdapter('local-openai', {request}).stream()) text += chunk;
    expect(text).toBe('Paris');

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    await expect(createCompletionAdapter('local-openai', {request}).complete()).rejects.toThrow(
      'Could not connect to the local model server at http://localhost:5001/v1. Check that it is running.'
    );
  });
});
