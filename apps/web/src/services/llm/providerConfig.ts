import type {AIProviderId} from '../../entityTypes';

export const DEFAULT_AI_PROVIDER: AIProviderId = 'ollama';

/** Providers that run on this computer: no API key, no hosted-data disclosure, no consultation charge. */
export const LOCAL_AI_PROVIDER_IDS = ['ollama', 'local-openai'] as const;
export type LocalAIProviderId = (typeof LOCAL_AI_PROVIDER_IDS)[number];
export type HostedAIProviderId = Exclude<AIProviderId, LocalAIProviderId>;

export function isLocalAIProvider(provider: AIProviderId | undefined | null): provider is LocalAIProviderId {
  return provider === 'ollama' || provider === 'local-openai';
}

export function isHostedAIProvider(provider: AIProviderId | undefined | null): provider is HostedAIProviderId {
  return Boolean(provider) && !isLocalAIProvider(provider);
}

/** Company names for hosted-provider data disclosures ("sends … to Anthropic's servers"). */
export const HOSTED_PROVIDER_NAMES: Readonly<Record<HostedAIProviderId, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google'
};

export const PROVIDER_FALLBACK_MODELS: Partial<Record<AIProviderId, string>> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash-lite'
};

export const PROVIDER_MODEL_PLACEHOLDERS: Record<AIProviderId, string> = {
  anthropic: 'e.g., claude-sonnet-4-20250514',
  openai: 'e.g., gpt-4o-mini',
  gemini: 'e.g., gemini-2.5-flash-lite',
  ollama: 'Leave blank to auto-detect an installed local model',
  'local-openai': 'Leave blank to use the model the server has loaded'
};

export const PROVIDER_DEFAULT_BASE_URLS: Partial<Record<AIProviderId, string>> = {
  ollama: 'http://localhost:11434',
  // KoboldCPP's default. LM Studio uses port 1234 and the llama.cpp server 8080.
  'local-openai': 'http://localhost:5001/v1'
};

export function normalizeConfiguredModel(model: string | undefined): string | undefined {
  const normalized = model?.trim();
  return normalized ? normalized : undefined;
}

/**
 * Bounds for the local model server's Maximum reply length (Slice 4.75). The
 * desktop main process checks the same ones.
 */
export const MIN_LOCAL_REPLY_TOKENS = 64;
export const MAX_LOCAL_REPLY_TOKENS = 131072;

/** A whole number within the bounds, else undefined (no setting). */
export function normalizeLocalMaxReplyTokens(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_LOCAL_REPLY_TOKENS &&
    value <= MAX_LOCAL_REPLY_TOKENS
    ? value
    : undefined;
}
