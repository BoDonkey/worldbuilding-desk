import type {ProjectAISettings} from '../../entityTypes';
import {describeError} from '../../services/errors';
import {LLMService} from '../../services/llm/LLMService';
import {describeRouteDataFlow, type ProviderRoute} from '../../services/llm/providerRoute';

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

/** Point-of-use data disclosure for the verified route; `sentMaterial` names what a hosted run sends. */
export function describeCharacterLabDataFlow(route: ProviderRoute, sentMaterial: string): string | null {
  const sentence = describeRouteDataFlow(route, sentMaterial);
  return route.kind === 'hosted' && sentence ? `${sentence} Manuscript prose is not sent.` : sentence;
}
