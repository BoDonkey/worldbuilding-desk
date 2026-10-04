import {PROVIDER_DEFAULT_BASE_URLS} from './providerConfig';
import {isLoopbackUrl, parseOllamaTags, type OllamaModelEntry} from './providerRoute';

const CACHE_MS = 30_000;
const cache = new Map<string, {at: number; models: Promise<OllamaModelEntry[] | null>}>();

const normalizeBaseUrl = (baseUrl?: string) =>
  (baseUrl?.trim() || PROVIDER_DEFAULT_BASE_URLS.ollama || 'http://localhost:11434').replace(/\/+$/, '');

/**
 * The installed Ollama models at a loopback address, or null when Ollama did
 * not answer (or the address is not loopback, which is never queried).
 * Shared and briefly cached so the surfaces mounted together ask once.
 */
export function getInstalledOllamaModels(
  baseUrl?: string,
  options: {force?: boolean} = {}
): Promise<OllamaModelEntry[] | null> {
  const url = normalizeBaseUrl(baseUrl);
  if (!isLoopbackUrl(url)) return Promise.resolve(null);
  const cached = cache.get(url);
  if (!options.force && cached && Date.now() - cached.at < CACHE_MS) return cached.models;
  const models = fetch(`${url}/api/tags`)
    .then(async (response) => (response.ok ? parseOllamaTags(await response.json()) : null))
    .catch(() => null);
  cache.set(url, {at: Date.now(), models});
  return models;
}

/** For tests. */
export function clearInstalledOllamaModelsCache(): void {
  cache.clear();
}
