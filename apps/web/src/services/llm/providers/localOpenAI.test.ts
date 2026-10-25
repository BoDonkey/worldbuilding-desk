import {afterEach, describe, expect, it, vi} from 'vitest';
import {LocalOpenAIProvider} from './localOpenAI';
import {normalizeLocalMaxReplyTokens} from '../providerConfig';
import {
  LOCAL_SERVER_MIN_REPLY_TOKENS,
  LOCAL_SERVER_PROMPT_MARGIN_TOKENS,
  LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE,
  LocalServerContextFullError,
  buildLocalServerChatPayload,
  estimateLocalPromptTokens,
  localServerApiBase,
  parseLocalServerContextSize,
  parseLocalServerModels,
  planLocalReplyTokens,
  resetLocalServerSchemaSupport
} from '../localServer';

const sse = (events: unknown[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

/** Answers `/models` with `models` and `/chat/completions` with `chat`. */
function stubServer(models: string[] | null, chat: () => Response) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/models')) return models ? json({data: models.map((id) => ({id}))}) : json({}, 404);
    return chat();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const chatCalls = (fetchMock: ReturnType<typeof stubServer>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/chat/completions')) as unknown as Array<
    [string, RequestInit]
  >;

describe('local server helpers', () => {
  it('adds /v1 only to an address with no path', () => {
    expect(localServerApiBase(undefined)).toBe('http://localhost:5001/v1');
    expect(localServerApiBase('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/v1');
    expect(localServerApiBase('http://127.0.0.1:8080/')).toBe('http://127.0.0.1:8080/v1');
    expect(localServerApiBase('http://localhost:1234/v1/')).toBe('http://localhost:1234/v1');
    expect(localServerApiBase('http://localhost:5001/api/v1')).toBe('http://localhost:5001/api/v1');
  });

  it('reads model ids from a /models listing and ignores malformed entries', () => {
    expect(parseLocalServerModels({data: [{id: 'koboldcpp/mistral'}, {id: ''}, {name: 'x'}, {id: ' qwen '}]})).toEqual([
      'koboldcpp/mistral',
      'qwen'
    ]);
    expect(parseLocalServerModels({models: []})).toEqual([]);
  });

  it('builds an OpenAI-shaped body with context folded in, no response_format and no default cap', () => {
    const payload = buildLocalServerChatPayload(
      {
        systemPrompt: 'Be brief.',
        context: [{source: 'World Bible', content: 'Mira is a smith.'}],
        messages: [{role: 'user', content: 'Who is Mira?'}],
        responseFormat: 'json',
        think: false
      },
      undefined,
      false
    );
    expect(payload).not.toHaveProperty('model');
    expect(payload).not.toHaveProperty('max_tokens');
    expect(payload).not.toHaveProperty('response_format');
    expect(payload).not.toHaveProperty('think');
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[0].content).toContain('Be brief.');
    expect(payload.messages[0].content).toContain('Mira is a smith.');
    expect(buildLocalServerChatPayload({messages: [], maxTokens: 64, temperature: 0.2}, 'm', true)).toMatchObject({
      model: 'm',
      stream: true,
      max_tokens: 64,
      temperature: 0.2
    });
  });
});

describe('LocalOpenAIProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetLocalServerSchemaSupport();
  });

  it('refuses a non-loopback address before sending anything', async () => {
    const fetchMock = stubServer(['m'], () => json({}));
    const provider = new LocalOpenAIProvider({baseUrl: 'http://192.168.1.20:5001/v1'});
    await expect(provider.generateCompletion({messages: [{role: 'user', content: 'Hi'}]})).rejects.toThrow(
      /must run on this computer/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to the chat endpoint with no key, naming the first listed model when none is set', async () => {
    const fetchMock = stubServer(['loaded-model', 'other'], () =>
      json({choices: [{message: {content: 'Hello.'}, finish_reason: 'stop'}], usage: {prompt_tokens: 4, completion_tokens: 2}})
    );
    const provider = new LocalOpenAIProvider({baseUrl: 'http://localhost:1234/v1'});
    const response = await provider.generateCompletion({messages: [{role: 'user', content: 'Hi'}]});

    expect(response).toEqual({content: 'Hello.', usage: {promptTokens: 4, completionTokens: 2}});
    const [[url, init]] = chatCalls(fetchMock);
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(JSON.parse(String(init.body)).model).toBe('loaded-model');
  });

  it('sends the configured model without asking the server, and no model when nothing is listed', async () => {
    const fetchMock = stubServer(null, () => json({choices: [{message: {content: 'ok'}}]}));
    await new LocalOpenAIProvider({model: 'mistral-7b'}).generateCompletion({messages: [{role: 'user', content: 'Hi'}]});
    await new LocalOpenAIProvider({}).generateCompletion({messages: [{role: 'user', content: 'Hi'}]});

    const bodies = chatCalls(fetchMock).map(([, init]) => JSON.parse(String(init.body)));
    expect(bodies[0].model).toBe('mistral-7b');
    expect(bodies[1]).not.toHaveProperty('model');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/models'))).toHaveLength(1);
  });

  it('streams reasoning as think-wrapped chunks, separate from the answer', async () => {
    stubServer(['m'], () =>
      new Response(
        sse([
          {choices: [{delta: {reasoning_content: 'Weighing names.'}}]},
          {choices: [{delta: {content: 'The Echo'}}]},
          {choices: [{delta: {content: ' Blade'}, finish_reason: 'stop'}]}
        ])
      )
    );
    const chunks: string[] = [];
    for await (const chunk of new LocalOpenAIProvider({}).streamCompletion({messages: [{role: 'user', content: 'Name it.'}]})) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['<think>Weighing names.</think>', 'The Echo', ' Blade']);
  });

  it('refuses a reply cut off at a length limit, streamed or not', async () => {
    stubServer(['m'], () => json({choices: [{message: {content: '{"name": "Ech'}, finish_reason: 'length'}]}));
    await expect(new LocalOpenAIProvider({}).generateCompletion({messages: [{role: 'user', content: 'Hi'}]})).rejects.toThrow(
      LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE
    );

    stubServer(['m'], () => new Response(sse([{choices: [{delta: {content: '{"na'}, finish_reason: 'length'}]}])));
    const consume = async () => {
      for await (const chunk of new LocalOpenAIProvider({}).streamCompletion({messages: [{role: 'user', content: 'Hi'}]})) {
        void chunk;
      }
    };
    await expect(consume()).rejects.toThrow(LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE);
  });

  it('names the server in connection and status errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(
      new LocalOpenAIProvider({model: 'm'}).generateCompletion({messages: [{role: 'user', content: 'Hi'}]})
    ).rejects.toThrow('Could not connect to the local model server at http://localhost:5001/v1. Check that it is running.');

    stubServer(['m'], () => json({error: {message: 'No models loaded.'}}, 400));
    await expect(new LocalOpenAIProvider({}).generateCompletion({messages: [{role: 'user', content: 'Hi'}]})).rejects.toThrow(
      'The local model server responded with 400: No models loaded.'
    );
  });
});

describe('constrained output (4.68)', () => {
  const responseSchema = {name: 'item', schema: {type: 'object', properties: {name: {type: 'string'}}, required: ['name']}};
  const ask = {messages: [{role: 'user' as const, content: 'Name it.'}], responseFormat: 'json' as const, responseSchema};
  const bodyOf = (call: [string, RequestInit]) => JSON.parse(String(call[1].body));

  afterEach(() => {
    vi.unstubAllGlobals();
    resetLocalServerSchemaSupport();
  });

  it('sends the schema as response_format json_schema, and nothing for plain JSON requests', async () => {
    const fetchMock = stubServer(['m'], () => json({choices: [{message: {content: '{"name":"Echo"}'}, finish_reason: 'stop'}]}));
    await new LocalOpenAIProvider({}).generateCompletion(ask);
    await new LocalOpenAIProvider({}).generateCompletion({...ask, responseSchema: undefined});

    const [constrained, plain] = chatCalls(fetchMock).map(bodyOf);
    expect(constrained.response_format).toEqual({type: 'json_schema', json_schema: {name: 'item', strict: true, schema: responseSchema.schema}});
    expect(plain).not.toHaveProperty('response_format');
  });

  it('retries once without the schema when a server refuses it, and skips it afterwards', async () => {
    const fetchMock = stubServer(['m'], () => json({choices: [{message: {content: '{"name":"Echo"}'}}]}));
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/models')) return json({data: [{id: 'm'}]});
      return JSON.parse(String(init?.body)).response_format
        ? json({error: {message: 'Unsupported response_format'}}, 400)
        : json({choices: [{message: {content: '{"name":"Echo"}'}}]});
    });

    expect((await new LocalOpenAIProvider({}).generateCompletion(ask)).content).toBe('{"name":"Echo"}');
    expect(chatCalls(fetchMock).map((call) => 'response_format' in bodyOf(call))).toEqual([true, false]);

    await new LocalOpenAIProvider({}).generateCompletion(ask);
    expect(chatCalls(fetchMock).map((call) => 'response_format' in bodyOf(call))).toEqual([true, false, false]);
  });

  it('does not retry other failures', async () => {
    const fetchMock = stubServer(['m'], () => json({error: 'model crashed'}, 500));
    await expect(new LocalOpenAIProvider({}).generateCompletion(ask)).rejects.toThrow('responded with 500: model crashed');
    expect(chatCalls(fetchMock)).toHaveLength(1);
  });
});

describe('reply length from the server context (4.75)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLocalServerSchemaSupport();
  });

  it('estimates prompt tokens high: a third per ASCII character, one per other character, eight per message', () => {
    expect(estimateLocalPromptTokens([{content: 'a'.repeat(300)}])).toBe(108);
    expect(estimateLocalPromptTokens([{content: '剣の名'}, {content: 'ab'}])).toBe(3 + 1 + 16);
    expect(estimateLocalPromptTokens([])).toBe(0);
  });

  it('reads the context size from llama.cpp /props, KoboldCPP, or neither', () => {
    expect(parseLocalServerContextSize({default_generation_settings: {n_ctx: 8192}, n_ctx: 1})).toBe(8192);
    expect(parseLocalServerContextSize({n_ctx: 16384})).toBe(16384);
    expect(parseLocalServerContextSize({value: 16384})).toBe(16384);
    expect(parseLocalServerContextSize({value: 'big'})).toBeUndefined();
    expect(parseLocalServerContextSize({n_ctx: 12.5})).toBeUndefined();
    expect(parseLocalServerContextSize({n_ctx: 0})).toBeUndefined();
    expect(parseLocalServerContextSize(null)).toBeUndefined();
  });

  it('caps a reply at the room the prompt leaves, keeping a smaller caller cap', () => {
    const room = 16384 - 2000 - LOCAL_SERVER_PROMPT_MARGIN_TOKENS;
    expect(planLocalReplyTokens({contextSize: 16384, promptTokens: 2000})).toBe(room);
    expect(planLocalReplyTokens({contextSize: 16384, promptTokens: 2000, requested: 600})).toBe(600);
    expect(planLocalReplyTokens({contextSize: 16384, promptTokens: 2000, requested: 20000})).toBe(room);
    expect(planLocalReplyTokens({contextSize: 16384, promptTokens: 2000, fallback: 900})).toBe(room);
  });

  it('uses the caller cap, then the author setting, then nothing when the size is unknown', () => {
    expect(planLocalReplyTokens({promptTokens: 2000, requested: 600, fallback: 900})).toBe(600);
    expect(planLocalReplyTokens({promptTokens: 2000, fallback: 900})).toBe(900);
    expect(planLocalReplyTokens({promptTokens: 2000})).toBeUndefined();
  });

  it('keeps only a whole-number Maximum reply length within its bounds', () => {
    expect(normalizeLocalMaxReplyTokens(4096)).toBe(4096);
    expect(normalizeLocalMaxReplyTokens(64)).toBe(64);
    expect(normalizeLocalMaxReplyTokens(131072)).toBe(131072);
    for (const bad of [63, 131073, 500.5, '4096', null, undefined, Number.NaN]) {
      expect(normalizeLocalMaxReplyTokens(bad)).toBeUndefined();
    }
  });

  it('refuses a prompt that leaves less room than the reply needs', () => {
    const edge = 8192 - LOCAL_SERVER_PROMPT_MARGIN_TOKENS - LOCAL_SERVER_MIN_REPLY_TOKENS;
    expect(planLocalReplyTokens({contextSize: 8192, promptTokens: edge})).toBe(LOCAL_SERVER_MIN_REPLY_TOKENS);
    expect(() => planLocalReplyTokens({contextSize: 8192, promptTokens: edge + 1})).toThrow(LocalServerContextFullError);
    expect(() => planLocalReplyTokens({contextSize: 8192, promptTokens: 9000})).toThrow(
      /about 9,000 tokens, and the model's context holds 8,192\. It was not sent/
    );
    // A tiny cap (the connection test's) still fits where a full reply would not.
    expect(planLocalReplyTokens({contextSize: 8192, promptTokens: edge + 400, requested: 5})).toBe(5);
  });

  /** A server whose `/props` (or KoboldCPP endpoint) reports `context`, recording chat bodies. */
  function stubContextServer(context: {props?: unknown; kobold?: unknown}) {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/models')) return json({data: [{id: 'm'}]});
      if (url.endsWith('/props')) return context.props ? json(context.props) : json({}, 404);
      if (url.endsWith('/api/extra/true_max_context_length')) return context.kobold ? json(context.kobold) : json({}, 404);
      return json({choices: [{message: {content: 'ok'}, finish_reason: 'stop'}]});
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const ask = {systemPrompt: 'Be brief.', messages: [{role: 'user' as const, content: 'Name the blade.'}]};
  const promptTokens = estimateLocalPromptTokens([{content: 'Be brief.'}, {content: 'Name the blade.'}]);

  it('sends max_tokens sized to the reported context, asking the server root rather than /v1', async () => {
    const fetchMock = stubContextServer({props: {default_generation_settings: {n_ctx: 16384}}});
    await new LocalOpenAIProvider({baseUrl: 'http://localhost:5001/v1', maxReplyTokens: 900}).generateCompletion(ask);

    const [call] = chatCalls(fetchMock);
    expect(JSON.parse(String(call[1].body)).max_tokens).toBe(16384 - promptTokens - LOCAL_SERVER_PROMPT_MARGIN_TOKENS);
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain('http://localhost:5001/props');
  });

  it("falls back to KoboldCPP's own endpoint, then to the author setting", async () => {
    let fetchMock = stubContextServer({kobold: {value: 8192}});
    await new LocalOpenAIProvider({}).generateCompletion(ask);
    expect(JSON.parse(String(chatCalls(fetchMock)[0][1].body)).max_tokens).toBe(
      8192 - promptTokens - LOCAL_SERVER_PROMPT_MARGIN_TOKENS
    );

    fetchMock = stubContextServer({});
    await new LocalOpenAIProvider({maxReplyTokens: 900}).generateCompletion(ask);
    await new LocalOpenAIProvider({}).generateCompletion(ask);
    const [withSetting, without] = chatCalls(fetchMock).map(([, init]) => JSON.parse(String(init.body)));
    expect(withSetting.max_tokens).toBe(900);
    expect(without).not.toHaveProperty('max_tokens');
  });

  it('does not send a request the context cannot hold, streamed or not', async () => {
    const fetchMock = stubContextServer({props: {n_ctx: 1024}});
    const long = {messages: [{role: 'user' as const, content: 'word '.repeat(600)}]};
    await expect(new LocalOpenAIProvider({}).generateCompletion(long)).rejects.toThrow(LocalServerContextFullError);
    const consume = async () => {
      for await (const chunk of new LocalOpenAIProvider({}).streamCompletion(long)) void chunk;
    };
    await expect(consume()).rejects.toThrow(LocalServerContextFullError);
    expect(chatCalls(fetchMock)).toHaveLength(0);
  });
});
