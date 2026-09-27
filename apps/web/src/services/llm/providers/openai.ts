import type {AIProviderId} from '../../../entityTypes';
import type {LLMProvider, LLMRequest, LLMResponse} from '../types';
import {PROVIDER_FALLBACK_MODELS} from '../providerConfig';
import {assertHostedResponseComplete, openAIUsesReasoning} from '../hostedResponsePolicy';
import {buildSystemPromptWithContext} from '../contextPrompt';

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
    this.model = config.model ?? PROVIDER_FALLBACK_MODELS.openai ?? 'gpt-4o-mini';
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
      body: JSON.stringify(payload),
      signal: request.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    assertHostedResponseComplete('openai', choice?.finish_reason);

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
      body: JSON.stringify(payload),
      signal: request.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
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

  private buildPayload(request: LLMRequest, stream: boolean) {
    const systemPrompt = buildSystemPromptWithContext(request.context, request.systemPrompt);
    const messages = this.buildMessages(systemPrompt, request.messages);

    const model = request.model ?? this.model;
    const reasoning = openAIUsesReasoning(model);
    return {
      model,
      ...(!reasoning ? {temperature: request.temperature ?? 0.7} : {}),
      max_completion_tokens: request.maxTokens ?? 4096,
      ...(reasoning ? {reasoning_effort: 'low'} : {}),
      stream,
      ...(request.responseFormat === 'json'
        ? {response_format: {type: 'json_object'}}
        : {}),
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

}
