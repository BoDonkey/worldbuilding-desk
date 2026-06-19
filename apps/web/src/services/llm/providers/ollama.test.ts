import {afterEach, describe, expect, it, vi} from 'vitest';
import {OllamaProvider} from './ollama';

const makeStream = (lines: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    }
  });
};

describe('OllamaProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams thinking chunks separately from content chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: makeStream([
        JSON.stringify({message: {thinking: 'Considering names.'}}),
        JSON.stringify({message: {content: 'The Echo Blade'}})
      ])
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'qwen3'
    });
    const chunks: string[] = [];

    for await (const chunk of provider.streamCompletion({
      think: true,
      messages: [{role: 'user', content: 'Draft an item.'}]
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['<think>Considering names.</think>', 'The Echo Blade']);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toMatchObject({
      model: 'qwen3',
      stream: true,
      think: true
    });
  });

  it('includes the system prompt in direct Ollama payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({message: {content: '{"ok":true}'}})
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'qwen3'
    });

    await provider.generateCompletion({
      systemPrompt: 'Return JSON only.',
      responseFormat: 'json',
      messages: [{role: 'user', content: 'Draft an item.'}]
    });

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)).toMatchObject({
      model: 'qwen3',
      stream: false,
      format: 'json',
      messages: [
        {role: 'system', content: 'Return JSON only.'},
        {role: 'user', content: 'Draft an item.'}
      ]
    });
  });
});
