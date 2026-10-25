import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  LOCAL_SERVER_PROMPT_MARGIN_TOKENS,
  LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE,
  LocalServerContextFullError,
  estimateLocalPromptTokens,
  localServerApiBase,
  parseLocalServerContextSize,
  planLocalReplyTokens,
  readLocalServerContextSize,
  resetLocalServerSchemaSupport,
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

const isContextProbe = (url: string) => url.endsWith('/props') || url.endsWith('/api/extra/true_max_context_length');

/** Answers chat requests with `chat()`; the context probes get a 404 (a server that reports no size). */
function stubChat(chat: (init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => (isContextProbe(url) ? json({}, 404) : chat(init)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const chatCalls = (fetchMock: ReturnType<typeof stubChat>) =>
  fetchMock.mock.calls.filter(([url]) => !isContextProbe(String(url))) as unknown as Array<[string, RequestInit]>;

afterEach(() => {
  vi.unstubAllGlobals();
  resetLocalServerSchemaSupport();
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
    const fetchMock = stubChat(() =>
      json({choices: [{message: {reasoning_content: 'Hmm.', content: 'Hello.'}, finish_reason: 'stop'}]})
    );
    const adapter = createCompletionAdapter('local-openai', {baseUrl: 'http://127.0.0.1:8080', request});
    expect(await adapter.complete()).toBe('<think>Hmm.</think>Hello.');
    const [[url, init]] = chatCalls(fetchMock);
    expect(url).toBe('http://127.0.0.1:8080/v1/chat/completions');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);

    stubChat(() => json({choices: [{message: {content: '{"a'}, finish_reason: 'length'}]}));
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
    stubChat(() => new Response(body));
    let text = '';
    for await (const chunk of createStreamingAdapter('local-openai', {request}).stream()) text += chunk;
    expect(text).toBe('Paris');

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    await expect(createCompletionAdapter('local-openai', {request}).complete()).rejects.toThrow(
      'Could not connect to the local model server at http://localhost:5001/v1. Check that it is running.'
    );
  });
});

describe('constrained output in the main process (4.68)', () => {
  const responseSchema = {name: 'item', schema: {type: 'object', required: ['name']}};

  it('sends the schema, and retries once without it when the server refuses it', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    stubChat((init) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      return body.response_format
        ? json({error: 'response_format is not supported'}, 422)
        : json({choices: [{message: {content: '{"name":"Echo"}'}}]});
    });
    const config = {request: {...request, responseSchema}};
    expect(await createCompletionAdapter('local-openai', config).complete()).toBe('{"name":"Echo"}');
    expect(bodies[0].response_format).toEqual({type: 'json_schema', json_schema: {name: 'item', strict: true, schema: responseSchema.schema}});
    expect(bodies[1]).not.toHaveProperty('response_format');

    await createCompletionAdapter('local-openai', config).complete();
    expect(bodies).toHaveLength(3);
    expect(bodies[2]).not.toHaveProperty('response_format');
  });
});

describe('reply length from the server context in the main process (4.75)', () => {
  it('matches the renderer estimate, size parsing, and plan', () => {
    expect(estimateLocalPromptTokens([{content: 'a'.repeat(300)}])).toBe(108);
    expect(estimateLocalPromptTokens([{content: '剣の名'}, {content: 'ab'}])).toBe(20);
    expect(parseLocalServerContextSize({default_generation_settings: {n_ctx: 8192}})).toBe(8192);
    expect(parseLocalServerContextSize({value: 16384})).toBe(16384);
    expect(parseLocalServerContextSize({n_ctx: '8192'})).toBeUndefined();
    expect(planLocalReplyTokens({contextSize: 16384, promptTokens: 2000})).toBe(16384 - 2000 - LOCAL_SERVER_PROMPT_MARGIN_TOKENS);
    expect(planLocalReplyTokens({contextSize: 16384, promptTokens: 2000, requested: 5})).toBe(5);
    expect(planLocalReplyTokens({promptTokens: 2000, fallback: 900})).toBe(900);
    expect(() => planLocalReplyTokens({contextSize: 1024, promptTokens: 400})).toThrow(LocalServerContextFullError);
  });

  it('asks the server root for /props, then the KoboldCPP endpoint, and gives up quietly', async () => {
    const answers: Record<string, Response> = {
      'http://localhost:5001/props': json({}, 404),
      'http://localhost:5001/api/extra/true_max_context_length': json({value: 12288})
    };
    const fetchImpl = vi.fn(async (url: string) => answers[url] ?? json({}, 404)) as unknown as typeof fetch;
    expect(await readLocalServerContextSize('http://localhost:5001/v1', {fetchImpl})).toBe(12288);
    const failing = vi.fn(async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    expect(await readLocalServerContextSize('http://localhost:5001/v1', {fetchImpl: failing})).toBeUndefined();
  });

  function stubSizedServer(nCtx: number | undefined) {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/props')) return nCtx ? json({default_generation_settings: {n_ctx: nCtx}}) : json({}, 404);
      if (isContextProbe(url)) return json({}, 404);
      bodies.push(JSON.parse(String(init?.body)));
      return json({choices: [{message: {content: 'ok'}, finish_reason: 'stop'}]});
    }));
    return bodies;
  }

  it('sends max_tokens sized to the context, or the author setting when the server reports none', async () => {
    const promptTokens = estimateLocalPromptTokens([{content: 'Be brief.'}, {content: 'Hi'}]);
    let bodies = stubSizedServer(8192);
    await createCompletionAdapter('local-openai', {request, maxReplyTokens: 900}).complete();
    expect(bodies[0].max_tokens).toBe(8192 - promptTokens - LOCAL_SERVER_PROMPT_MARGIN_TOKENS);

    bodies = stubSizedServer(undefined);
    await createCompletionAdapter('local-openai', {request, maxReplyTokens: 900}).complete();
    await createCompletionAdapter('local-openai', {request}).complete();
    expect(bodies[0].max_tokens).toBe(900);
    expect(bodies[1]).not.toHaveProperty('max_tokens');
  });

  it('does not send a request the context cannot hold', async () => {
    const bodies = stubSizedServer(1024);
    const long = {...request, messages: [{role: 'user' as const, content: 'word '.repeat(600)}]};
    await expect(createCompletionAdapter('local-openai', {request: long}).complete()).rejects.toThrow(
      /too long for the local model/
    );
    const stream = async () => {
      for await (const chunk of createStreamingAdapter('local-openai', {request: long}).stream()) void chunk;
    };
    await expect(stream()).rejects.toThrow(LocalServerContextFullError);
    expect(bodies).toHaveLength(0);
  });
});
