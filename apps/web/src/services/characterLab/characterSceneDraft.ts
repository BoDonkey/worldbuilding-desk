import type {ChapterCard, WorldCanvasOpenThread} from '../../entityTypes';
import type {CharacterSceneDirection} from './characterVoicePrompt';
import {escapeHtml, paragraphs} from './characterLabTranscript';

/** Open threads offered to "Surprise me"; more would crowd out the characters' own context. */
export const SURPRISE_THREAD_LIMIT = 6;

/** One generated draft scene. Lives only for the app session. */
export interface CharacterSceneDraft {
  id: string;
  characterNames: string[];
  positionLabel: string;
  direction: CharacterSceneDirection;
  text: string;
  /** The author pressed Stop, so `text` is whatever arrived before that. */
  stopped: boolean;
}

/**
 * Story threads for "Surprise me": the chapter cards explicitly linked to the
 * chosen scene, then the most recently touched open World Canvas threads.
 * Settled and set-aside threads are never offered.
 */
export function buildCharacterSceneSeeds(params: {
  sceneId: string | null;
  chapterCards: ChapterCard[];
  openThreads: WorldCanvasOpenThread[];
}): string[] {
  const cardSeeds = params.sceneId
    ? params.chapterCards
        .filter((card) => (card.sceneIds ?? []).includes(params.sceneId as string))
        .sort((a, b) => a.order - b.order)
        .map((card) => {
          const plotPoints = [...card.plotPoints]
            .sort((a, b) => a.order - b.order)
            .map((point) => point.title.trim())
            .filter(Boolean);
          return [
            `Chapter card "${card.title.trim() || 'Untitled card'}"`,
            card.summary.trim() ? `: ${card.summary.trim()}` : '',
            plotPoints.length > 0 ? ` Plot points: ${plotPoints.join('; ')}.` : ''
          ].join('');
        })
    : [];
  const threadSeeds = params.openThreads
    .filter((thread) => thread.status === 'open' && thread.text.trim())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, SURPRISE_THREAD_LIMIT)
    .map((thread) => `Open thread: ${thread.text.trim()}`);
  return [...cardSeeds, ...threadSeeds];
}

/** Scratchpad HTML for a draft scene, marked as draft material rather than canon. */
export function formatCharacterSceneScratchpadHtml(draft: CharacterSceneDraft): string {
  const setup =
    draft.direction.kind === 'directed'
      ? paragraphs(draft.direction.setup, '<strong>Setup:</strong>')
      : `<p><strong>Surprise me, drawn from:</strong></p><ul>${draft.direction.seeds
          .map((seed) => `<li>${escapeHtml(seed)}</li>`)
          .join('')}</ul>`;
  return [
    `<h3>Character scene: ${escapeHtml(draft.characterNames.join(', '))}</h3>`,
    '<p><em>Draft from the character lab. Not canon.</em></p>',
    `<p><em>Story state at ${escapeHtml(draft.positionLabel)}</em></p>`,
    setup,
    paragraphs(draft.text),
    draft.stopped ? '<p><em>(Stopped before the scene finished.)</em></p>' : ''
  ].join('');
}

/** The scene's prose alone, for an ordinary editor insert at the Workspace cursor. */
export function formatCharacterSceneInsertHtml(draft: CharacterSceneDraft): string {
  return paragraphs(draft.text);
}
