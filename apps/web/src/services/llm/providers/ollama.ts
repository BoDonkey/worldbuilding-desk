import type {LLMProvider, LLMRequest, LLMResponse} from '../types';

interface OllamaProviderConfig {
  baseUrl: string;
  model: string;
}

export class OllamaProvider implements LLMProvider {
  id = 'ollama' as const;
  name = 'Ollama';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: OllamaProviderConfig) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const payload = this.buildPayload(request, false);
    const response = await fetch(`${this.getBaseUrl(request)}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.message?.content ?? '';
    return {content: message};
  }

  async *streamCompletion(request: LLMRequest): AsyncGenerator<string> {
    const payload = this.buildPayload(request, true);
    const response = await fetch(`${this.getBaseUrl(request)}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, {stream: true});
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const text = parsed.message?.content;
          if (text) {
            yield text;
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }
  }

  private buildPayload(request: LLMRequest, stream: boolean) {
    return {
      model: request.model ?? this.model,
      stream,
      messages: request.messages.map((m) => ({role: m.role, content: m.content}))
    };
  }

  private getBaseUrl(request: LLMRequest) {
    return (request.baseUrl ?? this.baseUrl).replace(/\/$/, '');
  }
}
