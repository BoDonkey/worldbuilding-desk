import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AnthropicProvider} from './anthropic';
import {GeminiProvider} from './gemini';
import {OpenAIProvider} from './openai';
import {HOSTED_RESPONSE_LIMIT_MESSAGE} from '../hostedResponsePolicy';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: {'Content-Type': 'application/json'}
  });

describe('hosted provider response ceilings', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('uses OpenAI max_completion_tokens and low effort for a reasoning model', async () => {
    let requestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      requestInit = init;
      return jsonResponse({
        choices: [{message: {content: 'Complete.'}, finish_reason: 'stop'}],
        usage: {prompt_tokens: 4, completion_tokens: 2}
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIProvider({apiKey: 'test', model: 'gpt-5-mini'});
    await expect(provider.generateCompletion({
      messages: [{role: 'user', content: 'Help'}],
      maxTokens: 700,
      temperature: 0.9
    })).resolves.toMatchObject({content: 'Complete.'});

    const payload = JSON.parse(requestInit?.body as string);
    expect(payload).toMatchObject({
      model: 'gpt-5-mini',
      max_completion_tokens: 700,
      reasoning_effort: 'low'
    });
    expect(payload).not.toHaveProperty('max_tokens');
    expect(payload).not.toHaveProperty('temperature');
  });

  it('rejects ordinary OpenAI replies stopped by the completion ceiling', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      choices: [{message: {content: 'Partial'}, finish_reason: 'length'}]
    })));
    const provider = new OpenAIProvider({apiKey: 'test'});
    await expect(provider.generateCompletion({
      messages: [{role: 'user', content: 'Help'}],
      maxTokens: 500
    })).rejects.toThrow(HOSTED_RESPONSE_LIMIT_MESSAGE);
  });

  it('rejects ordinary Anthropic replies stopped by max_tokens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      content: [{type: 'text', text: 'Partial'}],
      stop_reason: 'max_tokens',
      usage: {input_tokens: 3, output_tokens: 500}
    })));
    const provider = new AnthropicProvider({apiKey: 'test'});
    await expect(provider.generateCompletion({
      messages: [{role: 'user', content: 'Help'}],
      maxTokens: 500
    })).rejects.toThrow(HOSTED_RESPONSE_LIMIT_MESSAGE);
  });

  it('sets Gemini thinking policy and rejects MAX_TOKENS', async () => {
    let requestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      requestInit = init;
      return jsonResponse({
        candidates: [{content: {parts: [{text: 'Partial'}]}, finishReason: 'MAX_TOKENS'}]
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({apiKey: 'test', model: 'gemini-2.5-pro'});

    await expect(provider.generateCompletion({
      messages: [{role: 'user', content: 'Help'}],
      maxTokens: 500
    })).rejects.toThrow(HOSTED_RESPONSE_LIMIT_MESSAGE);

    const payload = JSON.parse(requestInit?.body as string);
    expect(payload.generationConfig).toMatchObject({
      maxOutputTokens: 500,
      thinkingConfig: {thinkingBudget: 128}
    });
  });
});
