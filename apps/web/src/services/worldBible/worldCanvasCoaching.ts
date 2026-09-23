import {z} from 'zod';
import type {
  AIProviderId,
  WorldCanvasDocument,
  WorldCanvasLensKind
} from '../../entityTypes';
import type {ConsistencyAlias} from '../consistency/aliasStorage';
import type {CraftSearchResult} from '../craft/types';
import {
  addOpenThread,
  getActiveSketch,
  LENS_DEFINITIONS,
  updateSketchText
} from './worldCanvasService';

export type WorldCanvasCoachingAction =
  | 'focus'
  | 'deeper-question'
  | 'central-tension'
  | 'clearer-wording';

export type WorldCanvasCoachingFocus =
  | {type: 'premise'}
  | {type: 'lens'; kind: WorldCanvasLensKind};

export interface SelectedCanvasReference {
  id: string;
  sourceType: 'world-bible' | 'source-note';
  label: string;
}

export const CANVAS_COACHING_ACTION_LABELS: Readonly<Record<WorldCanvasCoachingAction, string>> = {
  focus: 'Help me focus this',
  'deeper-question': 'Ask a deeper question',
  'central-tension': 'Show the central tension',
  'clearer-wording': 'Suggest clearer wording'
};

const ACTION_SEARCH_TERMS: Readonly<Record<WorldCanvasCoachingAction, string>> = {
  focus: 'premise controlling idea focus story design worldbuilding',
  'deeper-question': 'questions for the author implications worldbuilding design',
  'central-tension': 'central tension conflict pressure stakes contradiction',
  'clearer-wording': 'clarity premise controlling idea concise wording'
};

const ACTION_INSTRUCTIONS: Readonly<Record<WorldCanvasCoachingAction, string>> = {
  focus: 'Clarify the most generative focus in this exploratory idea and propose a tighter replacement.',
  'deeper-question': 'Teach one applicable craft pattern and propose one deeper question to keep as an Open Thread.',
  'central-tension': 'Identify a possible central tension without declaring it true, then propose it as an Open Thread.',
  'clearer-wording': 'Preserve the author’s meaning while proposing clearer, more concise replacement wording.'
};

const EXPECTED_PROPOSAL_KIND: Readonly<Record<WorldCanvasCoachingAction, WorldCanvasCoachingProposal['kind']>> = {
  focus: 'replacement',
  'deeper-question': 'open-thread',
  'central-tension': 'open-thread',
  'clearer-wording': 'replacement'
};

const CANVAS_CRAFT_TAGS = new Set([
  'worldbuilding',
  'worldbuilding-practice',
  'setting',
  'premise',
  'theme',
  'conflict',
  'tension',
  'stakes',
  'systemic-consequences',
  'social-structure',
  'constraint',
  'clarity',
  'foundational'
]);

const responseSchema = z.object({
  observations: z.array(z.object({
    pattern: z.string().trim().min(1).max(120),
    application: z.string().trim().min(1).max(700)
  })).min(1).max(3),
  proposal: z.object({
    kind: z.enum(['replacement', 'open-thread']),
    text: z.string().trim().min(1).max(2000)
  })
});

export type WorldCanvasCoachingResponse = z.infer<typeof responseSchema>;
export type WorldCanvasCoachingProposal = WorldCanvasCoachingResponse['proposal'];

export const CANVAS_COACHING_INVALID_RESPONSE_MESSAGE =
  'The coach’s reply could not be validated, so nothing was proposed. Try again, or try a different model.';
export const CANVAS_COACHING_STOPPED_MESSAGE =
  'Stopped before the coach finished, so nothing was proposed.';
export const CANVAS_COACHING_MIN_RESPONSE_TOKENS = 1200;

export class WorldCanvasCoachingResponseError extends Error {
  readonly reply: string;

  constructor(reply: string) {
    super(CANVAS_COACHING_INVALID_RESPONSE_MESSAGE);
    this.name = 'WorldCanvasCoachingResponseError';
    this.reply = reply;
  }
}

const focusLabel = (focus: WorldCanvasCoachingFocus) => focus.type === 'premise'
  ? 'Core Idea'
  : LENS_DEFINITIONS.find((lens) => lens.kind === focus.kind)?.label ?? focus.kind;

export function getWorldCanvasCoachingFocusText(
  canvas: WorldCanvasDocument,
  focus: WorldCanvasCoachingFocus
): string {
  if (focus.type === 'premise') return canvas.premise;
  const lens = canvas.lenses.find((candidate) => candidate.kind === focus.kind);
  return lens ? getActiveSketch(lens).text : '';
}

export function buildWorldCanvasCraftSearchQuery(params: {
  action: WorldCanvasCoachingAction;
  focus: WorldCanvasCoachingFocus;
  focusText: string;
}): string {
  const text = params.focusText.trim().slice(0, 500);
  return `${ACTION_SEARCH_TERMS[params.action]} ${focusLabel(params.focus)} ${text}`.trim();
}

export function selectApplicableCanvasCraftResults(
  results: CraftSearchResult[],
  limit = 4
): CraftSearchResult[] {
  return results.filter((result) => {
    const {metadata} = result.chunk;
    return metadata.authorVetted === true && (
      metadata.scopes.some((scope) => ['manuscript', 'series', 'practice'].includes(scope)) ||
      metadata.tags.some((tag) => CANVAS_CRAFT_TAGS.has(tag))
    );
  }).slice(0, Math.max(0, limit));
}

export function buildSelectedCanvasReferenceLines(
  references: SelectedCanvasReference[],
  aliases: Pick<ConsistencyAlias, 'alias' | 'targetType' | 'targetId'>[]
): string[] {
  return references.map((reference) => {
    if (reference.sourceType === 'source-note') {
      return `Source Note title only: ${reference.label}`;
    }
    const recordAliases = aliases
      .filter((alias) => alias.targetType === 'entity' && alias.targetId === reference.id)
      .map((alias) => alias.alias.trim())
      .filter(Boolean);
    return `Accepted canon name${recordAliases.length ? ' and aliases' : ''}: ${[
      reference.label,
      ...recordAliases
    ].join(', ')}`;
  });
}

export function buildWorldCanvasCoachingPrompt(params: {
  action: WorldCanvasCoachingAction;
  focus: WorldCanvasCoachingFocus;
  focusText: string;
  selectedReferenceLines: string[];
}): {systemPrompt: string; userPrompt: string} {
  const expectedKind = EXPECTED_PROPOSAL_KIND[params.action];
  const systemPrompt = [
    'You are a craft-grounded coach helping a fiction author explore a World Canvas.',
    'The focused Canvas text is exploratory and NOT CANON. You propose; the author decides.',
    'Craft reference context is instructional material, never the author’s canon or evidence about their manuscript.',
    'Selected project references are separately labeled names, aliases, or Source Note titles only. Do not infer facts from a name or title.',
    'Never claim to have read or judged manuscript prose. No manuscript prose is provided.',
    'Teach only craft patterns that genuinely apply to the focused text. Phrase story implications as possibilities, not truths.',
    `Reply with JSON only in this shape: {"observations":[{"pattern":"...","application":"..."}],"proposal":{"kind":"${expectedKind}","text":"..."}}.`,
    'Give one to three concise observations. The proposal is advisory and will not be applied without author confirmation.'
  ].join('\n');
  const references = params.selectedReferenceLines.length
    ? params.selectedReferenceLines.map((line) => `- ${line}`).join('\n')
    : '(none selected)';
  const userPrompt = [
    `Action: ${CANVAS_COACHING_ACTION_LABELS[params.action]}`,
    `Instruction: ${ACTION_INSTRUCTIONS[params.action]}`,
    `Focus: ${focusLabel(params.focus)}`,
    '--- Focused Canvas text (exploratory, not canon) ---',
    params.focusText.trim(),
    '--- Author-selected project references ---',
    references,
    'Use the separately supplied craft reference context as instruction. Do not treat project references as craft citations.'
  ].join('\n\n');
  return {systemPrompt, userPrompt};
}

const extractJsonText = (content: string): string => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
};

export function parseWorldCanvasCoachingResponse(
  content: string,
  action: WorldCanvasCoachingAction
): WorldCanvasCoachingResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(content));
  } catch {
    throw new WorldCanvasCoachingResponseError(content);
  }
  const result = responseSchema.safeParse(parsed);
  if (!result.success || result.data.proposal.kind !== EXPECTED_PROPOSAL_KIND[action]) {
    throw new WorldCanvasCoachingResponseError(content);
  }
  return result.data;
}

export function canvasCoachingResponseTokens(
  provider: AIProviderId | undefined,
  configured: number | undefined
): number | undefined {
  return provider === 'ollama'
    ? undefined
    : Math.max(configured ?? 0, CANVAS_COACHING_MIN_RESPONSE_TOKENS);
}

/** App-owned proposal application. Call only after explicit author confirmation. */
export function applyWorldCanvasCoachingProposal(params: {
  canvas: WorldCanvasDocument;
  focus: WorldCanvasCoachingFocus;
  expectedFocusText: string;
  proposal: WorldCanvasCoachingProposal;
}): WorldCanvasDocument {
  const currentText = getWorldCanvasCoachingFocusText(params.canvas, params.focus);
  if (currentText !== params.expectedFocusText) {
    throw new Error('The Canvas text changed after this suggestion was created. Ask the coach again before applying it.');
  }
  const text = params.proposal.text.trim();
  if (!text) throw new Error('The coaching proposal is empty.');
  if (params.proposal.kind === 'open-thread') {
    return addOpenThread(
      params.canvas,
      text,
      params.focus.type === 'lens' ? params.focus.kind : undefined
    );
  }
  if (params.focus.type === 'premise') {
    return {...params.canvas, premise: text, updatedAt: Date.now()};
  }
  const lensKind = params.focus.kind;
  const lens = params.canvas.lenses.find((candidate) => candidate.kind === lensKind);
  if (!lens) throw new Error('Bring this lens into focus before applying coaching.');
  return updateSketchText(params.canvas, lensKind, lens.activeSketchId, text);
}
