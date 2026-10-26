import type {AIProviderId, ProjectAISettings} from '../../entityTypes';
import {PROVIDER_DEFAULT_BASE_URLS} from './providerConfig';
import {isLoopbackUrl} from './providerRoute';
import {localServerApiBase, readLocalServerContextSize} from './localServer';

/**
 * How many tokens the configured model can take in one request (Slice 4.71),
 * for the context budget. Local servers are asked; hosted providers use their
 * smallest current context; anything unknown is assumed small.
 */
export interface ModelContextSize {
  tokens: number;
  /** `reported`: the running server said so. `assumed`: a default; the real size may be larger. */
  source: 'reported' | 'provider' | 'assumed';
}

export const HOSTED_CONTEXT_TOKENS: Readonly<Record<'anthropic' | 'openai' | 'gemini', number>> = {
  anthropic: 200_000,
  openai: 128_000,
  gemini: 1_000_000
};

/** Ollama's smallest default context; used when no model is loaded to ask about. */
export const OLLAMA_ASSUMED_CONTEXT_TOKENS = 4_096;
/** For a local server that does not report its size (LM Studio, for example). */
export const LOCAL_SERVER_ASSUMED_CONTEXT_TOKENS = 4_096;

const CACHE_MS = 30_000;
const cache = new Map<string, {at: number; size: Promise<ModelContextSize>}>();

/** For tests. */
export function clearModelContextSizeCache(): void {
  cache.clear();
}

const positive = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;

/** The loaded model's `context_length` from Ollama's `GET /api/ps`: the configured model, else the only one loaded. */
export function parseOllamaLoadedContext(data: unknown, model: string | undefined): number | undefined {
  const models = (data as {models?: unknown})?.models;
  if (!Array.isArray(models)) return undefined;
  const entries = models.filter(
    (entry): entry is {name?: unknown; model?: unknown; context_length?: unknown} => typeof entry === 'object' && entry !== null
  );
  const wanted = model?.trim();
  const match = wanted
    ? entries.find((entry) => entry.name === wanted || entry.model === wanted || entry.name === `${wanted}:latest`)
    : entries.length === 1
      ? entries[0]
      : undefined;
  return positive(match?.context_length);
}

async function readOllamaContext(baseUrl: string | undefined, model: string | undefined): Promise<ModelContextSize> {
  const url = (baseUrl?.trim() || PROVIDER_DEFAULT_BASE_URLS.ollama || 'http://localhost:11434').replace(/\/+$/, '');
  if (isLoopbackUrl(url)) {
    try {
      const response = await fetch(`${url}/api/ps`);
      const tokens = response.ok ? parseOllamaLoadedContext(await response.json(), model) : undefined;
      if (tokens) return {tokens, source: 'reported'};
    } catch {
      // Not running yet: fall through to the assumption.
    }
  }
  return {tokens: OLLAMA_ASSUMED_CONTEXT_TOKENS, source: 'assumed'};
}

async function readLocalServerContext(baseUrl: string | undefined): Promise<ModelContextSize> {
  try {
    const desktopProbe = typeof window !== 'undefined' ? window.electronAPI?.llmLocalContextSize : undefined;
    const tokens = desktopProbe
      ? await desktopProbe({baseUrl})
      : await readLocalServerContextSize(localServerApiBase(baseUrl));
    if (tokens) return {tokens, source: 'reported'};
  } catch {
    // Unreachable: the request itself will say so.
  }
  return {tokens: LOCAL_SERVER_ASSUMED_CONTEXT_TOKENS, source: 'assumed'};
}

export function resolveModelContextSize(
  aiConfig: Pick<ProjectAISettings, 'provider' | 'configs'> | null | undefined
): Promise<ModelContextSize> {
  const provider: AIProviderId = aiConfig?.provider ?? 'ollama';
  if (provider === 'anthropic' || provider === 'openai' || provider === 'gemini') {
    return Promise.resolve({tokens: HOSTED_CONTEXT_TOKENS[provider], source: 'provider'});
  }
  const config = aiConfig?.configs?.[provider];
  const key = `${provider}|${config?.baseUrl ?? ''}|${config?.model ?? ''}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.size;
  const size =
    provider === 'ollama' ? readOllamaContext(config?.baseUrl, config?.model) : readLocalServerContext(config?.baseUrl);
  cache.set(key, {at: Date.now(), size});
  return size;
}
