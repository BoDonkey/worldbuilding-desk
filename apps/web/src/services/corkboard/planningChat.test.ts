import {describe, expect, it} from 'vitest';
import type {ChapterCard, PlotPoint, WritingDocument} from '../../entityTypes';
import {
  PLANNING_LIMITS,
  buildPlanningChatSystemPrompt,
  buildPlanningContext,
  describePlanningMaterial,
  planningContextChunk
} from './planningChat';

const point = (cardId: string, order: number, title: string, notes?: string): PlotPoint => ({
  id: `${cardId}-p${order}`,
  chapterCardId: cardId,
  title,
  notes,
  order,
  createdAt: 0,
  updatedAt: 0
});

const card = (id: string, order: number, overrides: Partial<ChapterCard> = {}): ChapterCard => ({
  id,
  projectId: 'p1',
  title: `Card ${id}`,
  summary: `Summary of ${id}.`,
  status: 'planned',
  order,
  plotPoints: [],
  createdAt: 0,
  updatedAt: 0,
  ...overrides
});

const scene = (id: string, title: string, content: string): WritingDocument => ({
  id,
  projectId: 'p1',
  title,
  content,
  createdAt: 0,
  updatedAt: 0
});

describe('buildPlanningContext — whole board', () => {
  it('lists every card in board order, not array order', () => {
    const context = buildPlanningContext({
      scope: 'board',
      cards: [card('b', 2), card('a', 1), card('c', 3)],
      documents: []
    });
    const a = context.content.indexOf('Chapter 1: Card a');
    const b = context.content.indexOf('Chapter 2: Card b');
    const c = context.content.indexOf('Chapter 3: Card c');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(context.source).toMatch(/whole board/);
  });

  it('includes status, summary, plot point titles, and linked scene titles with word counts', () => {
    const context = buildPlanningContext({
      scope: 'board',
      cards: [
        card('a', 1, {
          status: 'draft',
          sceneIds: ['s1'],
          plotPoints: [point('a', 2, 'The betrayal', 'Secret note'), point('a', 1, 'The arrival')]
        })
      ],
      documents: [scene('s1', 'Gate scene', '<p>Three words here.</p>')]
    });
    expect(context.content).toContain('Chapter 1: Card a [drafting]');
    expect(context.content).toContain('Summary: Summary of a.');
    expect(context.content.indexOf('1. The arrival')).toBeLessThan(context.content.indexOf('2. The betrayal'));
    // Plot point notes are for This card; the board sends titles only.
    expect(context.content).not.toContain('Secret note');
    expect(context.content).toContain('Gate scene (3 words)');
  });

  it('says when a card has no plot points, no summary, or no linked scenes', () => {
    const context = buildPlanningContext({scope: 'board', cards: [card('a', 1, {summary: '  '})], documents: []});
    expect(context.content).toContain('Plot points: none yet');
    expect(context.content).toContain('(no summary yet)');
    expect(context.content).toContain('Linked scenes: none');
  });

  it('marks a linked scene that no longer exists instead of dropping it silently', () => {
    const context = buildPlanningContext({
      scope: 'board',
      cards: [card('a', 1, {sceneIds: ['gone']})],
      documents: []
    });
    expect(context.content).toContain('a linked scene that no longer exists');
  });

  it('sends no scene prose unless excerpts are asked for', () => {
    const cards = [card('a', 1, {sceneIds: ['s1']})];
    const documents = [scene('s1', 'Gate', '<p>The secret opening line.</p>')];
    const without = buildPlanningContext({scope: 'board', cards, documents});
    expect(without.content).not.toContain('secret opening');
    expect(without.excerptedScenes).toEqual([]);
    const withExcerpts = buildPlanningContext({scope: 'board', cards, documents, includeSceneExcerpts: true});
    expect(withExcerpts.content).toContain('Opening excerpt: "The secret opening line."');
    expect(withExcerpts.excerptedScenes).toEqual(['Gate']);
  });

  it('stays within the size limit, shortening later cards to titles', () => {
    const long = 'x'.repeat(5_000);
    const cards = Array.from({length: 200}, (_, index) =>
      card(`c${index}`, index, {summary: long, plotPoints: [point(`c${index}`, 1, 'Beat')]})
    );
    const context = buildPlanningContext({scope: 'board', cards, documents: []});
    expect(context.content.length).toBeLessThanOrEqual(PLANNING_LIMITS.totalChars + 100);
    expect(context.shortenedCards).toBeGreaterThan(0);
    expect(context.content).toMatch(/details left out to fit|not shown/);
    // Each summary is clipped.
    expect(context.content).not.toContain('x'.repeat(PLANNING_LIMITS.boardSummaryChars + 1));
  });

  it('caps excerpts in total, not only per scene', () => {
    const prose = `<p>${'word '.repeat(400)}</p>`;
    const documents = Array.from({length: 10}, (_, index) => scene(`s${index}`, `Scene ${index}`, prose));
    const context = buildPlanningContext({
      scope: 'board',
      cards: [card('a', 1, {sceneIds: documents.map((document) => document.id)})],
      documents,
      includeSceneExcerpts: true
    });
    const excerptChars = [...context.content.matchAll(/Opening excerpt: "([^"]*)"/g)]
      .reduce((sum, match) => sum + match[1]!.length, 0);
    expect(excerptChars).toBeLessThanOrEqual(PLANNING_LIMITS.excerptTotalChars);
    expect(context.excerptedScenes.length).toBeLessThan(documents.length);
  });

  it('is empty for an empty board', () => {
    const context = buildPlanningContext({scope: 'board', cards: [], documents: []});
    expect(context.content).toBe('');
    expect(planningContextChunk(context)).toBeNull();
  });
});

describe('buildPlanningContext — this card', () => {
  const cards = [
    card('a', 1, {summary: 'Before.'}),
    card('b', 2, {
      summary: 'The middle chapter.',
      plotPoints: [point('b', 1, 'Turn', 'Why the turn matters')],
      sceneIds: ['s1']
    }),
    card('c', 3, {summary: 'After.'}),
    card('d', 4, {summary: 'Far away.'})
  ];

  it('sends the card in full with plot point notes, and only its neighbours\' titles and summaries', () => {
    const context = buildPlanningContext({
      scope: 'card',
      cards,
      cardId: 'b',
      documents: [scene('s1', 'Middle scene', '<p>One two.</p>')]
    });
    expect(context.content).toContain('chapter 2 of 4');
    expect(context.content).toContain('Notes: Why the turn matters');
    expect(context.content).toContain('Middle scene (2 words)');
    expect(context.content).toContain('Previous chapter — Chapter 1: Card a');
    expect(context.content).toContain('Before.');
    expect(context.content).toContain('Next chapter — Chapter 3: Card c');
    expect(context.content).not.toContain('Far away.');
    expect(context.source).toContain('chapter 2, Card b');
  });

  it('says when the card is the first or last', () => {
    const first = buildPlanningContext({scope: 'card', cards, cardId: 'a', documents: []});
    expect(first.content).toContain('Previous chapter: none (this is the first card)');
    const last = buildPlanningContext({scope: 'card', cards, cardId: 'd', documents: []});
    expect(last.content).toContain('Next chapter: none (this is the last card)');
  });

  it('is empty when the card is missing', () => {
    expect(buildPlanningContext({scope: 'card', cards, cardId: 'nope', documents: []}).content).toBe('');
  });

  it('bounds the card summary, plot point count, and notes', () => {
    const big = card('big', 1, {
      summary: 's'.repeat(PLANNING_LIMITS.cardSummaryChars * 2),
      plotPoints: Array.from({length: 60}, (_, index) => point('big', index, `Beat ${index}`, 'n'.repeat(2_000)))
    });
    const context = buildPlanningContext({scope: 'card', cards: [big], cardId: 'big', documents: []});
    expect(context.content).not.toContain('s'.repeat(PLANNING_LIMITS.cardSummaryChars + 1));
    expect(context.content).not.toContain('n'.repeat(PLANNING_LIMITS.plotPointNotesChars + 1));
    expect(context.content).toMatch(/\(\d+ more plot points not shown\)/);
    expect(context.content).toContain('Next chapter: none');
    expect(context.content.length).toBeLessThanOrEqual(PLANNING_LIMITS.totalChars + 1);
  });
});

describe('planning chat prompt', () => {
  it('keeps the model read-only and applies the context trust rules', () => {
    const prompt = buildPlanningChatSystemPrompt();
    expect(prompt).toContain('You cannot change the corkboard');
    expect(prompt).toContain('Do not write finished manuscript prose');
    expect(prompt).toContain('Context trust rules');
  });

  it('discloses scene openings only when they are sent', () => {
    expect(describePlanningMaterial('board', false)).not.toContain('opening');
    expect(describePlanningMaterial('card', true)).toContain('the opening of each linked scene');
  });
});
