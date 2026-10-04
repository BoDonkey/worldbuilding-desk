import type {ProviderId} from '../endpointPolicy';

export type {ProviderId};

export interface RendererMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RendererContextChunk {
  content: string;
  source: string;
  relevance?: number;
}

export interface LLMRequestPayload {
  messages: RendererMessage[];
  systemPrompt?: string;
  context?: RendererContextChunk[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  responseFormat?: 'json';
  think?: boolean | 'low' | 'medium' | 'high';
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  request: LLMRequestPayload;
  /** Aborts the provider request, e.g. when the author presses Stop. */
  signal?: AbortSignal;
}

export interface StreamingAdapter {
  stream(): AsyncIterable<string>;
}

export interface CompletionAdapter {
  complete(): Promise<string>;
}

const HOSTED_RESPONSE_LIMIT_MESSAGE =
  "The provider stopped at this project's response limit, so no complete answer was used. Raise Max response tokens in Settings and try again.";

function assertHostedResponseComplete(
  provider: 'anthropic' | 'openai' | 'gemini',
  reason: unknown
) {
  const normalized = typeof reason === 'string' ? reason.toLowerCase() : '';
  if (
    (provider === 'anthropic' && normalized === 'max_tokens') ||
    (provider === 'openai' && normalized === 'length') ||
    (provider === 'gemini' && normalized === 'max_tokens')
  ) {
    throw new Error(HOSTED_RESPONSE_LIMIT_MESSAGE);
  }
}

function openAIUsesReasoning(model: string): boolean {
  return /^(o\d|gpt-[5-9](?:\.|-|$))/.test(model.toLowerCase());
}

function buildOpenAIRequest(config: ProviderConfig, stream: boolean) {
  const model = config.request.model ?? 'gpt-4o-mini';
  const reasoning = openAIUsesReasoning(model);
  return {
    model,
    ...(!reasoning ? {temperature: config.request.temperature ?? 0.7} : {}),
    max_completion_tokens: config.request.maxTokens ?? 4096,
    ...(reasoning ? {reasoning_effort: 'low'} : {}),
    ...(config.request.responseFormat === 'json'
      ? {response_format: {type: 'json_object'}}
      : {}),
    stream,
    messages: buildMessagesWithSystem(config.request)
  };
}

export function buildOllamaChatPayload(config: ProviderConfig, stream: boolean) {
  const options: Record<string, number> = {};
  if (typeof config.request.maxTokens === 'number') {
    options.num_predict = config.request.maxTokens;
  }
  if (typeof config.request.temperature === 'number') {
    options.temperature = config.request.temperature;
  }

  return {
    model: config.request.model ?? 'llama3.1',
    stream,
    ...(config.request.think !== undefined ? {think: config.request.think} : {}),
    ...(config.request.responseFormat === 'json' ? {format: 'json'} : {}),
    ...(Object.keys(options).length ? {options} : {}),
    messages: buildMessagesWithSystem(config.request)
  };
}

function buildMessagesWithSystem(request: LLMRequestPayload): RendererMessage[] {
  const messages: RendererMessage[] = [];

  if (request.systemPrompt) {
    messages.push({role: 'system', content: request.systemPrompt});
  }

  for (const message of request.messages) {
    messages.push({role: message.role, content: message.content});
  }

  return messages;
}

export class AnthropicStreamingAdapter implements StreamingAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async *stream(): AsyncIterable<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is missing');
    }
    const response = await fetch(`${(this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      signal: this.config.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.request.model ?? 'claude-sonnet-4-20250514',
        max_tokens: this.config.request.maxTokens ?? 4096,
        temperature: this.config.request.temperature ?? 0.7,
        system: this.config.request.systemPrompt,
        stream: true,
        messages: this.buildMessages()
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let stopReason: unknown;

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'message_delta') stopReason = parsed.delta?.stop_reason;
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    }
    assertHostedResponseComplete('anthropic', stopReason);
  }

  private buildMessages() {
    return this.config.request.messages
      .filter(
        (m): m is RendererMessage & {role: 'user' | 'assistant'} =>
          m.role === 'user' || m.role === 'assistant'
      )
      .map((m) => ({role: m.role, content: m.content}));
  }
}

export class AnthropicCompletionAdapter implements CompletionAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is missing');
    }
    const response = await fetch(`${(this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      signal: this.config.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.request.model ?? 'claude-sonnet-4-20250514',
        max_tokens: this.config.request.maxTokens ?? 4096,
        temperature: this.config.request.temperature ?? 0.7,
        system: this.config.request.systemPrompt,
        messages: this.buildMessages()
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    assertHostedResponseComplete('anthropic', data.stop_reason);
    return Array.isArray(data.content)
      ? data.content
          .map((part: {type?: unknown; text?: unknown}) =>
            part.type === 'text' && typeof part.text === 'string' ? part.text : ''
          )
          .join('')
      : '';
  }

  private buildMessages() {
    return this.config.request.messages
      .filter(
        (m): m is RendererMessage & {role: 'user' | 'assistant'} =>
          m.role === 'user' || m.role === 'assistant'
      )
      .map((m) => ({role: m.role, content: m.content}));
  }
}

export class OpenAIStreamingAdapter implements StreamingAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async *stream(): AsyncIterable<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is missing');
    }
    const baseUrl = (this.config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: this.config.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(buildOpenAIRequest(this.config, true))
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finishReason: unknown;

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          finishReason = parsed.choices?.[0]?.finish_reason ?? finishReason;
          const delta: string | undefined =
            parsed.choices?.[0]?.delta?.content ?? undefined;
          if (delta) {
            yield delta;
          }
        } catch {
          // Ignore malformed chunks
        }
      }
    }
    assertHostedResponseComplete('openai', finishReason);
  }

}

export class OpenAICompletionAdapter implements CompletionAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is missing');
    }
    const baseUrl = (this.config.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: this.config.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(buildOpenAIRequest(this.config, false))
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    assertHostedResponseComplete('openai', data.choices?.[0]?.finish_reason);
    return data.choices?.[0]?.message?.content ?? '';
  }
}

export class OllamaStreamingAdapter implements StreamingAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async *stream(): AsyncIterable<string> {
    const baseUrl = (this.config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      signal: this.config.signal,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(buildOllamaChatPayload(this.config, true))
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, {stream: true});
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const thinking = parsed.message?.thinking;
          if (thinking) {
            yield `<think>${thinking}</think>`;
          }
          const message = parsed.message?.content;
          if (message) {
            yield message;
          }
        } catch {
          // ignore
        }
      }
    }
  }
}

export class OllamaCompletionAdapter implements CompletionAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(): Promise<string> {
    const baseUrl = (this.config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      signal: this.config.signal,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(buildOllamaChatPayload(this.config, false))
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const thinking = data.message?.thinking;
    const content = data.message?.content ?? '';
    return thinking ? `<think>${thinking}</think>${content}` : content;
  }
}

/** Mirrors the renderer's Gemini thinking policy (hostedResponsePolicy.ts). */
export function geminiThinkingConfig(
  model: string,
  maxOutputTokens = Number.POSITIVE_INFINITY
): Record<string, unknown> | undefined {
  const normalized = model.toLowerCase();
  if (/^gemini-2\.5-pro(?:-|$)/.test(normalized)) {
    return maxOutputTokens > 128 ? {thinkingBudget: 128} : undefined;
  }
  if (/^gemini-2\.5-(?:flash|flash-lite)(?:-|$)/.test(normalized)) return {thinkingBudget: 0};
  if (/^gemini-[3-9](?:\.|-|$)/.test(normalized)) return {thinkingLevel: 'low'};
  return undefined;
}

export function buildGeminiRequest(config: ProviderConfig) {
  const model = config.request.model ?? 'gemini-2.5-flash-lite';
  const maxOutputTokens = config.request.maxTokens ?? 4096;
  const thinkingConfig = geminiThinkingConfig(model, maxOutputTokens);
  return {
    model,
    body: {
      ...(config.request.systemPrompt
        ? {systemInstruction: {parts: [{text: config.request.systemPrompt}]}}
        : {}),
      contents: config.request.messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{text: message.content}]
        })),
      generationConfig: {
        temperature: config.request.temperature ?? 0.7,
        maxOutputTokens,
        ...(thinkingConfig ? {thinkingConfig} : {})
      }
    }
  };
}

interface GeminiResponse {
  candidates?: Array<{content?: {parts?: Array<{text?: string}>}; finishReason?: string}>;
}

/**
 * Gemini runs in the main process like the other hosted providers, so its key
 * never reaches the renderer. The key travels in a header, not the URL.
 */
export class GeminiCompletionAdapter implements CompletionAdapter {
  private readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Gemini API key is missing');
    }
    const {model, body} = buildGeminiRequest(this.config);
    const base = (this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    const root = /\/v1(?:beta)?$/.test(base) ? base : `${base}/v1beta`;
    const response = await fetch(`${root}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: this.config.signal,
      headers: {'Content-Type': 'application/json', 'x-goog-api-key': this.config.apiKey},
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    assertHostedResponseComplete('gemini', data.candidates?.[0]?.finishReason);
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  }
}

/** Gemini answers in one piece, as the renderer provider did. */
export class GeminiStreamingAdapter implements StreamingAdapter {
  private readonly completion: GeminiCompletionAdapter;

  constructor(config: ProviderConfig) {
    this.completion = new GeminiCompletionAdapter(config);
  }

  async *stream(): AsyncIterable<string> {
    const content = await this.completion.complete();
    if (content) yield content;
  }
}

export function createStreamingAdapter(
  providerId: ProviderId,
  config: ProviderConfig
): StreamingAdapter {
  if (providerId === 'anthropic') {
    return new AnthropicStreamingAdapter(config);
  }

  if (providerId === 'openai') {
    return new OpenAIStreamingAdapter(config);
  }

  if (providerId === 'gemini') {
    return new GeminiStreamingAdapter(config);
  }

  if (providerId === 'ollama') {
    return new OllamaStreamingAdapter(config);
  }

  throw new Error(`Provider "${providerId}" is not implemented.`);
}

export function createCompletionAdapter(
  providerId: ProviderId,
  config: ProviderConfig
): CompletionAdapter {
  if (providerId === 'anthropic') {
    return new AnthropicCompletionAdapter(config);
  }

  if (providerId === 'openai') {
    return new OpenAICompletionAdapter(config);
  }

  if (providerId === 'gemini') {
    return new GeminiCompletionAdapter(config);
  }

  if (providerId === 'ollama') {
    return new OllamaCompletionAdapter(config);
  }

  throw new Error(`Provider "${providerId}" is not implemented.`);
}
