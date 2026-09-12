// @vitest-environment jsdom

import {describe, expect, it} from 'vitest';
import type {CanonicalFact, WritingDocument} from '../../entityTypes';
import {
  attributeClaim,
  buildCanonSlotAssertions,
  findSlotConflicts,
  learnValueClasses,
  parseFactValue,
  parseNumber
} from './factSlotComparison';

const fact = (overrides: Partial<CanonicalFact>): CanonicalFact => ({
  id: 'f',
  projectId: 'p',
  targetType: 'entity',
  targetId: 'sera',
  targetName: 'Sera Kestrel',
  factType: 'appearance',
  value: 'gray eyes',
  acceptedAt: 1,
  updatedAt: 1,
  ...overrides
});

const doc = (content: string): WritingDocument => ({
  id: 'scene',
  projectId: 'p',
  title: 'Scene',
  content,
  createdAt: 1,
  updatedAt: 1
});

const known = [
  {id: 'sera', name: 'Sera Kestrel', type: 'entity' as const},
  {id: 'sera', name: 'Sera', type: 'entity' as const},
  {id: 'tam', name: 'Tam', type: 'entity' as const}
];

const resolve = (f: CanonicalFact) => ({entityId: f.targetId, name: f.targetName ?? f.targetId});
const synonyms = new Map([['grey', 'gray']]);

describe('parseNumber', () => {
  it('reads digits, number words, and compounds', () => {
    expect(parseNumber('26')).toBe(26);
    expect(parseNumber('twenty-six')).toBe(26);
    expect(parseNumber('twenty six')).toBe(26);
    expect(parseNumber('two hundred')).toBe(200);
    expect(parseNumber('decade')).toBeNull();
  });
});

describe('parseFactValue', () => {
  it('derives a noun slot with one modifier, normalizing synonyms', () => {
    expect(parseFactValue(fact({value: 'grey eyes'}), synonyms)).toEqual({headNoun: 'eye', modifier: 'gray', numeric: null});
    expect(parseFactValue(fact({value: 'black scales'}), synonyms)).toEqual({headNoun: 'scale', modifier: 'black', numeric: null});
  });

  it('derives numeric slots with and without a noun', () => {
    expect(parseFactValue(fact({factType: 'age', value: 'twenty-six'}), synonyms)).toEqual({headNoun: null, modifier: null, numeric: 26});
    expect(parseFactValue(fact({factType: 'age', value: '31 years old'}), synonyms)).toEqual({headNoun: null, modifier: null, numeric: 31});
    expect(parseFactValue(fact({factType: 'membership', value: 'twenty years'}), synonyms)).toEqual({headNoun: 'year', modifier: null, numeric: 20});
  });

  it('leaves single-token and multi-modifier values to the assertion path', () => {
    expect(parseFactValue(fact({factType: 'occupation', value: 'cartographer'}), synonyms)).toBeNull();
    expect(parseFactValue(fact({value: 'pale gray eyes'}), synonyms)).toBeNull();
  });
});

describe('attributeClaim', () => {
  const names = new Map([
    ['sera', ['Sera Kestrel', 'Sera']],
    ['tam', ['Tam']]
  ]);

  it('uses the nearest preceding mention', () => {
    const block = 'Sera looked at Tam. His eyes were green.';
    expect(attributeClaim({block, index: block.indexOf('eyes'), previousBlock: null, namesByEntityId: names})).toBe('tam');
  });

  it('never attributes quoted claims to the speaker; the addressee comes from the prior block', () => {
    const previousBlock = 'Sera stood at the stairhead and found Tam closing the lamp.';
    const block = '"You look like Ma tonight," Tam said. "It\'s the eyes. Her same green."';
    expect(attributeClaim({block, index: block.indexOf('eyes'), previousBlock, namesByEntityId: names})).toBe('sera');
  });

  it('returns nothing when no entity can be defended', () => {
    expect(attributeClaim({block: 'The eyes were green.', index: 4, previousBlock: 'Sera and Tam argued.', namesByEntityId: names})).toBeNull();
  });
});

describe('findSlotConflicts', () => {
  const run = (content: string, facts: CanonicalFact[]) => {
    const assertions = buildCanonSlotAssertions({canonicalFacts: facts, resolveEntityId: resolve});
    return findSlotConflicts({documents: [doc(content)], assertions, knownEntities: known});
  };

  it('flags a color-class competitor and reports the scene span', () => {
    const conflicts = run('Sera Kestrel blinked. Her green eyes narrowed.', [fact({})]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({reason: 'value-class', scene: {modifier: 'green', phrase: 'green eyes'}});
  });

  it('accepts agreement and synonyms, and ignores adjectives outside any class', () => {
    expect(run('Sera Kestrel blinked. Her grey eyes narrowed.', [fact({})])).toEqual([]);
    expect(run('Sera Kestrel blinked. Her tired eyes narrowed, wide and wet.', [fact({})])).toEqual([]);
  });

  it('flags explicit negation and numeric mismatch', () => {
    expect(run('Sera Kestrel blinked. Her eyes were not gray.', [fact({})])[0]?.reason).toBe('negation');
    expect(run('Sera Kestrel was thirty years old.', [fact({factType: 'age', value: 'twenty-six'})])[0]?.reason).toBe('number');
    expect(run('Sera Kestrel was twenty-six years old.', [fact({factType: 'age', value: 'twenty-six'})])).toEqual([]);
  });

  it('learns a value class from other accepted values of the same slot', () => {
    const facts = [
      fact({id: 'a', factType: 'trait', value: 'oak staff'}),
      fact({id: 'b', targetId: 'tam', targetName: 'Tam', factType: 'trait', value: 'ash staff'})
    ];
    expect(learnValueClasses(buildCanonSlotAssertions({canonicalFacts: facts, resolveEntityId: resolve})).get('trait:staff')).toEqual(new Set(['oak', 'ash']));
    expect(run('Sera Kestrel leaned on her ash staff.', facts)).toHaveLength(1);
    expect(run('Sera Kestrel leaned on her yew staff.', facts)).toEqual([]);
  });

  it('honors per-project synonyms', () => {
    const assertions = buildCanonSlotAssertions({canonicalFacts: [fact({value: 'gray eyes'})], resolveEntityId: resolve, options: {synonyms: [['slate', 'gray']]}});
    const conflicts = findSlotConflicts({documents: [doc('Sera Kestrel blinked. Her slate eyes narrowed.')], assertions, knownEntities: known, options: {synonyms: [['slate', 'gray']]}});
    expect(conflicts).toEqual([]);
  });
});
