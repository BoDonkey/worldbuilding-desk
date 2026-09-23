import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CraftSearchResult} from '../craft/types';
import {
  applyWorldCanvasCoachingProposal,
  buildSelectedCanvasReferenceLines,
  buildWorldCanvasCoachingPrompt,
  buildWorldCanvasCraftSearchQuery,
  canvasCoachingResponseTokens,
  parseWorldCanvasCoachingResponse,
  selectApplicableCanvasCraftResults,
  WorldCanvasCoachingResponseError
} from './worldCanvasCoaching';
import {
  createEmptyWorldCanvas,
  getActiveSketch,
  openLens,
  updateSketchText
} from './worldCanvasService';

const result = (overrides: Partial<CraftSearchResult> = {}): CraftSearchResult => ({
  score: 1,
  retrievalMode: 'lexical',
  provenance: {
    role: 'craft-reference',
    label: 'Vetted craft reference',
    contentVersion: 'test',
    citations: []
  },
  chunk: {
    id: 'craft-1',
    recordId: 'record-1',
    recordVersion: 1,
    title: 'Setting as pressure',
    section: 'Questions for the author',
    content: 'Ask what the setting makes costly.',
    embedding: [],
    metadata: {
      type: 'craft',
      authorVetted: true,
      documentType: 'pattern',
      family: 'general',
      detectability: 'practice',
      scopes: ['practice'],
      genres: ['general-fiction'],
      subgenres: [],
      exclusions: [],
      modifiers: [],
      tags: ['worldbuilding'],
      aliases: [],
      sourceConfidence: 'high',
      citations: []
    }
  },
  ...overrides
});

afterEach(() => vi.restoreAllMocks());

describe('World Canvas coaching retrieval', () => {
  it('builds an action- and focus-specific query capped to the focused text', () => {
    const query = buildWorldCanvasCraftSearchQuery({
      action: 'central-tension',
      focus: {type: 'lens', kind: 'constraints'},
      focusText: 'Memory magic requires a sacrifice. '.repeat(40)
    });
    expect(query).toContain('central tension conflict pressure stakes contradiction');
    expect(query).toContain('Constraints and costs');
    expect(query.length).toBeLessThan(650);
  });

  it('keeps only vetted Canvas-applicable craft chunks', () => {
    const sceneOnly = result({
      chunk: {
        ...result().chunk,
        id: 'scene-only',
        metadata: {...result().chunk.metadata, scopes: ['scene'], tags: ['dialogue']}
      }
    });
    expect(selectApplicableCanvasCraftResults([sceneOnly, result()])).toEqual([result()]);
  });
});

describe('World Canvas coaching trust prompt', () => {
  it('labels Canvas, craft, and selected project references separately', () => {
    const prompt = buildWorldCanvasCoachingPrompt({
      action: 'deeper-question',
      focus: {type: 'premise'},
      focusText: 'A city trades memories for safe passage.',
      selectedReferenceLines: ['Accepted canon name and aliases: Nia Vale, The Ferrymaster']
    });
    expect(prompt.systemPrompt).toContain('exploratory and NOT CANON');
    expect(prompt.systemPrompt).toContain('Craft reference context is instructional material');
    expect(prompt.systemPrompt).toContain('Never claim to have read or judged manuscript prose');
    expect(prompt.userPrompt).toContain('A city trades memories for safe passage.');
    expect(prompt.userPrompt).toContain('Accepted canon name and aliases: Nia Vale, The Ferrymaster');
    expect(prompt.systemPrompt).toContain('"kind":"open-thread"');
  });

  it('includes only selected names, aliases, and Source Note titles', () => {
    const lines = buildSelectedCanvasReferenceLines(
      [
        {id: 'entity-1', sourceType: 'world-bible', label: 'Nia Vale'},
        {id: 'note-1', sourceType: 'source-note', label: 'Ferrymen notes'}
      ],
      [{alias: 'The Ferrymaster', targetType: 'entity', targetId: 'entity-1'}]
    );
    expect(lines).toEqual([
      'Accepted canon name and aliases: Nia Vale, The Ferrymaster',
      'Source Note title only: Ferrymen notes'
    ]);
    expect(lines.join(' ')).not.toContain('secret note body');
  });
});

describe('World Canvas coaching response', () => {
  const reply = JSON.stringify({
    observations: [{pattern: 'Setting as pressure', application: 'The cost can force a choice.'}],
    proposal: {kind: 'replacement', text: 'A city buys safety by surrendering its memories.'}
  });

  it('validates the whole response and rejects the wrong proposal kind', () => {
    expect(parseWorldCanvasCoachingResponse(reply, 'focus').proposal.kind).toBe('replacement');
    expect(() => parseWorldCanvasCoachingResponse(reply, 'deeper-question')).toThrow(
      WorldCanvasCoachingResponseError
    );
    expect(() => parseWorldCanvasCoachingResponse('{bad json', 'focus')).toThrow(
      WorldCanvasCoachingResponseError
    );
  });

  it('keeps local runs uncapped and gives hosted JSON enough room', () => {
    expect(canvasCoachingResponseTokens('ollama', 500)).toBeUndefined();
    expect(canvasCoachingResponseTokens('anthropic', 500)).toBe(1200);
    expect(canvasCoachingResponseTokens('openai', 2000)).toBe(2000);
  });
});

describe('World Canvas coaching proposal application', () => {
  it('changes nothing until the deterministic apply action is explicitly called', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10);
    const canvas = {...createEmptyWorldCanvas('project-1'), premise: 'Original idea'};
    const proposal = {kind: 'replacement' as const, text: 'Focused idea'};
    expect(canvas.premise).toBe('Original idea');
    const applied = applyWorldCanvasCoachingProposal({
      canvas,
      focus: {type: 'premise'},
      expectedFocusText: 'Original idea',
      proposal
    });
    expect(applied.premise).toBe('Focused idea');
  });

  it('adds a proposed question as an Open Thread and rejects stale replacement text', () => {
    let canvas = openLens(createEmptyWorldCanvas('project-1'), 'places');
    const sketch = getActiveSketch(canvas.lenses[0]);
    canvas = updateSketchText(canvas, 'places', sketch.id, 'A drowned archive.');
    const withThread = applyWorldCanvasCoachingProposal({
      canvas,
      focus: {type: 'lens', kind: 'places'},
      expectedFocusText: 'A drowned archive.',
      proposal: {kind: 'open-thread', text: 'Who benefits from keeping it drowned?'}
    });
    expect(withThread.openThreads[0]).toMatchObject({
      text: 'Who benefits from keeping it drowned?',
      lensKind: 'places'
    });
    expect(() => applyWorldCanvasCoachingProposal({
      canvas: updateSketchText(canvas, 'places', sketch.id, 'The archive has surfaced.'),
      focus: {type: 'lens', kind: 'places'},
      expectedFocusText: 'A drowned archive.',
      proposal: {kind: 'replacement', text: 'A clearer archive.'}
    })).toThrow('Canvas text changed');
  });
});
