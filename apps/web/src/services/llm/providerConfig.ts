import type {AIProviderId} from '../../entityTypes';

export const DEFAULT_AI_PROVIDER: AIProviderId = 'ollama';

/** Company names for hosted-provider data disclosures ("sends … to Anthropic's servers"). */
export const HOSTED_PROVIDER_NAMES: Readonly<Record<Exclude<AIProviderId, 'ollama'>, string>> = {
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
  ollama: 'Leave blank to auto-detect an installed local model'
};

export const PROVIDER_DEFAULT_BASE_URLS: Partial<Record<AIProviderId, string>> = {
  ollama: 'http://localhost:11434'
};

export function normalizeConfiguredModel(model: string | undefined): string | undefined {
  const normalized = model?.trim();
  return normalized ? normalized : undefined;
}
