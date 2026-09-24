import type {AIProviderId} from '../../entityTypes';

export const HOSTED_RESPONSE_LIMIT_MESSAGE =
  "The provider stopped at this project's response limit, so no complete answer was used. Raise Max response tokens in Settings and try again.";

export const HOSTED_PRICE_TABLE_CHECKED_AT = '2026-09-24';
export const HOSTED_STRUCTURED_RESPONSE_MINIMUM = 1500;

interface HostedModelPrice {
  provider: Exclude<AIProviderId, 'ollama'>;
  model: string;
  outputUsdPerMillionTokens: number;
  source: string;
}

/** Exact model ids and stable aliases only. Unknown custom models must never inherit a guessed price. */
export const HOSTED_MODEL_PRICES: readonly HostedModelPrice[] = [
  {provider: 'anthropic', model: 'claude-sonnet-4-20250514', outputUsdPerMillionTokens: 15, source: 'https://platform.claude.com/docs/en/about-claude/pricing'},
  {provider: 'anthropic', model: 'claude-sonnet-4-5', outputUsdPerMillionTokens: 15, source: 'https://platform.claude.com/docs/en/about-claude/pricing'},
  {provider: 'anthropic', model: 'claude-sonnet-4-6', outputUsdPerMillionTokens: 15, source: 'https://platform.claude.com/docs/en/about-claude/pricing'},
  {provider: 'anthropic', model: 'claude-sonnet-5', outputUsdPerMillionTokens: 10, source: 'https://platform.claude.com/docs/en/about-claude/pricing'},
  {provider: 'anthropic', model: 'claude-haiku-4-5', outputUsdPerMillionTokens: 5, source: 'https://platform.claude.com/docs/en/about-claude/pricing'},
  {provider: 'openai', model: 'gpt-4o-mini', outputUsdPerMillionTokens: 0.6, source: 'https://developers.openai.com/api/docs/models/gpt-4o-mini'},
  {provider: 'openai', model: 'gpt-5', outputUsdPerMillionTokens: 10, source: 'https://developers.openai.com/api/docs/pricing'},
  {provider: 'openai', model: 'gpt-5-mini', outputUsdPerMillionTokens: 2, source: 'https://developers.openai.com/api/docs/pricing'},
  {provider: 'openai', model: 'gpt-5-nano', outputUsdPerMillionTokens: 0.4, source: 'https://developers.openai.com/api/docs/pricing'},
  {provider: 'gemini', model: 'gemini-2.5-pro', outputUsdPerMillionTokens: 10, source: 'https://ai.google.dev/gemini-api/docs/pricing'},
  {provider: 'gemini', model: 'gemini-2.5-flash', outputUsdPerMillionTokens: 2.5, source: 'https://ai.google.dev/gemini-api/docs/pricing'},
  {provider: 'gemini', model: 'gemini-2.5-flash-lite', outputUsdPerMillionTokens: 0.4, source: 'https://ai.google.dev/gemini-api/docs/pricing'}
] as const;

export interface HostedResponseCostCeiling {
  tokens: number;
  model: string;
  outputUsdPerMillionTokens?: number;
  maximumOutputUsd?: number;
  source?: string;
}

export function getHostedResponseCostCeiling(
  provider: AIProviderId,
  model: string,
  configuredTokens: number
): HostedResponseCostCeiling | null {
  if (provider === 'ollama') return null;
  const tokens = Math.max(configuredTokens, HOSTED_STRUCTURED_RESPONSE_MINIMUM);
  const price = HOSTED_MODEL_PRICES.find(
    (entry) => entry.provider === provider && entry.model === model.trim().toLowerCase()
  );
  if (!price) return {tokens, model};
  return {
    tokens,
    model,
    outputUsdPerMillionTokens: price.outputUsdPerMillionTokens,
    maximumOutputUsd: Math.ceil((tokens * price.outputUsdPerMillionTokens / 1_000_000) * 100) / 100,
    source: price.source
  };
}

export function formatHostedResponseCost(usd: number): string {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(usd);
}

export function assertHostedResponseComplete(
  provider: Exclude<AIProviderId, 'ollama'>,
  reason: unknown
): void {
  const normalized = typeof reason === 'string' ? reason.toLowerCase() : '';
  const capped =
    (provider === 'anthropic' && normalized === 'max_tokens') ||
    (provider === 'openai' && normalized === 'length') ||
    (provider === 'gemini' && normalized === 'max_tokens');
  if (capped) throw new Error(HOSTED_RESPONSE_LIMIT_MESSAGE);
}

export function openAIUsesReasoning(model: string): boolean {
  const normalized = model.toLowerCase();
  return /^(o\d|gpt-[5-9](?:\.|-|$))/.test(normalized);
}

export function geminiThinkingConfig(
  model: string,
  maxOutputTokens = Number.POSITIVE_INFINITY
): Record<string, unknown> | undefined {
  const normalized = model.toLowerCase();
  if (/^gemini-2\.5-pro(?:-|$)/.test(normalized)) {
    return maxOutputTokens > 128 ? {thinkingBudget: 128} : undefined;
  }
  if (/^gemini-2\.5-(?:flash|flash-lite)(?:-|$)/.test(normalized)) return {thinkingBudget: 0};
  if (/^gemini-[3-9](?:\.|-|$)/.test(normalized)) return {thinkingLevel: 'low'};
  return undefined;
}
