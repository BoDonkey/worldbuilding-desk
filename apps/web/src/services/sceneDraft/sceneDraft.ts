import type {ChapterCard, ProjectAISettings, WritingDocument} from '../../entityTypes';
import type {LLMMessage} from '../llm/types';
import {MANUSCRIPT_WORD_PATTERN, countWords} from '../dashboard/storyDashboard';
import {
  CHARACTER_KNOWLEDGE_DISCLAIMER,
  CHARACTER_VOICE_RULES,
  escapeHtml,
  paragraphs,
  type CharacterVoiceContext
} from '../characterLab';
import {htmlToPlainText} from '../../utils/textHelpers';

/** Hard cap on one draft, enforced in code whatever the model returns. */
export const SCENE_DRAFT_WORD_CAP = 1500;
export const SCENE_DRAFT_DEFAULT_WORDS = 1000;
export const SCENE_DRAFT_MIN_WORDS = 100;
/** A scene at or under this many words can be drafted; longer scenes go through revision instead. */
export const SCENE_DRAFT_EMPTY_WORD_LIMIT = 50;
/** How much of the previous scene's ending is offered as context. */
export const PREVIOUS_ENDING_WORDS = 150;

/** Everything the author sees, and can edit, before a draft request is sent. */
export interface SceneDraftInputs {
  goal: string;
  povEntityId: string | null;
  /** Characters in the scene, including the point-of-view character. */
  presentEntityIds: string[];
  setting: string;
  beats: string;
  targetWords: number;
  previousEnding: string;
  notes: string;
}

export interface SceneDraft {
  id: string;
  sceneTitle: string;
  inputs: SceneDraftInputs;
  text: string;
  /** The author pressed Stop, so `text` is whatever arrived before that. */
  stopped: boolean;
  /** The model ran past the word cap and the text was cut at the cap. */
  trimmed: boolean;
}

/** The project allows AI scene drafts, and AI consultation is on. */
export const canDraftScenes = (aiSettings: ProjectAISettings | undefined | null): boolean =>
  Boolean(aiSettings?.allowSceneDrafts) && aiSettings?.inspectorSettings?.enableAIConsultation !== false;

export const isSceneDraftable = (html: string): boolean =>
  countWords(html) <= SCENE_DRAFT_EMPTY_WORD_LIMIT;

export const clampTargetWords = (value: number): number =>
  Math.min(SCENE_DRAFT_WORD_CAP, Math.max(SCENE_DRAFT_MIN_WORDS, Math.round(value) || SCENE_DRAFT_DEFAULT_WORDS));

/** The last words of the scene before `sceneId` in manuscript order, or '' for the first scene. */
export function previousSceneEnding(
  orderedScenes: WritingDocument[],
  sceneId: string,
  words: number = PREVIOUS_ENDING_WORDS
): string {
  const index = orderedScenes.findIndex((scene) => scene.id === sceneId);
  if (index <= 0) return '';
  const text = htmlToPlainText(orderedScenes[index - 1].content);
  const parts = text.split(' ').filter(Boolean);
  return parts.length <= words ? text : `…${parts.slice(-words).join(' ')}`;
}

/** A starting goal from the chapter cards linked to the scene: summary and plot points. */
export function sceneGoalFromCards(cards: ChapterCard[]): string {
  return [...cards]
    .sort((a, b) => a.order - b.order)
    .map((card) => {
      const plotPoints = [...card.plotPoints]
        .sort((a, b) => a.order - b.order)
        .map((point) => point.title.trim())
        .filter(Boolean);
      return [card.summary.trim(), plotPoints.length > 0 ? `Plot points: ${plotPoints.join('; ')}.` : '']
        .filter(Boolean)
        .join(' ');
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Cuts text to `cap` words, ending at the last sentence break inside the cap
 * when there is one. Deterministic, so a draft can never exceed the cap.
 */
export function capDraftWords(text: string, cap: number = SCENE_DRAFT_WORD_CAP): {text: string; trimmed: boolean} {
  let count = 0;
  for (const match of text.matchAll(MANUSCRIPT_WORD_PATTERN)) {
    count += 1;
    if (count <= cap) continue;
    const head = text.slice(0, match.index);
    // Last sentence end (with any closing quote) in the second half of the kept text.
    const sentenceEnds = [...head.matchAll(/[.!?…]["”’)]?(?=\s)/g)];
    const last = sentenceEnds[sentenceEnds.length - 1];
    const cutAt = last && last.index !== undefined && last.index > head.length / 2
      ? last.index + last[0].length
      : head.length;
    return {text: head.slice(0, cutAt).trimEnd(), trimmed: true};
  }
  return {text, trimmed: false};
}

const renderContext = (context: CharacterVoiceContext): string =>
  context.sections.map((section) => `[Source: ${section.source}]\n${section.content}`).join('\n\n');

const block = (label: string, value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? `${label}:\n${trimmed}` : null;
};

/**
 * The scene-draft prompt. Grounding follows the character lab: each present
 * character's World Bible records, accepted facts, dialogue style, and story
 * state at the start of the scene. Only what the author sees in the dialog is
 * sent; other scenes and Source Notes are not.
 */
export function buildSceneDraftPrompt(params: {
  inputs: SceneDraftInputs;
  characters: CharacterVoiceContext[];
}): {systemPrompt: string; messages: LLMMessage[]} {
  const {inputs, characters} = params;
  const goal = inputs.goal.trim();
  if (!goal) throw new Error('Describe what happens in this scene first.');
  const target = clampTargetWords(inputs.targetWords);
  const pov = characters.find((character) => character.entityId === inputs.povEntityId) ?? null;
  const systemPrompt = [
    'You draft one scene of the author’s manuscript as finished prose. Write only the scene: no ' +
      'title, headings, notes, or commentary before or after it.',
    `Length: about ${target} words, and never more than ${SCENE_DRAFT_WORD_CAP}.`,
    pov
      ? `Point of view: ${pov.name}. Stay in their perspective; show only what they can perceive or know.`
      : null,
    characters.length > 0 ? CHARACTER_VOICE_RULES : null,
    characters.length > 0 ? CHARACTER_KNOWLEDGE_DISCLAIMER : null,
    'Do not introduce major events, characters, or facts about the world that the material below ' +
      'does not support. Small incidental detail is fine. The author reviews the draft before it ' +
      'enters the manuscript.',
    ...characters.map(
      (character) => `Context for ${character.name} (at ${character.positionLabel}):\n\n${renderContext(character)}`
    )
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join('\n\n');
  const request = [
    block('What happens in this scene', goal),
    block('Setting', inputs.setting),
    block('Beats, in order', inputs.beats),
    block('How the previous scene ends', inputs.previousEnding),
    block('Notes from the author', inputs.notes),
    characters.length > 0 ? `Characters present: ${characters.map((character) => character.name).join(', ')}.` : null
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join('\n\n');
  return {systemPrompt, messages: [{role: 'user', content: request}]};
}

/** The draft's prose alone, for the marked, undoable insert into the scene. */
export const formatSceneDraftInsertHtml = (draft: SceneDraft): string => paragraphs(draft.text);

/** Scratchpad HTML for a draft, labeled as draft material with the inputs that produced it. */
export function formatSceneDraftScratchpadHtml(draft: SceneDraft): string {
  return [
    `<h3>Scene draft: ${escapeHtml(draft.sceneTitle || 'Untitled scene')}</h3>`,
    '<p><em>AI draft, not inserted into the scene. Not canon.</em></p>',
    paragraphs(draft.inputs.goal, '<strong>Goal:</strong>'),
    paragraphs(draft.text),
    draft.stopped ? '<p><em>(Stopped before the draft finished.)</em></p>' : '',
    draft.trimmed ? `<p><em>(Cut at ${SCENE_DRAFT_WORD_CAP} words.)</em></p>` : ''
  ].join('');
}
