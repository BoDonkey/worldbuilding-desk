export type ProviderId = 'anthropic' | 'openai' | 'ollama';

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
}

export interface StreamingAdapter {
  stream(): AsyncIterable<string>;
}

export interface CompletionAdapter {
  complete(): Promise<string>;
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
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
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    }
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.request.model ?? 'gpt-4o-mini',
        temperature: this.config.request.temperature ?? 0.7,
        max_tokens: this.config.request.maxTokens ?? 4096,
        stream: true,
        messages: this.buildMessages()
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
  }

  private buildMessages() {
    return buildMessagesWithSystem(this.config.request);
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.request.model ?? 'gpt-4o-mini',
        temperature: this.config.request.temperature ?? 0.7,
        max_tokens: this.config.request.maxTokens ?? 4096,
        stream: false,
        messages: buildMessagesWithSystem(this.config.request)
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
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

  if (providerId === 'ollama') {
    return new OllamaCompletionAdapter(config);
  }

  throw new Error(`Provider "${providerId}" is not implemented.`);
}
