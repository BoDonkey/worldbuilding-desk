import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {buildOllamaChatPayload} from '../../../../desktop/src/main/providers/ProviderRegistry';
import {
  buildSystemPromptWithContext,
  DEFAULT_SYSTEM_PROMPT,
  foldContextIntoSystemPrompt
} from './contextPrompt';
import {LLMService} from './LLMService';
import {AnthropicProvider} from './providers/anthropic';
import {OllamaProvider} from './providers/ollama';
import type {LLMRequest} from './types';

const context = [
  {source: 'Accepted canon fact - Sera Kestrel', content: 'Sera was a cartographer.', relevance: 0.9},
  {source: 'Linked Source Note: source material, not automatically canon - Dossier', content: 'Gray eyes.'}
];

const request: LLMRequest = {
  systemPrompt: 'Answer from the project.',
  context,
  messages: [{role: 'user', content: 'What did Sera do before delving?'}]
};

const expectedSystem =
  'Answer from the project.\n\nRelevant context from the project:\n' +
  '\n[Source: Accepted canon fact - Sera Kestrel]\nSera was a cartographer.\n' +
  '\n[Source: Linked Source Note: source material, not automatically canon - Dossier]\nGray eyes.\n';

const streamOf = (lines: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      lines.forEach((line) => controller.enqueue(new TextEncoder().encode(`${line}\n`)));
      controller.close();
    }
  });

describe('context prompt rendering', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders context as trust-labelled source blocks after the system prompt', () => {
    expect(buildSystemPromptWithContext(context, request.systemPrompt)).toBe(expectedSystem);
    expect(buildSystemPromptWithContext(undefined, undefined)).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('folds context into the system prompt only when there is context', () => {
    expect(foldContextIntoSystemPrompt(request)).toEqual({
      systemPrompt: expectedSystem,
      messages: request.messages
    });
    const plain = {systemPrompt: 'Return JSON only.', messages: request.messages};
    expect(foldContextIntoSystemPrompt(plain)).toBe(plain);
    expect(foldContextIntoSystemPrompt({...plain, context: []})).toEqual({...plain, context: []});
    expect(foldContextIntoSystemPrompt<LLMRequest>({context, messages: []}).systemPrompt).toBe(
      buildSystemPromptWithContext(context, DEFAULT_SYSTEM_PROMPT)
    );
  });

  it('gives local Ollama the same system text a hosted provider sends', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(async (url) =>
      url.includes('11434')
        ? {ok: true, body: streamOf([JSON.stringify({message: {content: 'ok'}})])}
        : {
            ok: true,
            body: streamOf([
              `data: ${JSON.stringify({type: 'content_block_delta', delta: {type: 'text_delta', text: 'ok'}})}`
            ])
          }
    );
    vi.stubGlobal('fetch', fetchMock);

    for await (const chunk of new OllamaProvider({baseUrl: 'http://localhost:11434', model: 'qwen3'}).streamCompletion(request)) {
      void chunk;
    }
    for await (const chunk of new AnthropicProvider({apiKey: 'key'}).streamCompletion(request)) {
      void chunk;
    }

    const ollamaBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const anthropicBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(ollamaBody.messages[0]).toEqual({role: 'system', content: expectedSystem});
    expect(anthropicBody.request.systemPrompt).toBe(expectedSystem);
  });

  it('sends context through the desktop bridge inside the system prompt, for every provider', async () => {
    const llmComplete = vi.fn(async () => 'ok');
    vi.stubGlobal('window', {electronAPI: {llmComplete}});
    const settings = {
      provider: 'anthropic',
      configs: {anthropic: {model: 'claude-test', apiKey: 'key'}}
    } as unknown as ProjectAISettings;

    await new LLMService(settings).complete({...request, cache: false});

    const sent = (llmComplete.mock.calls[0] as unknown as [{request: LLMRequest}])[0].request;
    expect(sent.systemPrompt).toBe(expectedSystem);
    expect(sent.context).toBeUndefined();
    // The desktop main process's Ollama adapter then carries it as the system message.
    expect(
      buildOllamaChatPayload({request: {...sent, messages: sent.messages}}, false).messages[0]
    ).toEqual({role: 'system', content: expectedSystem});
  });
});
