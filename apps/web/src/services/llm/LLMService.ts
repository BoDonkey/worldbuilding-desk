import type {LLMProvider, LLMRequest, LLMResponse} from './types';
import {AnthropicProvider} from './providers/anthropic';

const FALLBACK_ID = () => Math.random().toString(36).slice(2);

export class LLMService {
  private provider: LLMProvider;
  private readonly apiKey: string;
  private readonly electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

  constructor(apiKey: string, providerName: 'anthropic' = 'anthropic') {
    this.apiKey = apiKey;

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
    if (this.electronAPI?.llmStream) {
      yield* this.streamViaElectron(request);
      return;
    }

    if (!this.provider.streamCompletion) {
      throw new Error('Provider does not support streaming');
    }
    yield* this.provider.streamCompletion(request);
  }

  private async *streamViaElectron(request: LLMRequest): AsyncGenerator<string> {
    const api = this.electronAPI;
    if (!api?.llmStream) {
      throw new Error('Electron bridge is unavailable');
    }

    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : FALLBACK_ID();

    const chunkQueue: string[] = [];
    let chunkIndex = 0;
    let done = false;
    let pendingResolver: (() => void) | null = null;
    let fatalError: Error | null = null;

    const wake = () => {
      pendingResolver?.();
      pendingResolver = null;
    };

    const unsubscribeChunk = api.onLLMChunk?.((payload) => {
      if (payload.requestId !== requestId) return;
      chunkQueue.push(payload.text);
      wake();
    });

    const unsubscribeComplete = api.onLLMComplete?.((payload) => {
      if (payload.requestId !== requestId) return;
      done = true;
      wake();
    });

    const unsubscribeError = api.onLLMError?.((payload) => {
      if (payload.requestId !== requestId) return;
      fatalError = new Error(payload.message);
      done = true;
      wake();
    });

    try {
      api
        .llmStream({apiKey: this.apiKey, request, requestId})
        .catch((error: unknown) => {
          fatalError =
            error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
          done = true;
          wake();
        });

      while (!done || chunkIndex < chunkQueue.length) {
        if (chunkIndex < chunkQueue.length) {
          yield chunkQueue[chunkIndex++];
          continue;
        }

        if (fatalError) {
          throw fatalError;
        }

        await new Promise<void>((resolve) => {
          pendingResolver = resolve;
        });
      }

      if (fatalError) {
        throw fatalError;
      }
    } finally {
      unsubscribeChunk?.();
      unsubscribeComplete?.();
      unsubscribeError?.();
    }
  }
}
