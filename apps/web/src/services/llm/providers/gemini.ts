import type {AIProviderId} from '../../../entityTypes';
import type {LLMProvider, LLMRequest, LLMResponse, LLMContextChunk} from '../types';

interface GeminiProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export class GeminiProvider implements LLMProvider {
  id: AIProviderId = 'gemini';
  name = 'Gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: GeminiProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-2.0-flash';
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? this.model;
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body = {
      systemInstruction: {
        parts: [{text: this.buildSystemPrompt(request.context, request.systemPrompt)}]
      },
      contents: request.messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{text: message.content}]
        })),
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('') ?? '';

    return {content};
  }

  async *streamCompletion(request: LLMRequest): AsyncGenerator<string> {
    const response = await this.generateCompletion(request);
    if (response.content) {
      yield response.content;
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
