import type {AIProviderId} from '../../../entityTypes';
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMContextChunk
} from '../types';

interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  streamingUrl?: string;
}

export class AnthropicProvider implements LLMProvider {
  id: AIProviderId = 'anthropic';
  name = 'Anthropic';
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private streamingUrl: string;

  constructor(config: AnthropicProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.baseUrl = config.baseUrl ?? 'http://localhost:3001/api/anthropic/complete';
    this.streamingUrl = config.streamingUrl ?? 'http://localhost:3001/api/anthropic/stream';
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt(
      request.context,
      request.systemPrompt
    );

    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: this.apiKey,
          request: {
            model: request.model ?? this.model,
            maxTokens: request.maxTokens || 4096,
            temperature: request.temperature || 0.7,
            systemPrompt,
            messages: request.messages.filter((m) => m.role !== 'system')
          }
        })
      });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          'Anthropic browser requests use the local proxy. Start `npx tsx proxy-server.ts` in `apps/web`, or use the Electron app.'
        );
      }
      throw error;
    }

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens
      }
    };
  }

  async *streamCompletion(request: LLMRequest): AsyncGenerator<string> {
    const systemPrompt = this.buildSystemPrompt(
      request.context,
      request.systemPrompt
    );

    const response = await fetch(this.streamingUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        apiKey: this.apiKey,
        request: {
          messages: request.messages.filter((m) => m.role !== 'system'),
          systemPrompt,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
          model: request.model ?? this.model
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk
        .split('\n')
        .filter((line) => line.trim().startsWith('data:'));

      for (const line of lines) {
        const data = line.replace(/^data: /, '');
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  private buildSystemPrompt(
    context?: LLMContextChunk[],
    basePrompt?: string
  ): string {
    let prompt =
      basePrompt ||
      'You are an AI assistant helping authors create LitRPG/GameLit content.';

    if (context && context.length > 0) {
      prompt += '\n\nRelevant context from the project:\n';
      context.forEach((chunk) => {
        prompt += `\n[Source: ${chunk.source}]\n${chunk.content}\n`;
      });
    }

    return prompt;
  }
}
