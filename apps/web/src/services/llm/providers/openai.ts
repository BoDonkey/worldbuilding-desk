import type {AIProviderId} from '../../../entityTypes';
import type {LLMProvider, LLMRequest, LLMResponse, LLMContextChunk} from '../types';

interface OpenAIProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIProvider implements LLMProvider {
  id: AIProviderId = 'openai';
  name = 'OpenAI';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: OpenAIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gpt-4o-mini';
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1/chat/completions';
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const payload = this.buildPayload(request, false);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens
          }
        : undefined
    };
  }

  async *streamCompletion(request: LLMRequest): AsyncGenerator<string> {
    const payload = this.buildPayload(request, true);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
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

  private buildPayload(request: LLMRequest, stream: boolean) {
    const systemPrompt = this.buildSystemPrompt(request.context, request.systemPrompt);
    const messages = this.buildMessages(systemPrompt, request.messages);

    return {
      model: request.model ?? this.model,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      stream,
      messages
    };
  }

  private buildMessages(systemPrompt: string | null, messages: LLMRequest['messages']): ChatMessage[] {
    const result: ChatMessage[] = [];

    if (systemPrompt) {
      result.push({role: 'system', content: systemPrompt});
    }

    for (const message of messages) {
      result.push({role: message.role, content: message.content});
    }

    return result;
  }

  private buildSystemPrompt(
    context?: LLMContextChunk[],
    basePrompt?: string
  ): string | null {
    let prompt =
      basePrompt ||
      'You are an AI assistant helping authors create LitRPG/GameLit content.';

    if (context && context.length > 0) {
      prompt += '\n\nRelevant context from the project:\n';
      context.forEach((chunk) => {
        prompt += `\n[Source: ${chunk.source}]\n${chunk.content}\n`;
      });
    }

    return prompt ?? null;
  }
}
