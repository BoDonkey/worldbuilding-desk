import {afterEach, describe, expect, it, vi} from 'vitest';
import {GeminiCompletionAdapter, createCompletionAdapter} from './ProviderRegistry';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gemini in the main process', () => {
  it('sends the key in a header, never the URL, and joins the reply', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({candidates: [{content: {parts: [{text: 'Hel'}, {text: 'lo'}]}, finishReason: 'STOP'}]}),
        {status: 200}
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createCompletionAdapter('gemini', {
      apiKey: 'AIza-secret',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      request: {model: 'gemini-2.5-flash', systemPrompt: 'Be brief.', messages: [{role: 'user', content: 'Hi'}]}
    });

    expect(adapter).toBeInstanceOf(GeminiCompletionAdapter);
    expect(await adapter.complete()).toBe('Hello');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(url).not.toContain('AIza-secret');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-secret');
    expect(JSON.parse(String(init.body))).toMatchObject({
      systemInstruction: {parts: [{text: 'Be brief.'}]},
      contents: [{role: 'user', parts: [{text: 'Hi'}]}],
      generationConfig: {thinkingConfig: {thinkingBudget: 0}}
    });
  });

  it('refuses a reply cut off at the response limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({candidates: [{content: {parts: [{text: 'Partial'}]}, finishReason: 'MAX_TOKENS'}]}))
    ));
    const adapter = createCompletionAdapter('gemini', {apiKey: 'k', request: {messages: [{role: 'user', content: 'Hi'}]}});

    await expect(adapter.complete()).rejects.toThrow(/response limit/);
  });
});
