import type {LLMProvider, LLMRequest, LLMResponse} from '../types';

interface OllamaProviderConfig {
  baseUrl: string;
  model?: string;
}

export class OllamaProvider implements LLMProvider {
  id = 'ollama' as const;
  name = 'Ollama';
  private readonly baseUrl: string;
  private readonly model?: string;

  constructor(config: OllamaProviderConfig) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const payload = await this.buildPayload(request, false);
    const response = await fetch(`${this.getBaseUrl(request)}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: request.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.message?.content ?? '';
    return {content: message};
  }

  async *streamCompletion(request: LLMRequest): AsyncGenerator<string> {
    const payload = await this.buildPayload(request, true);
    const response = await fetch(`${this.getBaseUrl(request)}/api/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: request.signal
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
          const thinking = parsed.message?.thinking;
          if (thinking) {
            yield `<think>${thinking}</think>`;
          }
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

  private async buildPayload(request: LLMRequest, stream: boolean) {
    const model = await this.resolveModel(request);
    const options: Record<string, number> = {};
    if (typeof request.maxTokens === 'number') {
      options.num_predict = request.maxTokens;
    }
    if (typeof request.temperature === 'number') {
      options.temperature = request.temperature;
    }

    return {
      model,
      stream,
      ...(request.think !== undefined ? {think: request.think} : {}),
      ...(request.responseFormat === 'json' ? {format: 'json'} : {}),
      ...(Object.keys(options).length ? {options} : {}),
      messages: [
        ...(request.systemPrompt
          ? [{role: 'system' as const, content: request.systemPrompt}]
          : []),
        ...request.messages.map((m) => ({role: m.role, content: m.content}))
      ]
    };
  }

  private async resolveModel(request: LLMRequest): Promise<string> {
    const explicitModel = request.model?.trim() || this.model?.trim();
    if (explicitModel) {
      return explicitModel;
    }

    const response = await fetch(`${this.getBaseUrl(request)}/api/tags`, {
      signal: request.signal
    });
    if (!response.ok) {
      throw new Error(`Ollama model lookup failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const firstModel = Array.isArray(data.models)
      ? data.models.find(
          (entry: {name?: unknown}) =>
            typeof entry?.name === 'string' && entry.name.trim()
        )
      : null;

    if (!firstModel?.name) {
      throw new Error('No Ollama models are installed. Pull a model or enter one explicitly.');
    }

    return firstModel.name;
  }

  private getBaseUrl(request: LLMRequest) {
    return (request.baseUrl ?? this.baseUrl).replace(/\/$/, '');
  }
}
