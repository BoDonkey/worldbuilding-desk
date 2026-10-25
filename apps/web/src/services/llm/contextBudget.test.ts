import {describe, expect, it} from 'vitest';
import {
  MAX_CONTEXT_BUDGET_TOKENS,
  buildPromptBreakdown,
  contextBudgetTokens,
  estimateTextTokens,
  fitContextChunks,
  fitContextToBudget,
  sectionForContextSource,
  type BudgetItem
} from './contextBudget';

const item = (value: string, section: BudgetItem<string>['section'], tokens: number, relevance?: number): BudgetItem<string> => ({
  value,
  section,
  text: 'x'.repeat(tokens * 3),
  relevance
});

describe('estimateTextTokens', () => {
  it('counts three ASCII characters or one other character as a token', () => {
    expect(estimateTextTokens('')).toBe(0);
    expect(estimateTextTokens('abcdefg')).toBe(3);
    expect(estimateTextTokens('剣と盾')).toBe(3);
  });
});

describe('contextBudgetTokens', () => {
  it('leaves room for the fixed text, the reply, and a margin, and never goes below zero', () => {
    expect(contextBudgetTokens({contextTokens: 8192, fixedTokens: 1000, replyTokens: 2000})).toBe(8192 - 1000 - 2000 - 256);
    // No reply length: a quarter of the context, at least 768 and at most 2,048.
    expect(contextBudgetTokens({contextTokens: 4096, fixedTokens: 500})).toBe(4096 - 500 - 1024 - 256);
    expect(contextBudgetTokens({contextTokens: 2048, fixedTokens: 500})).toBe(2048 - 500 - 768 - 256);
    expect(contextBudgetTokens({contextTokens: 16384, fixedTokens: 500})).toBe(16384 - 500 - 2048 - 256);
    expect(contextBudgetTokens({contextTokens: 2048, fixedTokens: 3000})).toBe(0);
  });

  it('caps large contexts so hosted prompts do not grow with the model', () => {
    expect(contextBudgetTokens({contextTokens: 200_000, fixedTokens: 100})).toBe(MAX_CONTEXT_BUDGET_TOKENS);
  });
});

describe('fitContextToBudget', () => {
  it('keeps everything that fits, in the order given', () => {
    const fit = fitContextToBudget([item('note', 'source-note', 10), item('canon', 'canon-record', 10)], 100);
    expect(fit.kept.map((kept) => kept.value)).toEqual(['note', 'canon']);
    expect(fit.dropped).toEqual([]);
    expect(fit.usedTokens).toBe(20);
  });

  it('leaves out the lowest priority first and reports it', () => {
    const fit = fitContextToBudget(
      [item('linked', 'linked-record', 40), item('note', 'source-note', 40), item('canon', 'canon-record', 40)],
      85
    );
    expect(fit.kept.map((kept) => kept.value)).toEqual(['note', 'canon']);
    expect(fit.dropped.map((dropped) => [dropped.value, dropped.tokens])).toEqual([['linked', 40]]);
  });

  it('gives each section its own share, so one large section cannot crowd out the rest', () => {
    // Without shares, the three canon records (priority) would take all 90 tokens.
    const fit = fitContextToBudget(
      [
        item('canon-1', 'canon-record', 30),
        item('canon-2', 'canon-record', 30),
        item('canon-3', 'canon-record', 30),
        item('fact', 'accepted-facts', 30)
      ],
      90
    );
    expect(fit.kept.map((kept) => kept.value)).toEqual(['canon-1', 'canon-2', 'fact']);
    expect(fit.dropped.map((dropped) => dropped.value)).toEqual(['canon-3']);
  });

  it('within a section keeps the most relevant first, and leftover room goes to what is left', () => {
    const fit = fitContextToBudget(
      [item('weak', 'source-note', 30, 0.2), item('strong', 'source-note', 30, 0.9), item('small', 'rules', 5)],
      40
    );
    expect(fit.kept.map((kept) => kept.value)).toEqual(['strong', 'small']);
  });

  it('keeps nothing in a zero budget', () => {
    expect(fitContextToBudget([item('canon', 'canon-record', 1)], 0).kept).toEqual([]);
  });
});

describe('sectionForContextSource', () => {
  it('reads the trust labels the app writes', () => {
    expect(sectionForContextSource('Accepted canon: World Bible record - Aria')).toBe('canon-record');
    expect(sectionForContextSource('Accepted canon: linked World Bible record - Ember Court (linked to Aria)')).toBe('linked-record');
    expect(sectionForContextSource('Accepted canon fact - Aria')).toBe('accepted-facts');
    expect(sectionForContextSource('Accepted canon - Aria')).toBe('canon-record');
    expect(sectionForContextSource('Linked Source Note: source material, not automatically canon - X')).toBe('linked-source-note');
    expect(sectionForContextSource('General Source Note: project reference, not automatically canon - X')).toBe('source-note');
    expect(sectionForContextSource('Scene draft - Ch 1')).toBe('scene-draft');
    expect(sectionForContextSource('Rules reference - Combat')).toBe('rules');
    expect(sectionForContextSource('Pending proposal, not canon - Aria: spy')).toBe('pending-proposals');
    expect(sectionForContextSource('Project memory - x')).toBe('other');
  });
});

describe('fitContextChunks', () => {
  const chunks = [
    {source: 'Selected text', content: 's'.repeat(300)},
    {source: 'General Source Note: project reference, not automatically canon - Rumor', content: 'r'.repeat(3000), relevance: 0.4},
    {source: 'Accepted canon fact - Aria', content: 'f'.repeat(300), relevance: 0.9}
  ];

  it('keeps everything while the context size is unknown', () => {
    expect(fitContextChunks({chunks, contextTokens: null, fixedText: ['prompt']})).toEqual({kept: chunks, dropped: [], budgetTokens: null});
  });

  it('drops what does not fit after the fixed text, and keeps the selection first', () => {
    const fit = fitContextChunks({
      chunks,
      contextTokens: 2048,
      fixedText: ['p'.repeat(1500)],
      sectionOf: (chunk) => (chunk === chunks[0] ? 'author-selection' : undefined)
    });
    expect(fit.kept).toEqual([chunks[0], chunks[2]]);
    expect(fit.dropped).toEqual([chunks[1]]);
  });
});

describe('buildPromptBreakdown', () => {
  it('counts instructions, messages, and each source once, and totals them', () => {
    const breakdown = buildPromptBreakdown({
      instructions: 'a'.repeat(30),
      messages: [{content: 'b'.repeat(9)}],
      sections: [
        {source: 'Accepted canon fact - Aria', content: 'c'.repeat(60)},
        {source: 'Accepted canon fact - Aria', content: 'c'.repeat(60)},
        {source: 'Scene draft - One', content: 'd'.repeat(3)}
      ]
    });
    expect(breakdown.instructionsTokens).toBe(10 + 8);
    expect(breakdown.conversationTokens).toBe(3 + 8);
    const fact = estimateTextTokens(`[Source: Accepted canon fact - Aria]\n${'c'.repeat(60)}\n\n`);
    expect(breakdown.sections).toEqual([
      {source: 'Accepted canon fact - Aria', tokens: fact * 2},
      {source: 'Scene draft - One', tokens: estimateTextTokens('[Source: Scene draft - One]\nddd\n\n')}
    ]);
    expect(breakdown.totalTokens).toBe(18 + 11 + fact * 2 + breakdown.sections[1]!.tokens);
  });
});
