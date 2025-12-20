import type {LLMProvider, LLMRequest, LLMResponse, LLMContextChunk} from '../types';

export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic';
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt(request.context);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        system: systemPrompt,
        messages: request.messages.filter((m) => m.role !== 'system')
      })
    });

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
    const systemPrompt = this.buildSystemPrompt(request.context);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        system: systemPrompt,
        messages: request.messages.filter((m) => m.role !== 'system'),
        stream: true
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

  private buildSystemPrompt(context?: LLMContextChunk[]): string {
    let prompt =
      'You are an AI assistant helping authors create LitRPG/GameLit content. ';
    prompt +=
      'You understand RPG mechanics, world-building, and narrative structure. ';

    if (context && context.length > 0) {
      prompt += '\n\nRelevant context from the project:\n\n';
      context.forEach((chunk, i) => {
        prompt += `[${i + 1}] From ${chunk.source}:\n${chunk.content}\n\n`;
      });
      prompt +=
        'Use this context to maintain consistency with established lore and mechanics.';
    }

    return prompt;
  }
}
