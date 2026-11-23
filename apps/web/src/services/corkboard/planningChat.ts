import type {ChapterCard, ChapterCardStatus, WritingDocument} from '../../entityTypes';
import {appendContextTrustInstructions} from '../llm/contextProvenance';
import type {LLMContextChunk} from '../llm/types';
import {countWords, htmlToPlainText} from '../../utils/textHelpers';

/*
 * The Corkboard planning chat (Slice 4.85): the outline as text a model can
 * talk about. Read-only by construction: this module only formats cards and
 * scene titles into a context chunk and a system prompt. Nothing here, or in
 * the chat built on it, writes cards, canon, or manuscript text.
 *
 * Every piece is bounded so a long board cannot crowd out the rest of the
 * prompt. Scene prose is left out unless the author asks for excerpts, and
 * then only the opening of each linked scene within a total cap.
 */

export type PlanningChatScope = 'board' | 'card';

export const PLANNING_SCOPE_LABELS: Record<PlanningChatScope, string> = {
  board: 'Whole board',
  card: 'This card'
};

/** Character bounds. Exported so tests and the disclosure can state them. */
export const PLANNING_LIMITS = {
  /** The whole formatted plan; later cards drop to title lines past this. */
  totalChars: 24_000,
  /** One card's summary on the whole board. */
  boardSummaryChars: 600,
  /** The chosen card's summary in This card. */
  cardSummaryChars: 4_000,
  /** A neighbouring card's summary in This card. */
  neighbourSummaryChars: 300,
  plotPointTitleChars: 160,
  /** Plot point notes, This card only; the whole board sends titles. */
  plotPointNotesChars: 800,
  plotPointsPerCard: 40,
  /** Opening of one linked scene, when excerpts are on. */
  excerptChars: 600,
  /** All excerpts together. */
  excerptTotalChars: 3_000
} as const;

const STATUS_LABELS: Record<ChapterCardStatus, string> = {
  planned: 'planned',
  draft: 'drafting',
  written: 'written'
};

/** Context section name the chat's plan chunk carries; also its "Sources used" label prefix. */
export const PLANNING_SOURCE_PREFIX = 'Corkboard plan (author outline, not canon)';

const clip = (value: string, limit: number): string => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`;
};

const cardTitle = (card: ChapterCard): string => card.title.trim() || 'Untitled chapter';

export interface PlanningContextInput {
  scope: PlanningChatScope;
  /** Cards in board order. */
  cards: ChapterCard[];
  documents: WritingDocument[];
  /** The card This card is about; ignored for the whole board. */
  cardId?: string | null;
  includeSceneExcerpts?: boolean;
}

export interface PlanningContext {
  /** The plan as sent, or empty when there is nothing to plan from. */
  content: string;
  /** The chunk label: which scope the plan covers. */
  source: string;
  /** Titles of scenes whose opening was sent. */
  excerptedScenes: string[];
  /** Cards cut to a title line because the plan reached its size limit. */
  shortenedCards: number;
}

interface ExcerptBudget {
  remaining: number;
  titles: string[];
}

function linkedSceneLines(
  card: ChapterCard,
  documentsById: Map<string, WritingDocument>,
  excerpts: ExcerptBudget | null
): string[] {
  const ids = card.sceneIds ?? [];
  if (ids.length === 0) return ['  Linked scenes: none'];
  const lines = ['  Linked scenes:'];
  for (const id of ids) {
    const scene = documentsById.get(id);
    if (!scene) {
      lines.push('  - (a linked scene that no longer exists)');
      continue;
    }
    const title = scene.title.trim() || 'Untitled scene';
    const words = countWords(scene.content);
    lines.push(`  - ${title} (${words.toLocaleString('en-US')} word${words === 1 ? '' : 's'})`);
    if (excerpts && excerpts.remaining > 0 && words > 0) {
      const limit = Math.min(PLANNING_LIMITS.excerptChars, excerpts.remaining);
      // One character is kept for the ellipsis a clipped opening ends with.
      const opening = clip(htmlToPlainText(scene.content), limit - 1);
      excerpts.remaining -= opening.length;
      excerpts.titles.push(title);
      lines.push(`    Opening excerpt: "${opening}"`);
    }
  }
  return lines;
}

/** Plot point lines in order. Stops at `budgetChars`, saying how many were left out. */
function plotPointLines(card: ChapterCard, withNotes: boolean, budgetChars = Infinity): string[] {
  if (card.plotPoints.length === 0) return ['  Plot points: none yet'];
  const points = [...card.plotPoints].sort((a, b) => a.order - b.order);
  const lines = ['  Plot points:'];
  let used = lines[0]!.length;
  let shown = 0;
  for (const [index, point] of points.slice(0, PLANNING_LIMITS.plotPointsPerCard).entries()) {
    const entry = [`  ${index + 1}. ${clip(point.title, PLANNING_LIMITS.plotPointTitleChars) || 'Untitled plot point'}`];
    const notes = withNotes ? clip(point.notes ?? '', PLANNING_LIMITS.plotPointNotesChars) : '';
    if (notes) entry.push(`     Notes: ${notes}`);
    const size = entry.reduce((sum, line) => sum + line.length + 1, 0);
    // Room is kept for the closing "more not shown" line.
    if (used + size + 48 > budgetChars) break;
    lines.push(...entry);
    used += size;
    shown += 1;
  }
  if (points.length > shown) {
    lines.push(`  (${points.length - shown} more plot point${points.length - shown === 1 ? '' : 's'} not shown)`);
  }
  return lines;
}

function cardBlock(
  card: ChapterCard,
  position: number,
  summaryChars: number,
  withNotes: boolean,
  documentsById: Map<string, WritingDocument>,
  excerpts: ExcerptBudget | null,
  budgetChars = Infinity
): string {
  const summary = clip(card.summary, summaryChars);
  const head = [
    `Chapter ${position}: ${cardTitle(card)} [${STATUS_LABELS[card.status]}]`,
    `  Summary: ${summary || '(no summary yet)'}`
  ];
  const scenes = linkedSceneLines(card, documentsById, excerpts);
  const fixed = [...head, ...scenes].reduce((sum, line) => sum + line.length + 1, 0);
  return [...head, ...plotPointLines(card, withNotes, budgetChars - fixed), ...scenes].join('\n');
}

const titleLine = (card: ChapterCard, position: number): string =>
  `Chapter ${position}: ${cardTitle(card)} [${STATUS_LABELS[card.status]}]`;

/** The outline for one scope, ordered as the board is, within `PLANNING_LIMITS`. */
export function buildPlanningContext(input: PlanningContextInput): PlanningContext {
  const cards = [...input.cards].sort((a, b) => a.order - b.order);
  const documentsById = new Map(input.documents.map((document) => [document.id, document]));
  const excerpts: ExcerptBudget | null = input.includeSceneExcerpts
    ? {remaining: PLANNING_LIMITS.excerptTotalChars, titles: []}
    : null;

  if (input.scope === 'card') {
    const index = cards.findIndex((card) => card.id === input.cardId);
    const card = cards[index];
    if (!card) {
      return {content: '', source: `${PLANNING_SOURCE_PREFIX}: this card`, excerptedScenes: [], shortenedCards: 0};
    }
    const neighbour = (other: ChapterCard | undefined, position: number, label: string) =>
      other
        ? `${label} — ${titleLine(other, position)}\n  Summary: ${
            clip(other.summary, PLANNING_LIMITS.neighbourSummaryChars) || '(no summary yet)'
          }`
        : `${label}: none (this is the ${label === 'Previous chapter' ? 'first' : 'last'} card)`;
    const header = `The author's chapter card, chapter ${index + 1} of ${cards.length}:`;
    const neighbours = [
      neighbour(cards[index - 1], index, 'Previous chapter'),
      neighbour(cards[index + 1], index + 2, 'Next chapter')
    ].join('\n');
    // Neighbours always fit; the card's plot points give way first.
    const cardBudget = PLANNING_LIMITS.totalChars - header.length - neighbours.length - 4;
    const content = [
      header,
      cardBlock(card, index + 1, PLANNING_LIMITS.cardSummaryChars, true, documentsById, excerpts, cardBudget),
      '',
      neighbours
    ].join('\n');
    return {
      content,
      source: `${PLANNING_SOURCE_PREFIX}: chapter ${index + 1}, ${cardTitle(card)}`,
      excerptedScenes: excerpts?.titles ?? [],
      shortenedCards: 0
    };
  }

  if (cards.length === 0) {
    return {content: '', source: `${PLANNING_SOURCE_PREFIX}: whole board`, excerptedScenes: [], shortenedCards: 0};
  }
  const header = `The author's corkboard, ${cards.length} chapter card${cards.length === 1 ? '' : 's'} in order:`;
  const parts: string[] = [header];
  let used = header.length;
  let shortenedCards = 0;
  let omitted = 0;
  cards.forEach((card, index) => {
    if (omitted > 0) {
      omitted += 1;
      return;
    }
    const remaining = PLANNING_LIMITS.totalChars - used;
    // Excerpts are only spent on cards that are sent in full.
    const snapshot = excerpts ? {remaining: excerpts.remaining, titles: [...excerpts.titles]} : null;
    const full = cardBlock(card, index + 1, PLANNING_LIMITS.boardSummaryChars, false, documentsById, snapshot);
    if (shortenedCards === 0 && full.length + 2 <= remaining) {
      parts.push(full);
      used += full.length + 2;
      if (excerpts && snapshot) Object.assign(excerpts, snapshot);
      return;
    }
    const line = `${titleLine(card, index + 1)} (details left out to fit)`;
    if (line.length + 2 <= remaining) {
      parts.push(line);
      used += line.length + 2;
      shortenedCards += 1;
      return;
    }
    omitted = 1;
  });
  if (omitted > 0) parts.push(`(${omitted} later chapter card${omitted === 1 ? '' : 's'} not shown)`);
  return {
    content: parts.join('\n\n'),
    source: `${PLANNING_SOURCE_PREFIX}: whole board`,
    excerptedScenes: excerpts?.titles ?? [],
    shortenedCards: shortenedCards + omitted
  };
}

const PLANNING_CHAT_INSTRUCTIONS = `You are a story-planning partner for a fiction author, talking through their corkboard: the chapter cards, plot points, and linked scenes they have planned.

- Help the author think about the chapter arc, pacing, cause and effect, character turns, and how to plan individual scenes.
- Ask a clarifying question when the plan is too thin to answer well.
- You cannot change the corkboard, the World Bible, or the manuscript. Offer ideas as suggestions the author may adopt; never say you have made a change.
- Do not write finished manuscript prose. A sentence or two to illustrate a scene idea is fine.
- The corkboard is the author's plan, not established canon. Treat accepted canon from the World Bible as the strongest source when the two disagree, and point the disagreement out.`;

/** System prompt for one planning-chat request. */
export function buildPlanningChatSystemPrompt(): string {
  return appendContextTrustInstructions(PLANNING_CHAT_INSTRUCTIONS);
}

/** The plan as a context chunk, kept ahead of retrieved records when the context is tight. */
export function planningContextChunk(context: PlanningContext): LLMContextChunk | null {
  return context.content ? {content: context.content, source: context.source, relevance: 1} : null;
}

/** What the planning chat sends, for the route disclosure beside the input. */
export function describePlanningMaterial(scope: PlanningChatScope, includeSceneExcerpts: boolean): string {
  const plan = scope === 'board'
    ? 'your message, every chapter card (titles, summaries, plot points, linked scene titles and word counts)'
    : 'your message, this chapter card in full, its neighbours\' titles and summaries';
  const excerpts = includeSceneExcerpts ? ', the opening of each linked scene' : '';
  return `${plan}${excerpts}, and related World Bible records`;
}
