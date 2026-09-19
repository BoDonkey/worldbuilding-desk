import {z} from 'zod';
import type {
  WorldCanvasDocument,
  WorldCanvasLensKind,
  WorldEntity
} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import {LENS_DEFINITIONS} from './worldCanvasService';

/**
 * World Canvas brainstorming (Slice 4.33 / WC-4). The model proposes alternatives, tensions,
 * implications, and questions about the premise or one lens; the author keeps items one at a
 * time. Nothing the model returns is written anywhere until the author clicks a keep action.
 *
 * The prompt carries only authored canvas text and accepted canon *names* (World Bible records and
 * their aliases) — never Source Note text — under an explicit "exploratory, not canon" framing.
 */

export const BRAINSTORM_MAX_ITEMS = 12;
export const BRAINSTORM_MAX_ITEM_CHARS = 280;
/** Keeps the prompt small on large projects; names beyond this are summarized by count. */
export const BRAINSTORM_MAX_CANON_NAMES = 80;
const MAX_FOCUS_CHARS = 4000;
const MAX_OPEN_QUESTIONS = 20;
const MAX_EARLIER_ITEMS = 24;

export type WorldCanvasBrainstormItemKind = 'alternative' | 'tension' | 'implication' | 'question';

export const BRAINSTORM_ITEM_KIND_LABELS: Readonly<Record<WorldCanvasBrainstormItemKind, string>> = {
  alternative: 'Alternative',
  tension: 'Tension',
  implication: 'Implication',
  question: 'Question'
};

export type WorldCanvasBrainstormFocus =
  | {type: 'premise'}
  | {type: 'lens'; kind: WorldCanvasLensKind};

const brainstormResponseSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(['alternative', 'tension', 'implication', 'question']),
        text: z.string().trim().min(1).max(BRAINSTORM_MAX_ITEM_CHARS)
      })
    )
    .min(1)
    .max(BRAINSTORM_MAX_ITEMS)
});

export type WorldCanvasBrainstormResponse = z.infer<typeof brainstormResponseSchema>;
export type WorldCanvasBrainstormItem = WorldCanvasBrainstormResponse['items'][number];

export const BRAINSTORM_INVALID_RESPONSE_MESSAGE =
  'The model’s reply could not be read as a brainstorm list, so nothing was added. Try again, or try a different model.';

export class WorldCanvasBrainstormResponseError extends Error {
  constructor() {
    super(BRAINSTORM_INVALID_RESPONSE_MESSAGE);
    this.name = 'WorldCanvasBrainstormResponseError';
  }
}

export const describeBrainstormFocus = (focus: WorldCanvasBrainstormFocus): string =>
  focus.type === 'premise'
    ? 'Premise'
    : LENS_DEFINITIONS.find((definition) => definition.kind === focus.kind)?.label ?? focus.kind;

export const brainstormFocusKey = (focus: WorldCanvasBrainstormFocus): string =>
  focus.type === 'premise' ? 'premise' : `lens:${focus.kind}`;

/**
 * Accepted canon names: World Bible record names plus their aliases. Deduplicated
 * case-insensitively and sorted so the prompt is stable for the same canon.
 */
export function collectCanonNames(
  entities: Pick<WorldEntity, 'id' | 'name'>[],
  aliases: Pick<ConsistencyAlias, 'alias' | 'targetType' | 'targetId'>[] = []
): string[] {
  const entityIds = new Set(entities.map((entity) => entity.id));
  const names = new Map<string, string>();
  const add = (value: string) => {
    const name = value.trim();
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  };
  entities.forEach((entity) => add(entity.name));
  aliases
    .filter((alias) => alias.targetType === 'entity' && entityIds.has(alias.targetId))
    .forEach((alias) => add(alias.alias));
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

const clip = (text: string, limit: number) =>
  text.length > limit ? `${text.slice(0, limit)}…` : text;

export function buildWorldCanvasBrainstormPrompt(params: {
  canvas: Pick<WorldCanvasDocument, 'premise' | 'lenses' | 'questions'>;
  focus: WorldCanvasBrainstormFocus;
  canonNames: string[];
  /** Items already shown this session, so a repeat request asks for different ideas. */
  earlierItems?: string[];
}): {systemPrompt: string; userPrompt: string} {
  const {canvas, focus} = params;
  const focusLabel = describeBrainstormFocus(focus);
  const premise = canvas.premise.trim();
  const lens = focus.type === 'lens'
    ? canvas.lenses.find((candidate) => candidate.kind === focus.kind)
    : undefined;
  const lensDefinition = focus.type === 'lens'
    ? LENS_DEFINITIONS.find((definition) => definition.kind === focus.kind)
    : undefined;
  const openQuestions = canvas.questions
    .filter((question) => question.status === 'open')
    .filter((question) =>
      focus.type === 'premise' || !question.lensKind || question.lensKind === focus.kind
    )
    .map((question) => question.text.trim())
    .filter(Boolean)
    .slice(0, MAX_OPEN_QUESTIONS);
  const canonNames = params.canonNames.slice(0, BRAINSTORM_MAX_CANON_NAMES);
  const omittedNames = params.canonNames.length - canonNames.length;
  const earlierItems = (params.earlierItems ?? []).slice(-MAX_EARLIER_ITEMS);

  const systemPrompt = [
    'You help a fiction author explore their story world. You propose; the author decides.',
    'Everything the author gives you here is EXPLORATORY — NOT CANON. Do not treat it as established fact, and do not state new facts about the world.',
    'Offer alternatives, tensions, implications, and questions the author could consider. Phrase each as a possibility, never as a decision.',
    'The canon names list is only so you can refer to things by their existing names. It tells you nothing else about them; do not invent details about them.',
    `Reply with JSON only, no prose and no code fence, in exactly this shape: {"items":[{"kind":"alternative"|"tension"|"implication"|"question","text":"..."}]}.`,
    `Give between 4 and ${BRAINSTORM_MAX_ITEMS} items. Each text is one idea of at most ${BRAINSTORM_MAX_ITEM_CHARS} characters. Items of kind "question" are phrased as questions.`
  ].join('\n');

  const sections = [
    `Brainstorm focus: ${focusLabel}.`,
    '--- Exploratory material (not canon) ---',
    `Premise: ${premise ? clip(premise, MAX_FOCUS_CHARS) : '(not written yet)'}`
  ];
  if (focus.type === 'lens') {
    sections.push(
      `${focusLabel} lens prompt: ${lensDefinition?.prompt ?? ''}`,
      `${focusLabel} lens notes: ${lens?.note.trim() ? clip(lens.note.trim(), MAX_FOCUS_CHARS) : '(not written yet)'}`
    );
  }
  sections.push(
    openQuestions.length > 0
      ? `Open questions:\n${openQuestions.map((question) => `- ${question}`).join('\n')}`
      : 'Open questions: (none)',
    '--- Accepted canon names (names only) ---',
    canonNames.length > 0
      ? `${canonNames.join(', ')}${omittedNames > 0 ? ` (and ${omittedNames} more)` : ''}`
      : '(none yet)'
  );
  if (earlierItems.length > 0) {
    sections.push(
      '--- Ideas already offered this session (do not repeat these) ---',
      earlierItems.map((item) => `- ${item}`).join('\n')
    );
  }
  sections.push(
    focus.type === 'premise'
      ? 'Suggest alternatives, tensions, implications, and questions about the premise.'
      : `Suggest alternatives, tensions, implications, and questions for the ${focusLabel} lens, in light of the premise.`
  );

  return {systemPrompt, userPrompt: sections.join('\n\n')};
}

const extractJsonText = (content: string): string => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
};

/**
 * Validates the whole reply. An oversized list or an over-long item rejects the reply outright
 * rather than being trimmed, so the author never sees a silently edited model answer.
 */
export function parseWorldCanvasBrainstormResponse(content: string): WorldCanvasBrainstormItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(content));
  } catch {
    throw new WorldCanvasBrainstormResponseError();
  }
  const result = brainstormResponseSchema.safeParse(parsed);
  if (!result.success) throw new WorldCanvasBrainstormResponseError();
  return result.data.items;
}
