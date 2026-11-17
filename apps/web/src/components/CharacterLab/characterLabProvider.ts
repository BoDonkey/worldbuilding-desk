import {describeRouteDataFlow, type ProviderRoute} from '../../services/llm/providerRoute';

/** The provider issue the lab (and the surfaces built on its checks) shows with no provider set up. */
export const CHARACTER_LAB_NOT_CONFIGURED = 'AI provider is not configured. Add one in Settings to use the character lab.';

/** Point-of-use data disclosure for the verified route; `sentMaterial` names what a hosted run sends. */
export function describeCharacterLabDataFlow(route: ProviderRoute, sentMaterial: string): string | null {
  const sentence = describeRouteDataFlow(route, sentMaterial);
  return route.kind === 'hosted' && sentence ? `${sentence} Manuscript prose is not sent.` : sentence;
}
