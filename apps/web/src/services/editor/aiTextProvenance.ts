import type {AIProviderId, ProjectAISettings} from '../../entityTypes';
import type {ProviderRoute, ProviderRouteKind} from '../llm/providerRoute';

/** Which feature inserted model-written text into a scene. */
export type AITextOrigin = 'scene-revision' | 'character-scene' | 'scene-draft';

/**
 * Stored on the `aiText` mark. A record of what the app inserted, for the
 * author: not a detector, and never applied to text the author typed.
 */
export interface AITextProvenance {
  origin: AITextOrigin;
  provider: AIProviderId | 'unknown';
  model?: string;
  route: ProviderRouteKind;
  /** Epoch milliseconds when the text was inserted. */
  at: number;
}

export function buildAITextProvenance(
  origin: AITextOrigin,
  aiConfig: Pick<ProjectAISettings, 'provider' | 'configs'> | undefined | null,
  route: ProviderRoute,
  now: number = Date.now()
): AITextProvenance {
  const provider = aiConfig?.provider ?? 'unknown';
  const model =
    route.model ??
    (provider !== 'unknown' ? aiConfig?.configs?.[provider]?.model?.trim() || undefined : undefined);
  return {origin, provider, ...(model ? {model} : {}), route: route.kind, at: now};
}

// Zero-width characters and the word joiner are dropped; narrow and ordinary
// no-break spaces become plain spaces. They are not watermarks, but model
// output sometimes carries them, and they cause odd spacing and search misses.
const DROPPED_INVISIBLES = /[\u200B-\u200D\u2060\uFEFF]/g;
const SPACE_LOOKALIKES = /[\u00A0\u202F]/g;

/** Text hygiene for model output before it enters a scene. */
export function normalizeAIText(text: string): string {
  return text.replace(DROPPED_INVISIBLES, '').replace(SPACE_LOOKALIKES, ' ');
}
