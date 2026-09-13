import {describe, expect, it} from 'vitest';
import type {CanonicalFact, WritingDocument} from '../../entityTypes';
import {
  buildCanonicalFactSupersession,
  filterCanonFactResultsForScene,
  formatCanonicalFactValidity,
  getCanonicalFactsValidAtScene,
  getCanonicalFactValidityTags
} from './canonicalFactValidity';

const scenes: WritingDocument[] = ['one', 'two', 'three'].map((id, order) => ({
  id,
  projectId: 'project-1',
  title: `Chapter ${order + 1}`,
  content: '',
  order,
  createdAt: order + 1,
  updatedAt: order + 1
}));

const fact = (overrides: Partial<CanonicalFact> = {}): CanonicalFact => ({
  id: 'fact-1',
  projectId: 'project-1',
  targetType: 'entity',
  targetId: 'sera',
  targetName: 'Sera',
  factType: 'occupation',
  value: 'cartographer',
  acceptedAt: 1,
  updatedAt: 1,
  ...overrides
});

describe('canonical fact manuscript validity', () => {
  it('treats from as inclusive and until as exclusive using current scene order', () => {
    const bounded = fact({validFromSceneId: 'two', validUntilSceneId: 'three'});
    expect(getCanonicalFactsValidAtScene([bounded], 'one', scenes)).toEqual([]);
    expect(getCanonicalFactsValidAtScene([bounded], 'two', scenes)).toEqual([bounded]);
    expect(getCanonicalFactsValidAtScene([bounded], 'three', scenes)).toEqual([]);

    const reordered = [scenes[1]!, scenes[0]!, scenes[2]!];
    expect(getCanonicalFactsValidAtScene([bounded], 'one', reordered)).toEqual([bounded]);
  });

  it('builds a lossless supersession without deleting the earlier fact', () => {
    const previous = fact();
    const next = fact({id: 'fact-2', value: 'warden', updatedAt: 9});
    const result = buildCanonicalFactSupersession({
      previousFact: previous,
      nextFact: next,
      asOfSceneId: 'two',
      documents: scenes
    });

    expect(result.previousFact).toMatchObject({id: 'fact-1', validUntilSceneId: 'two'});
    expect(result.nextFact).toMatchObject({id: 'fact-2', validFromSceneId: 'two'});
    expect(getCanonicalFactsValidAtScene(Object.values(result), 'one', scenes)).toEqual([
      result.previousFact
    ]);
    expect(getCanonicalFactsValidAtScene(Object.values(result), 'two', scenes)).toEqual([
      result.nextFact
    ]);
  });

  it('rejects a transition outside the earlier fact window', () => {
    expect(() => buildCanonicalFactSupersession({
      previousFact: fact({validFromSceneId: 'two'}),
      nextFact: fact({id: 'fact-2'}),
      asOfSceneId: 'one',
      documents: scenes
    })).toThrow('must start before');
  });

  it('carries stable boundaries into retrieval tags and filters them by scene', () => {
    const bounded = fact({validFromSceneId: 'two'});
    const result = {
      score: 1,
      chunk: {
        id: 'chunk',
        documentId: 'canon-fact:fact-1',
        documentTitle: 'Sera',
        content: 'Sera occupation: cartographer',
        metadata: {type: 'canon_fact' as const, tags: getCanonicalFactValidityTags(bounded)}
      }
    };
    expect(filterCanonFactResultsForScene([result], 'one', scenes)).toEqual([]);
    expect(filterCanonFactResultsForScene([result], 'two', scenes)).toEqual([result]);
    expect(formatCanonicalFactValidity(bounded, scenes)).toBe('from Chapter 2 onward');
  });
});
