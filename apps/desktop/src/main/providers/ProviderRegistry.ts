import Anthropic from '@anthropic-ai/sdk';
export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama';

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

export interface ProviderResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface StreamingAdapter {
  stream(): AsyncIterable<string>;
}

export interface ProviderClient extends StreamingAdapter {
  complete(): Promise<ProviderResponse>;
}

const DEFAULT_SYSTEM_PROMPT =
  'You are an AI assistant helping authors create LitRPG/GameLit content.';

function buildSystemPrompt(request: LLMRequestPayload): string {
  let prompt = request.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  if (request.context && request.context.length > 0) {
    prompt += '\n\nRelevant context from the project:\n';
    request.context.forEach((chunk) => {
      prompt += `\n[Source: ${chunk.source}]\n${chunk.content}\n`;
    });
  }

  return prompt;
}

export class AnthropicProviderClient implements ProviderClient {
  constructor(private readonly config: ProviderConfig) {}

  async complete(): Promise<ProviderResponse> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is missing');
    }

    const client = new Anthropic({apiKey: this.config.apiKey});
    const message = await client.messages.create({
      model: this.config.request.model ?? 'claude-sonnet-4-20250514',
      max_tokens: this.config.request.maxTokens ?? 4096,
      temperature: this.config.request.temperature ?? 0.7,
      system: buildSystemPrompt(this.config.request),
      messages: this.getAnthropicMessages()
    });

    const content = message.content
      .filter((block): block is {type: 'text'; text: string} => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content,
      usage: message.usage
        ? {
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens
          }
        : undefined
    };
  }

  async *stream(): AsyncIterable<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is missing');
    }
    const client = new Anthropic({apiKey: this.config.apiKey});

    const stream = await client.messages.stream({
      model: this.config.request.model ?? 'claude-sonnet-4-20250514',
      max_tokens: this.config.request.maxTokens ?? 4096,
      temperature: this.config.request.temperature ?? 0.7,
      system: buildSystemPrompt(this.config.request),
      messages: this.getAnthropicMessages()
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }

  private getAnthropicMessages() {
    return this.config.request.messages
      .filter(
        (m): m is RendererMessage & {role: 'user' | 'assistant'} =>
          m.role === 'user' || m.role === 'assistant'
      )
      .map((m) => ({role: m.role, content: m.content}));
  }
}

export class OpenAIProviderClient implements ProviderClient {
  constructor(private readonly config: ProviderConfig) {}

  async complete(): Promise<ProviderResponse> {
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
        messages: this.buildMessages()
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens
          }
        : undefined
    };
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
    const messages: RendererMessage[] = [];

    messages.push({role: 'system', content: buildSystemPrompt(this.config.request)});

    for (const message of this.config.request.messages) {
      messages.push({role: message.role, content: message.content});
    }

    return messages;
  }
}

export class GeminiProviderClient implements ProviderClient {
  constructor(private readonly config: ProviderConfig) {}

  async complete(): Promise<ProviderResponse> {
    if (!this.config.apiKey) {
      throw new Error('Gemini API key is missing');
    }

    const model = this.config.request.model ?? 'gemini-2.0-flash';
    const baseUrl = (this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta')
      .replace(/\/$/, '');
    const endpoint = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(
      this.config.apiKey
    )}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        systemInstruction: {
          parts: [{text: buildSystemPrompt(this.config.request)}]
        },
        contents: this.config.request.messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{text: message.content}]
          })),
        generationConfig: {
          temperature: this.config.request.temperature ?? 0.7,
          maxOutputTokens: this.config.request.maxTokens ?? 4096
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
    const content =
      data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    return {
      content,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount
          }
        : undefined
    };
  }

  async *stream(): AsyncIterable<string> {
    const response = await this.complete();
    if (response.content) {
      yield response.content;
    }
  }
}

export class OllamaProviderClient implements ProviderClient {
  constructor(private readonly config: ProviderConfig) {}

  async complete(): Promise<ProviderResponse> {
    const baseUrl = (this.config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: this.config.request.model ?? 'llama3.1',
        stream: false,
        messages: this.buildMessages()
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {content: data.message?.content ?? ''};
  }

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

    messages.push({role: 'system', content: buildSystemPrompt(this.config.request)});

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
    return new AnthropicProviderClient(config);
  }

  if (providerId === 'openai') {
    return new OpenAIProviderClient(config);
  }

  if (providerId === 'gemini') {
    return new GeminiProviderClient(config);
  }

  if (providerId === 'ollama') {
    return new OllamaProviderClient(config);
  }

  throw new Error(`Provider "${providerId}" is not implemented.`);
}

export function createProviderClient(
  providerId: ProviderId,
  config: ProviderConfig
): ProviderClient {
  return createStreamingAdapter(providerId, config) as ProviderClient;
}
