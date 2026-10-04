import type {ProjectAISettings, AIProviderId} from '../../entityTypes';
import type {LLMProvider, LLMRequest, LLMResponse} from './types';
import {AnthropicProvider} from './providers/anthropic';
import {OpenAIProvider} from './providers/openai';
import {OllamaProvider} from './providers/ollama';
import {GeminiProvider} from './providers/gemini';
import {llmCache} from './LLMCache';
import {
  DEFAULT_AI_PROVIDER,
  PROVIDER_DEFAULT_BASE_URLS,
  PROVIDER_FALLBACK_MODELS
} from './providerConfig';
import {foldContextIntoSystemPrompt} from './contextPrompt';
import {
  getCachedProviderKeyStatus,
  readBrowserProviderKey,
  usesDesktopKeyVault,
  type HostedProviderId
} from './providerKeyStore';

const FALLBACK_ID = () => Math.random().toString(36).slice(2);

const HOSTED_PROVIDER_LABELS: Record<HostedProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini'
};

/** `apiKey` is absent in the desktop app, where the main process attaches it. */
type ProviderCredentials =
  | {
      id: 'anthropic';
      apiKey?: string;
      model?: string;
    }
  | {
      id: 'openai';
      apiKey?: string;
      model?: string;
    }
  | {
      id: 'gemini';
      apiKey?: string;
      model?: string;
    }
  | {
      id: 'ollama';
      baseUrl?: string;
      model?: string;
    };

export class LLMService {
  /** Renderer-side provider, used only when there is no desktop bridge. */
  private provider: LLMProvider | null;
  private readonly providerId: AIProviderId;
  private readonly providerModel?: string;
  private readonly providerBaseUrl?: string;
  private readonly electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

  constructor(settings?: ProjectAISettings | null) {
    const credentials = this.resolveProviderCredentials(settings ?? undefined);
    this.providerId = credentials.id;
    if ('model' in credentials) {
      this.providerModel = credentials.model;
    }
    if ('baseUrl' in credentials) {
      this.providerBaseUrl = credentials.baseUrl;
    }
    this.provider = this.usesDesktopBridge() ? null : this.instantiateProvider(credentials);
  }

  /** In the desktop app every provider call goes through the main process. */
  private usesDesktopBridge(): boolean {
    return Boolean(this.electronAPI?.llmComplete && usesDesktopKeyVault());
  }

  private rendererProvider(): LLMProvider {
    if (!this.provider) throw new Error('Provider runs in the desktop app process.');
    return this.provider;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const normalizedRequest = this.applyProviderDefaults(request);
    const useCache = request.cache !== false;
    const cacheKey = this.buildCacheKey(normalizedRequest);
    const cached = useCache ? llmCache.get(cacheKey) : undefined;
    if (cached) {
      return {content: cached};
    }

    const response = await this.getCompletion(normalizedRequest);
    if (useCache && response.content) {
      llmCache.set(cacheKey, response.content);
    }
    return response;
  }

  async *stream(request: LLMRequest): AsyncGenerator<string> {
    const normalizedRequest = this.applyProviderDefaults(request);
    const useCache = request.cache !== false;
    const cacheKey = this.buildCacheKey(normalizedRequest);
    const cached = useCache ? llmCache.get(cacheKey) : undefined;
    if (cached) {
      yield cached;
      return;
    }

    const buffer: string[] = [];
    for await (const chunk of this.getStreamingIterator(normalizedRequest)) {
      buffer.push(chunk);
      yield chunk;
    }

    if (useCache && buffer.length) {
      llmCache.set(cacheKey, buffer.join(''));
    }
  }

  private instantiateProvider(credentials: ProviderCredentials): LLMProvider {
    switch (credentials.id) {
      case 'anthropic':
        return new AnthropicProvider({
          apiKey: credentials.apiKey ?? '',
          model: credentials.model ?? PROVIDER_FALLBACK_MODELS.anthropic
        });
      case 'openai':
        return new OpenAIProvider({
          apiKey: credentials.apiKey ?? '',
          model: credentials.model ?? PROVIDER_FALLBACK_MODELS.openai
        });
      case 'gemini':
        return new GeminiProvider({
          apiKey: credentials.apiKey ?? '',
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
    const providerId: AIProviderId = settings?.provider ?? DEFAULT_AI_PROVIDER;

    switch (providerId) {
      case 'anthropic':
      case 'openai':
      case 'gemini':
        return {
          id: providerId,
          apiKey: this.resolveHostedKey(providerId, settings?.configs?.[providerId]?.apiKey),
          model: settings?.configs?.[providerId]?.model ?? PROVIDER_FALLBACK_MODELS[providerId]
        };
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

  /**
   * Desktop app: the key stays in the main process, so this only fails fast
   * when the last known status says no key is saved. Browser build: the key
   * comes from settings (connection test) or the browser key store.
   */
  private resolveHostedKey(provider: HostedProviderId, explicitKey?: string): string | undefined {
    const missing = new Error(
      `${HOSTED_PROVIDER_LABELS[provider]} API key is missing. Please add it in Settings.`
    );
    if (this.usesDesktopBridge()) {
      if (getCachedProviderKeyStatus()?.[provider] === false) throw missing;
      return undefined;
    }
    const key = explicitKey ?? readBrowserProviderKey(provider);
    if (!key) throw missing;
    return key;
  }

  private applyProviderDefaults(request: LLMRequest): LLMRequest {
    return {
      ...request,
      model: request.model ?? this.providerModel,
      baseUrl: request.baseUrl ?? this.providerBaseUrl
    };
  }

  private getStreamingIterator(request: LLMRequest): AsyncGenerator<string> {
    if (
      this.usesDesktopBridge() &&
      this.electronAPI?.llmStream &&
      this.electronAPI?.onLLMChunk &&
      this.electronAPI?.onLLMComplete &&
      this.electronAPI?.onLLMError
    ) {
      return this.streamViaElectron(request);
    }

    const provider = this.rendererProvider();
    if (!provider.streamCompletion) {
      throw new Error('Provider does not support streaming');
    }

    return provider.streamCompletion(request);
  }

  private async getCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (this.usesDesktopBridge()) {
      return {content: await this.completeViaElectron(request)};
    }

    return this.rendererProvider().generateCompletion(request);
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
      // Stop the provider request too, not just this listener: a local model would otherwise
      // keep generating after the author pressed Stop.
      void api.llmCancelStream?.(requestId);
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
    // The desktop main process sends only the system prompt and messages, so context travels
    // inside the system prompt, rendered exactly as the renderer providers render it.
    const payload = foldContextIntoSystemPrompt({...request});
    delete payload.baseUrl;
    delete payload.signal;
    return payload;
  }
}
