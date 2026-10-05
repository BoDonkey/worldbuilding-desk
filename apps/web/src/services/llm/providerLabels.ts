import type {AIProviderId} from '../../entityTypes';

/** Display names for AI providers in settings and records. */
export const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google Gemini',
  ollama: 'Ollama (Local)'
};
