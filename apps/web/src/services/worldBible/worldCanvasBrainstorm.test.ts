import {describe, expect, it} from 'vitest';
import {
  BRAINSTORM_EMPTY_RESPONSE_MESSAGE,
  BRAINSTORM_INVALID_RESPONSE_MESSAGE,
  BRAINSTORM_MIN_RESPONSE_TOKENS,
  BRAINSTORM_MAX_CANON_NAMES,
  BRAINSTORM_MAX_ITEM_CHARS,
  BRAINSTORM_MAX_ITEMS,
  WorldCanvasBrainstormResponseError,
  brainstormResponseTokens,
  buildWorldCanvasBrainstormPrompt,
  collectCanonNames,
  parseWorldCanvasBrainstormResponse
} from './worldCanvasBrainstorm';
import {addOpenThread, createEmptyWorldCanvas, getActiveSketch, openLens, updateSketchText} from './worldCanvasService';

const buildCanvas = () => {
  let canvas = createEmptyWorldCanvas('project-1');
  canvas = {...canvas, premise: 'A city powered by borrowed memories.'};
  canvas = openLens(canvas, 'factions');
  canvas = updateSketchText(canvas, 'factions', getActiveSketch(canvas.lenses[0]).id, 'The Cinder Compact hoards old memories.');
  canvas = openLens(canvas, 'places');
  canvas = updateSketchText(canvas, 'places', getActiveSketch(canvas.lenses[1]).id, 'The drowned archive under the harbor.');
  canvas = addOpenThread(canvas, 'Who pays when a memory is returned?', 'factions');
  canvas = addOpenThread(canvas, 'What does the harbor smell like?', 'places');
  canvas = addOpenThread(canvas, 'Is the city older than its founders claim?');
  return canvas;
};

const reply = (items: unknown[]) => JSON.stringify({items});

describe('collectCanonNames', () => {
  it('takes record names and their entity aliases only, deduplicated and sorted', () => {
    const names = collectCanonNames(
      [
        {id: 'e1', name: 'Sera Vale'},
        {id: 'e2', name: 'Cinder Compact'}
      ],
      [
        {alias: 'The Compact', targetType: 'entity', targetId: 'e2'},
        {alias: 'sera vale', targetType: 'entity', targetId: 'e1'},
        {alias: 'Old Tom', targetType: 'character', targetId: 'c1'},
        {alias: 'Ghost Alias', targetType: 'entity', targetId: 'deleted-entity'}
      ]
    );

    expect(names).toEqual(['Cinder Compact', 'Sera Vale', 'The Compact']);
  });
});

describe('buildWorldCanvasBrainstormPrompt', () => {
  it('labels the material exploratory and sends canon as names only', () => {
    const {systemPrompt, userPrompt} = buildWorldCanvasBrainstormPrompt({
      canvas: buildCanvas(),
      focus: {type: 'lens', kind: 'factions'},
      canonNames: ['Cinder Compact', 'Sera Vale']
    });

    expect(systemPrompt).toContain('EXPLORATORY — NOT CANON');
    expect(systemPrompt).toContain('Reply with JSON only');
    expect(userPrompt).toContain('--- Exploratory material (not canon) ---');
    expect(userPrompt).toContain('--- Accepted canon names (names only) ---\n\nCinder Compact, Sera Vale');
    expect(userPrompt).toContain('A city powered by borrowed memories.');
    expect(userPrompt).toContain('The Cinder Compact hoards old memories.');
  });

  it('sends only the focused lens and the questions that belong to it', () => {
    const {userPrompt} = buildWorldCanvasBrainstormPrompt({
      canvas: buildCanvas(),
      focus: {type: 'lens', kind: 'factions'},
      canonNames: []
    });

    expect(userPrompt).not.toContain('drowned archive');
    expect(userPrompt).toContain('Who pays when a memory is returned?');
    expect(userPrompt).toContain('Is the city older than its founders claim?');
    expect(userPrompt).not.toContain('What does the harbor smell like?');
    expect(userPrompt).toContain('(none yet)');
  });

  it('sends no lens notes for the premise and skips answered questions', () => {
    const canvas = buildCanvas();
    canvas.openThreads[0] = {...canvas.openThreads[0], status: 'settled'};
    const {userPrompt} = buildWorldCanvasBrainstormPrompt({
      canvas,
      focus: {type: 'premise'},
      canonNames: []
    });

    expect(userPrompt).toContain('Brainstorm focus: Core Idea.');
    expect(userPrompt).not.toContain('Cinder Compact hoards');
    expect(userPrompt).not.toContain('drowned archive');
    expect(userPrompt).not.toContain('Who pays when a memory is returned?');
    expect(userPrompt).toContain('What does the harbor smell like?');
  });

  it('caps the canon names and asks a repeat request not to repeat earlier ideas', () => {
    const canonNames = Array.from({length: BRAINSTORM_MAX_CANON_NAMES + 5}, (_, i) => `Name ${i}`);
    const {userPrompt} = buildWorldCanvasBrainstormPrompt({
      canvas: buildCanvas(),
      focus: {type: 'premise'},
      canonNames,
      earlierItems: ['What if the memories are stolen?']
    });

    expect(userPrompt).toContain('(and 5 more)');
    expect(userPrompt).not.toContain(`Name ${BRAINSTORM_MAX_CANON_NAMES},`);
    expect(userPrompt).toContain('do not repeat these');
    expect(userPrompt).toContain('- What if the memories are stolen?');
  });
});

describe('parseWorldCanvasBrainstormResponse', () => {
  it('accepts a valid list, including one wrapped in a code fence', () => {
    const items = [
      {kind: 'tension', text: 'The Compact needs the city to forget.'},
      {kind: 'question', text: 'Who remembers the founders?'}
    ];

    expect(parseWorldCanvasBrainstormResponse(reply(items))).toEqual(items);
    expect(parseWorldCanvasBrainstormResponse(`\`\`\`json\n${reply(items)}\n\`\`\``)).toEqual(items);
  });

  it(`rejects more than ${BRAINSTORM_MAX_ITEMS} items instead of trimming`, () => {
    const items = Array.from({length: BRAINSTORM_MAX_ITEMS + 1}, (_, i) => ({
      kind: 'alternative',
      text: `Idea ${i}`
    }));

    expect(() => parseWorldCanvasBrainstormResponse(reply(items))).toThrow(
      WorldCanvasBrainstormResponseError
    );
    expect(parseWorldCanvasBrainstormResponse(reply(items.slice(0, BRAINSTORM_MAX_ITEMS)))).toHaveLength(
      BRAINSTORM_MAX_ITEMS
    );
  });

  it(`rejects an item longer than ${BRAINSTORM_MAX_ITEM_CHARS} characters`, () => {
    const exact = 'x'.repeat(BRAINSTORM_MAX_ITEM_CHARS);

    expect(parseWorldCanvasBrainstormResponse(reply([{kind: 'tension', text: exact}]))).toHaveLength(1);
    expect(() =>
      parseWorldCanvasBrainstormResponse(reply([{kind: 'tension', text: `${exact}x`}]))
    ).toThrow(BRAINSTORM_INVALID_RESPONSE_MESSAGE);
  });

  it('keeps the raw reply on the error and names an empty reply for what it is', () => {
    const prose = 'Here are some ideas: the Compact is corrupt.';
    try {
      parseWorldCanvasBrainstormResponse(prose);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WorldCanvasBrainstormResponseError);
      expect((error as WorldCanvasBrainstormResponseError).reply).toBe(prose);
    }
    expect(() => parseWorldCanvasBrainstormResponse('  ')).toThrow(BRAINSTORM_EMPTY_RESPONSE_MESSAGE);
  });

  it.each([
    ['prose', 'Here are some ideas: the Compact is corrupt.'],
    ['an unknown kind', reply([{kind: 'fact', text: 'The Compact is corrupt.'}])],
    ['an empty list', reply([])],
    ['blank text', reply([{kind: 'question', text: '   '}])],
    ['a missing items key', JSON.stringify({ideas: []})]
  ])('rejects %s', (_label, content) => {
    expect(() => parseWorldCanvasBrainstormResponse(content)).toThrow(
      WorldCanvasBrainstormResponseError
    );
  });
});

describe('brainstormResponseTokens', () => {
  it('never asks a hosted model for less than a full list needs, but honors a larger setting', () => {
    expect(brainstormResponseTokens('anthropic', 500)).toBe(BRAINSTORM_MIN_RESPONSE_TOKENS);
    expect(brainstormResponseTokens('openai', undefined)).toBe(BRAINSTORM_MIN_RESPONSE_TOKENS);
    expect(brainstormResponseTokens('gemini', 4000)).toBe(4000);
  });

  it('sends no cap to a local model', () => {
    expect(brainstormResponseTokens('ollama', 500)).toBeUndefined();
  });
});
