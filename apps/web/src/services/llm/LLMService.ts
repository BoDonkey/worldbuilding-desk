import type {LLMProvider, LLMRequest, LLMResponse} from './types';
import {AnthropicProvider} from './providers/anthropic';

export class LLMService {
  private provider: LLMProvider;

  constructor(apiKey: string, providerName: 'anthropic' = 'anthropic') {
    switch (providerName) {
      case 'anthropic':
        this.provider = new AnthropicProvider(apiKey);
        break;
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    return this.provider.generateCompletion(request);
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    if (!this.provider.streamCompletion) {
      throw new Error('Provider does not support streaming');
    }
    yield* this.provider.streamCompletion(request);
  }
}
