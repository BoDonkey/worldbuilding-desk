export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama';

export const PROVIDER_IDS: readonly ProviderId[] = ['anthropic', 'openai', 'gemini', 'ollama'];

/** The only HTTPS origin each hosted provider may be reached at. */
const HOSTED_ORIGINS: Record<Exclude<ProviderId, 'ollama'>, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  gemini: 'https://generativelanguage.googleapis.com'
};

const DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  anthropic: HOSTED_ORIGINS.anthropic,
  openai: HOSTED_ORIGINS.openai,
  gemini: `${HOSTED_ORIGINS.gemini}/v1beta`,
  ollama: 'http://localhost:11434'
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * Resolves the base URL a provider request may use, or throws. Hosted
 * providers accept only HTTPS on their own origin, so a key can never be sent
 * anywhere else. Ollama, and an explicitly local OpenAI-compatible server,
 * accept only loopback hosts. URLs carrying credentials, a query, or a
 * fragment are rejected.
 */
export function resolveProviderBaseUrl(providerId: ProviderId, baseUrl?: string): string {
  if (baseUrl === undefined || baseUrl.trim() === '') {
    return DEFAULT_BASE_URLS[providerId];
  }

  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new Error(`Provider address "${baseUrl}" is not a valid URL.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Provider address must not include credentials, a query, or a fragment.');
  }

  const normalized = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  const loopback = isLoopbackHost(url.hostname);

  if (providerId === 'ollama') {
    if ((url.protocol === 'http:' || url.protocol === 'https:') && loopback) return normalized;
    throw new Error(
      'Ollama must run on this computer (localhost or 127.0.0.1); remote Ollama addresses are not allowed.'
    );
  }

  if (url.protocol === 'https:' && url.origin === HOSTED_ORIGINS[providerId]) {
    return normalized;
  }
  if (providerId === 'openai' && (url.protocol === 'http:' || url.protocol === 'https:') && loopback) {
    return normalized;
  }
  throw new Error(
    `This app only sends ${providerId} requests to ${HOSTED_ORIGINS[providerId]}.`
  );
}
