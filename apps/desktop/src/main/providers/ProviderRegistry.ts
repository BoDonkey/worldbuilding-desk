import Anthropic from '@anthropic-ai/sdk';
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
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  request: LLMRequestPayload;
}

export interface StreamingAdapter {
  stream(): AsyncIterable<string>;
}

export class AnthropicStreamingAdapter implements StreamingAdapter {
  constructor(private readonly config: ProviderConfig) {}

  async *stream(): AsyncIterable<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is missing');
    }
    const client = new Anthropic({apiKey: this.config.apiKey});
    const anthropicMessages = this.config.request.messages
      .filter(
        (m): m is RendererMessage & {role: 'user' | 'assistant'} =>
          m.role === 'user' || m.role === 'assistant'
      )
      .map((m) => ({role: m.role, content: m.content}));

    const stream = await client.messages.stream({
      model: this.config.request.model ?? 'claude-sonnet-4-20250514',
      max_tokens: this.config.request.maxTokens ?? 4096,
      temperature: this.config.request.temperature ?? 0.7,
      system: this.config.request.systemPrompt,
      messages: anthropicMessages
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }
}

export class OpenAIStreamingAdapter implements StreamingAdapter {
  constructor(private readonly config: ProviderConfig) {}

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
    const messages: RendererMessage[] = [];

    if (this.config.request.systemPrompt) {
      messages.push({role: 'system', content: this.config.request.systemPrompt});
    }

    for (const message of this.config.request.messages) {
      messages.push({role: message.role, content: message.content});
    }

    return messages;
  }
}

export class OllamaStreamingAdapter implements StreamingAdapter {
  constructor(private readonly config: ProviderConfig) {}

  async *stream(): AsyncIterable<string> {
    const baseUrl = (this.config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: this.config.request.model ?? 'llama3.1',
        stream: true,
        messages: this.buildMessages()
      })
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

  private buildMessages(): RendererMessage[] {
    const messages: RendererMessage[] = [];

    if (this.config.request.systemPrompt) {
      messages.push({role: 'system', content: this.config.request.systemPrompt});
    }

    for (const message of this.config.request.messages) {
      messages.push({role: message.role, content: message.content});
    }

    return messages;
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
