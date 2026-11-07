import type {ProjectAISettings} from '../../entityTypes';
import type {ConsultationFeature} from '../editor/inspectorBudgetService';

/**
 * Per-project AI switches (Slice 5.18). An author can write with no AI at all, or take AI
 * feedback without AI-written prose.
 *
 * - `coaching`: AI that reads and responds and never puts text into the manuscript.
 * - `prose`: every path that puts model-written text into the manuscript.
 *
 * Both are off until the author turns them on. When a switch is off its surfaces are hidden,
 * and `LLMService` refuses any request tagged with one of its features, so a surface the UI
 * missed still cannot send.
 */
export type AISwitch = 'coaching' | 'prose';

export interface AISwitches {
  coaching: boolean;
  prose: boolean;
}

/**
 * Every consultation feature belongs to exactly one switch. A `Record` keyed by the feature
 * union makes a new feature without an assignment a type error; `aiSwitches.test.ts` checks
 * the same at run time.
 */
export const FEATURE_SWITCH: Record<ConsultationFeature, AISwitch> = {
  assistant: 'coaching',
  'writing-coach': 'coaching',
  'progression-continuity': 'coaching',
  'workspace-context': 'coaching',
  'canon-decision': 'coaching',
  'canvas-brainstorm': 'coaching',
  'canvas-coach': 'coaching',
  'canon-check': 'coaching',
  'character-lab': 'coaching',
  'scene-revision': 'prose',
  'scene-draft': 'prose',
  'character-scene': 'prose'
};

/** The provider connection test sends no story text, so no switch gates it. */
export type AIRequestFeature = ConsultationFeature | 'connection-test';

export const AI_SWITCH_LABELS: Record<AISwitch, string> = {
  coaching: 'AI coaching',
  prose: 'AI prose'
};

/** Shown where a surface's switch is off but the surface was reached anyway (an old link). */
export const OFF_COACHING_NOTE = 'AI coaching is off for this project. Turn it on in Settings → AI Settings.';
export const OFF_PROSE_NOTE = 'AI prose is off for this project. Turn it on in Settings → AI Settings.';

export const readAISwitches = (
  settings: Pick<ProjectAISettings, 'aiCoaching' | 'aiProse'> | null | undefined
): AISwitches => ({
  coaching: settings?.aiCoaching === true,
  prose: settings?.aiProse === true
});

export const anyAISwitchOn = (switches: AISwitches): boolean => switches.coaching || switches.prose;

export const switchForFeature = (feature: ConsultationFeature): AISwitch => FEATURE_SWITCH[feature];

/** Why a request for `feature` may not be sent, or null when its switch is on. */
export function aiSwitchRefusal(
  settings: Pick<ProjectAISettings, 'aiCoaching' | 'aiProse'> | null | undefined,
  feature: AIRequestFeature | undefined
): string | null {
  if (feature === 'connection-test') return null;
  if (!feature) return 'This AI request was not tagged with a feature, so it was not sent.';
  const owner = FEATURE_SWITCH[feature];
  if (!owner) return 'This AI request was not tagged with a known feature, so it was not sent.';
  if (readAISwitches(settings)[owner]) return null;
  return `${AI_SWITCH_LABELS[owner]} is off for this project. Turn it on in Settings → AI Settings.`;
}

export class AISwitchOffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AISwitchOffError';
  }
}
