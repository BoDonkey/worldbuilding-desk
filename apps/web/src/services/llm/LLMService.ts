import type {ProjectAISettings, AIProviderId} from '../../entityTypes';
import type {LLMProvider, LLMRequest, LLMResponse} from './types';
import {AnthropicProvider} from './providers/anthropic';
import {OpenAIProvider} from './providers/openai';
import {OllamaProvider} from './providers/ollama';
import {GeminiProvider} from './providers/gemini';
import {llmCache} from './LLMCache';
import {
  PROVIDER_DEFAULT_BASE_URLS,
  PROVIDER_FALLBACK_MODELS
} from './providerConfig';

const FALLBACK_ID = () => Math.random().toString(36).slice(2);

type ProviderCredentials =
  | {
      id: 'anthropic';
      apiKey: string;
      model?: string;
    }
  | {
      id: 'openai';
      apiKey: string;
      model?: string;
    }
  | {
      id: 'gemini';
      apiKey: string;
      model?: string;
    }
  | {
      id: 'ollama';
      baseUrl?: string;
      model?: string;
    };

export class LLMService {
  private provider: LLMProvider;
  private readonly providerId: AIProviderId;
  private readonly providerApiKey?: string;
  private readonly providerModel?: string;
  private readonly providerBaseUrl?: string;
  private readonly electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

  constructor(settings?: ProjectAISettings | null) {
    const credentials = this.resolveProviderCredentials(settings ?? undefined);
    this.providerId = credentials.id;
    if ('apiKey' in credentials) {
      this.providerApiKey = credentials.apiKey;
    }
    if ('model' in credentials) {
      this.providerModel = credentials.model;
    }
    if ('baseUrl' in credentials) {
      this.providerBaseUrl = credentials.baseUrl;
    }
    this.provider = this.instantiateProvider(credentials);
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const normalizedRequest = this.applyProviderDefaults(request);
    const cacheKey = this.buildCacheKey(normalizedRequest);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      return {content: cached};
    }

    const response = await this.getCompletion(normalizedRequest);
    if (response.content) {
      llmCache.set(cacheKey, response.content);
    }
    return response;
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    const normalizedRequest = this.applyProviderDefaults(request);
    const cacheKey = this.buildCacheKey(normalizedRequest);
    const cached = llmCache.get(cacheKey);
    if (cached) {
      yield cached;
      return;
    }

    const buffer: string[] = [];
    for await (const chunk of this.getStreamingIterator(normalizedRequest)) {
      buffer.push(chunk);
      yield chunk;
    }

    if (buffer.length) {
      llmCache.set(cacheKey, buffer.join(''));
    }
  }

  private instantiateProvider(credentials: ProviderCredentials): LLMProvider {
    switch (credentials.id) {
      case 'anthropic':
        return new AnthropicProvider({
          apiKey: credentials.apiKey,
          model: credentials.model ?? PROVIDER_FALLBACK_MODELS.anthropic
        });
      case 'openai':
        return new OpenAIProvider({
          apiKey: credentials.apiKey,
          model: credentials.model ?? PROVIDER_FALLBACK_MODELS.openai
        });
      case 'gemini':
        return new GeminiProvider({
          apiKey: credentials.apiKey,
          model: credentials.model ?? PROVIDER_FALLBACK_MODELS.gemini
        });
      case 'ollama':
        return new OllamaProvider({
          baseUrl: credentials.baseUrl ?? PROVIDER_DEFAULT_BASE_URLS.ollama ?? 'http://localhost:11434',
          model: credentials.model
        });
    }

    throw new Error('Provider is not implemented.');
  }

  private resolveProviderCredentials(settings?: ProjectAISettings): ProviderCredentials {
    const providerId: AIProviderId = settings?.provider ?? 'anthropic';

    switch (providerId) {
      case 'anthropic': {
        const apiKey =
          settings?.configs?.anthropic?.apiKey ?? this.readStoredKey('anthropic_api_key');

        if (!apiKey) {
          throw new Error('Anthropic API key is missing. Please add it in Settings.');
        }

        return {
          id: 'anthropic',
          apiKey,
          model: settings?.configs?.anthropic?.model ?? PROVIDER_FALLBACK_MODELS.anthropic
        };
      }
      case 'openai': {
        const apiKey =
          settings?.configs?.openai?.apiKey ?? this.readStoredKey('openai_api_key');

        if (!apiKey) {
          throw new Error('OpenAI API key is missing. Please add it in Settings.');
        }

        return {
          id: 'openai',
          apiKey,
          model: settings?.configs?.openai?.model ?? PROVIDER_FALLBACK_MODELS.openai
        };
      }
      case 'gemini': {
        const apiKey =
          settings?.configs?.gemini?.apiKey ?? this.readStoredKey('gemini_api_key');

        if (!apiKey) {
          throw new Error('Gemini API key is missing. Please add it in Settings.');
        }

        return {
          id: 'gemini',
          apiKey,
          model: settings?.configs?.gemini?.model ?? PROVIDER_FALLBACK_MODELS.gemini
        };
      }
      case 'ollama': {
        return {
          id: 'ollama',
          baseUrl: settings?.configs?.ollama?.baseUrl ?? PROVIDER_DEFAULT_BASE_URLS.ollama ?? 'http://localhost:11434',
          model: settings?.configs?.ollama?.model
        };
      }
      default:
        throw new Error(`Provider "${providerId}" is not supported yet.`);
    }
  }

  private readStoredKey(key: string): string | undefined {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return undefined;
    }

    const value = window.localStorage.getItem(key);
    return value ?? undefined;
  }

  private applyProviderDefaults(request: LLMRequest): LLMRequest {
    return {
      ...request,
      model: request.model ?? this.providerModel,
      baseUrl: request.baseUrl ?? this.providerBaseUrl
    };
  }

  private getStreamingIterator(request: LLMRequest): AsyncGenerator<string> {
    if (this.providerId === 'gemini' && this.provider.streamCompletion) {
      return this.provider.streamCompletion(request);
    }

    if (
      this.electronAPI?.llmStream &&
      this.electronAPI?.onLLMChunk &&
      this.electronAPI?.onLLMComplete &&
      this.electronAPI?.onLLMError
    ) {
      return this.streamViaElectron(request);
    }

    if (!this.provider.streamCompletion) {
      throw new Error('Provider does not support streaming');
    }

    return this.provider.streamCompletion(request);
  }

  private async getCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (this.providerId !== 'gemini' && this.electronAPI?.llmComplete) {
      return {content: await this.completeViaElectron(request)};
    }

    return this.provider.generateCompletion(request);
  }

  private buildCacheKey(request: LLMRequest): string {
    const payload = {
      provider: this.providerId,
      model: request.model,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      responseFormat: request.responseFormat,
      think: request.think,
      systemPrompt: request.systemPrompt,
      baseUrl: request.baseUrl,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      context: request.context?.map((chunk) => ({
        source: chunk.source,
        content: chunk.content,
        relevance: chunk.relevance
      }))
    };

    return llmCache.serialize(this.providerId, payload);
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
    const abortStream = () => {
      fatalError = new DOMException('The operation was aborted.', 'AbortError');
      done = true;
      wake();
    };

    if (request.signal?.aborted) {
      abortStream();
    }
    request.signal?.addEventListener('abort', abortStream, {once: true});

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
        .llmStream({
          providerId: this.providerId,
          apiKey: this.providerApiKey,
          request: this.buildElectronRequest(request),
          providerConfig: {
            baseUrl: request.baseUrl
          },
          requestId
        })
        .catch((error: unknown) => {
          fatalError =
            error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
          done = true;
          wake();
        });

      while (!done || chunkIndex < chunkQueue.length) {
        if (chunkIndex < chunkQueue.length) {
          yield chunkQueue[chunkIndex++] as string;
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
      request.signal?.removeEventListener('abort', abortStream);
      unsubscribeChunk?.();
      unsubscribeComplete?.();
      unsubscribeError?.();
    }
  }

  private async completeViaElectron(request: LLMRequest): Promise<string> {
    const api = this.electronAPI;
    if (!api?.llmComplete) {
      throw new Error('Electron bridge is unavailable');
    }

    if (request.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const completion = api.llmComplete({
      providerId: this.providerId,
      apiKey: this.providerApiKey,
      request: this.buildElectronRequest(request),
      providerConfig: {
        baseUrl: request.baseUrl
      }
    });

    if (!request.signal) {
      return completion;
    }

    return new Promise<string>((resolve, reject) => {
      const abort = () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      };

      request.signal?.addEventListener('abort', abort, {once: true});
      completion.then(resolve, reject).finally(() => {
        request.signal?.removeEventListener('abort', abort);
      });
    });
  }

  private buildElectronRequest(request: LLMRequest) {
    const {baseUrl: _baseUrl, signal: _signal, ...payload} = request;
    return payload;
  }
}
