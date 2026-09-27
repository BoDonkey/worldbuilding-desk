import type {ProjectAISettings} from '../../entityTypes';
import {describeError} from '../../services/errors';
import {LLMService} from '../../services/llm/LLMService';
import {HOSTED_PROVIDER_NAMES} from '../../services/llm/providerConfig';

const NOT_CONFIGURED = 'AI provider is not configured. Add one in Settings to use the character lab.';

/** Why the lab cannot run with this provider setup, or null when it can. */
export function getCharacterLabProviderIssue(aiConfig: ProjectAISettings | undefined): string | null {
  if (!aiConfig) return NOT_CONFIGURED;
  try {
    new LLMService(aiConfig);
    return null;
  } catch (providerError) {
    return describeError(providerError, NOT_CONFIGURED, {record: false});
  }
}

/** Point-of-use data disclosure; `sentMaterial` names what a hosted run sends. */
export function describeCharacterLabDataFlow(
  aiConfig: ProjectAISettings | undefined,
  sentMaterial: string
): string | null {
  const provider = aiConfig?.provider;
  if (provider === 'ollama') return 'Runs on your local Ollama model. Nothing leaves this computer.';
  if (!provider) return null;
  return `Sends ${sentMaterial} to ${HOSTED_PROVIDER_NAMES[provider]}’s servers only when you send. Manuscript prose is not sent.`;
}
