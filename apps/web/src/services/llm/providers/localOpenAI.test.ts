import {afterEach, describe, expect, it, vi} from 'vitest';
import {LocalOpenAIProvider} from './localOpenAI';
import {
  LOCAL_SERVER_RESPONSE_LIMIT_MESSAGE,
  buildLocalServerChatPayload,
  localServerApiBase,
  parseLocalServerModels,
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
