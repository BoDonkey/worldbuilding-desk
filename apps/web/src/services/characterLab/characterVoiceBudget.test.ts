import {describe, expect, it} from 'vitest';
import type {CanonicalFact, WorldEntity} from '../../entityTypes';
import type {ConsistencyAlias} from '../storage';
import {estimateTextTokens} from '../llm/contextBudget';
import {buildBudgetedVoicePrompt, fitCharacterVoiceContexts} from './characterVoiceBudget';
import {findLinkedRecords, MAX_LINKED_RECORDS, type CharacterVoiceContext, type CharacterVoiceSection} from './characterVoiceContext';

const record = (id: string, name: string, links: string[] = [], projectId = 'p1'): WorldEntity => ({
  id,
  projectId,
  categoryId: 'places',
  name,
  fields: {notes: `${name} notes.`},
  links,
  createdAt: 1,
  updatedAt: 1
});

const fact = (id: string, factType: CanonicalFact['factType'], value: CanonicalFact['value']): CanonicalFact => ({
  id,
  projectId: 'p1',
  targetType: 'entity',
  targetId: 'aria',
  factType,
  value,
  acceptedAt: 1,
  updatedAt: 1
});

describe('findLinkedRecords', () => {
  const aria = record('aria', 'Aria', ['keep', 'aria', 'missing']);
  const entities = [
    aria,
    record('keep', 'Thornwall Keep'),
    record('court', 'Ember Court'),
    record('dess', 'Dess'),
    record('ash', 'Ash'),
    record('ashford', 'Ashford'),
    record('elsewhere', 'Ember Court', [], 'p2')
  ];
  const aliases: ConsistencyAlias[] = [
    {id: 'a1', projectId: 'p1', targetType: 'entity', targetId: 'dess', alias: 'Little Dess', createdAt: 1, updatedAt: 1}
  ];

  it('takes the record’s links, then records its accepted facts name, one hop only', () => {
    const found = findLinkedRecords({
      entity: aria,
      facts: [
        fact('f1', 'membership', 'sworn to the ember court'),
        fact('f2', 'relationship', {label: 'sister', value: 'Little Dess'}),
        fact('f3', 'background', 'born in Ashford'),
        fact('f4', 'alias', 'Thornwall Keep')
      ],
      entities,
      aliases
    });
    // Ash is not a whole-word match inside Ashford; the other project's Ember Court is never used.
    expect(found.map((entity) => entity.id)).toEqual(['keep', 'court', 'dess', 'ashford']);
  });

  it('finds nothing for a record with no links or facts, and caps how many it offers', () => {
    expect(findLinkedRecords({entity: record('x', 'X'), facts: [], entities, aliases})).toEqual([]);
    const many = Array.from({length: MAX_LINKED_RECORDS + 3}, (_, index) => record(`r${index}`, `Place ${index}`));
    const hub = record('hub', 'Hub', many.map((entity) => entity.id));
    expect(findLinkedRecords({entity: hub, facts: [], entities: [hub, ...many], aliases: []})).toHaveLength(MAX_LINKED_RECORDS);
  });
});

const facts = (count: number, size = 60) =>
  Array.from({length: count}, (_, index) => ({
    text: `- trait: ${String(index).padStart(2, '0')} ${'x'.repeat(size)}`,
    provenance: {type: 'canonical-fact' as const, id: `fact-${index}`}
  }));

const context = (name: string, factItems: ReturnType<typeof facts>, extra: CharacterVoiceSection[] = []): CharacterVoiceContext => ({
  entityId: name.toLowerCase(),
  name,
  position: {kind: 'latest'},
  positionLabel: 'the latest point in the manuscript',
  snapshot: null,
  sections: [
    {
      kind: 'canon-record',
      source: `Accepted canon: World Bible record - ${name}`,
      content: `${name} is a knight.`,
      provenance: [{type: 'world-entity', id: name.toLowerCase()}]
    },
    {
      kind: 'accepted-facts',
      source: `Accepted canon facts - ${name}`,
      content: factItems.map((item) => item.text).join('\n'),
      provenance: factItems.map((item) => item.provenance),
      items: factItems
    },
    ...extra
  ]
});

const linked = (name: string, size: number): CharacterVoiceSection => ({
  kind: 'linked-record',
  source: `Accepted canon: linked World Bible record - ${name} (linked to Aria)`,
  content: 'y'.repeat(size),
  provenance: [{type: 'world-entity', id: name}]
});

describe('fitCharacterVoiceContexts', () => {
  it('keeps everything that fits unchanged', () => {
    const aria = context('Aria', facts(3), [linked('Keep', 30)]);
    const fit = fitCharacterVoiceContexts([aria], 10_000);
    expect(fit.contexts[0]).toEqual(aria);
    expect(fit.omitted).toEqual([]);
  });

  it('leaves out linked records before facts, then single facts, and tells the model', () => {
    const fit = fitCharacterVoiceContexts([context('Aria', facts(10), [linked('Keep', 600)])], 150);
    const [aria] = fit.contexts;
    expect(aria!.sections.map((section) => section.kind)).toEqual(['canon-record', 'accepted-facts']);
    const kept = aria!.sections[1]!;
    expect(kept.items!.length).toBeGreaterThan(0);
    expect(kept.items!.length).toBeLessThan(10);
    expect(kept.provenance).toEqual(kept.items!.map((item) => item.provenance));
    expect(kept.content).toMatch(/\(\d+ more accepted facts left out to fit the model's context\.\)$/);
    expect(fit.omitted[0]).toMatchObject({source: 'Accepted canon facts - Aria'});
    expect(fit.omitted.at(-1)).toMatchObject({source: expect.stringContaining('linked World Bible record - Keep'), detail: ''});
    expect(fit.usedTokens).toBeLessThanOrEqual(150);
  });

  it('says so when no fact fits', () => {
    const fit = fitCharacterVoiceContexts([context('Aria', facts(2, 600))], 80);
    const [aria] = fit.contexts;
    expect(aria!.sections.find((section) => section.kind === 'accepted-facts')?.content).toBe(
      "(2 accepted facts left out to fit the model's context.)"
    );
    expect(fit.usedTokens).toBeLessThanOrEqual(fit.budgetTokens);
  });

  it('omits even the fact notice when the budget cannot pay for it', () => {
    const fit = fitCharacterVoiceContexts([context('Aria', facts(2, 600))], 0);
    expect(fit.contexts[0]!.sections).toEqual([]);
    expect(fit.usedTokens).toBe(0);
    expect(fit.omitted.filter((item) => item.source === 'Accepted canon facts - Aria')).toHaveLength(2);
  });

  it('shares one budget across characters, the first character first', () => {
    const fit = fitCharacterVoiceContexts([context('Aria', facts(4)), context('Borin', facts(4))], 140);
    const kept = (index: number) => fit.contexts[index]!.sections[1]!.items!.length;
    expect(kept(0)).toBeGreaterThanOrEqual(kept(1));
    expect(fit.omitted.some((item) => item.source === 'Accepted canon facts - Borin')).toBe(true);
  });
});

describe('buildBudgetedVoicePrompt', () => {
  const build = (contexts: CharacterVoiceContext[]) => ({
    systemPrompt: `Rules.\n${contexts.flatMap((entry) => entry.sections.map((section) => section.content)).join('\n')}`,
    messages: [{content: 'Hello'}]
  });

  it('sends everything while the context size is unknown', () => {
    const aria = context('Aria', facts(40));
    const result = buildBudgetedVoicePrompt({contexts: [aria], contextTokens: null, build});
    expect(result.fit).toBeNull();
    expect(result.prompt).toEqual(build([aria]));
  });

  it('fits the grounding into what the instructions and reply leave', () => {
    const result = buildBudgetedVoicePrompt({contexts: [context('Aria', facts(200))], contextTokens: 4096, build});
    // Reply: a quarter of the context; margin 256; "Rules.\n" 3 tokens and "Hello" 2, plus 8 per message.
    expect(result.fit!.budgetTokens).toBe(4096 - 1024 - 256 - 3 - 8 - 2 - 8);
    expect(result.fit!.omitted.length).toBeGreaterThan(0);
    expect(result.prompt.systemPrompt).toContain('left out to fit');
  });
});

describe('fact ranking', () => {
  it('keeps who the character is and their ties before habits when facts must be left out', () => {
    const items = [
      ...facts(6).map((item) => ({...item, rank: 3})),
      {text: '- membership: sworn to the Ember Court', provenance: {type: 'canonical-fact' as const, id: 'oath'}, rank: 8}
    ];
    const fit = fitCharacterVoiceContexts([context('Aria', items)], 90);
    const kept = fit.contexts[0]!.sections[1]!.items!;
    expect(kept.map((item) => item.provenance.id)).toContain('oath');
    expect(kept.length).toBeLessThan(items.length);
  });
});

describe('prompt breakdown (4.72)', () => {
  const build = (contexts: CharacterVoiceContext[]) => ({
    systemPrompt: `Rules.\n${contexts.flatMap((entry) => entry.sections.map((section) => `[Source: ${section.source}]\n${section.content}\n\n`)).join('')}`,
    messages: [{content: 'Hello'}]
  });

  it('counts the sections as sent, after the budget, apart from the instructions', () => {
    const {breakdown, fit} = buildBudgetedVoicePrompt({contexts: [context('Aria', facts(200))], contextTokens: 4096, build});
    expect(breakdown.instructionsTokens).toBe(3 + 8);
    expect(breakdown.conversationTokens).toBe(2 + 8);
    expect(breakdown.sections.map((section) => section.source)).toEqual([
      'Accepted canon: World Bible record - Aria',
      'Accepted canon facts - Aria'
    ]);
    const sent = fit!.contexts[0]!.sections[1]!;
    expect(breakdown.sections[1]!.tokens).toBe(estimateTextTokens(`[Source: ${sent.source}]\n${sent.content}\n\n`));
    expect(breakdown.totalTokens).toBeLessThan(4096);
  });

  it('still counts everything while the context size is unknown', () => {
    const {breakdown} = buildBudgetedVoicePrompt({contexts: [context('Aria', facts(200))], contextTokens: null, build});
    expect(breakdown.totalTokens).toBeGreaterThan(4096);
  });
});
