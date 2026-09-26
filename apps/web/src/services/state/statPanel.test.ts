import {describe, expect, it} from 'vitest';
import type {ChapterCard, WritingDocument} from '../../entityTypes';
import {
  describeCharacterSnapshotChange,
  resolveChangesBaseline,
  toggleStatPin
} from './statPanel';

const scene = (id: string, order: number): WritingDocument => ({
  id,
  projectId: 'p',
  title: id,
  content: '',
  order,
  createdAt: order,
  updatedAt: order
});

const card = (id: string, order: number, title: string, sceneIds: string[]): ChapterCard => ({
  id,
  projectId: 'p',
  title,
  summary: '',
  status: 'draft',
  order,
  sceneIds,
  plotPoints: [],
  createdAt: order,
  updatedAt: order
}) as ChapterCard;

const documents = [scene('s1', 1), scene('s2', 2), scene('s3', 3), scene('s4', 4)];

describe('toggleStatPin', () => {
  it('pins, unpins, and refuses a fourth pin', () => {
    expect(toggleStatPin([], 'a')).toEqual({pins: ['a'], result: 'pinned'});
    expect(toggleStatPin(['a', 'b'], 'a')).toEqual({pins: ['b'], result: 'unpinned'});
    expect(toggleStatPin(['a', 'b', 'c'], 'd')).toEqual({pins: ['a', 'b', 'c'], result: 'full'});
  });
});

describe('resolveChangesBaseline', () => {
  it('starts at the opening of the chapter that links the scene', () => {
    const cards = [card('c2', 2, 'The Vault', ['s4', 's3']), card('c1', 1, 'Descent', ['s1', 's2'])];
    expect(resolveChangesBaseline({documents, chapterCards: cards, sceneId: 's4'})).toEqual({
      sceneOrder: 3,
      label: 'Since the previous chapter, before “The Vault”'
    });
    expect(resolveChangesBaseline({documents, chapterCards: cards, sceneId: 's2'})?.sceneOrder).toBe(1);
  });

  it('uses the first card by Corkboard order and ignores missing linked scenes', () => {
    const cards = [card('late', 5, 'Late', ['s3']), card('early', 1, 'Early', ['gone', 's2', 's3'])];
    expect(resolveChangesBaseline({documents, chapterCards: cards, sceneId: 's3'})).toEqual({
      sceneOrder: 2,
      label: 'Since the previous chapter, before “Early”'
    });
  });

  it('falls back to the previous scene without a chapter link', () => {
    expect(resolveChangesBaseline({documents, chapterCards: [], sceneId: 's3'})).toEqual({
      sceneOrder: 3,
      label: 'Since the previous scene (no chapter card links this scene)'
    });
    expect(resolveChangesBaseline({documents, chapterCards: [], sceneId: 'missing'})).toBeNull();
  });
});

describe('describeCharacterSnapshotChange', () => {
  it('phrases each kind of change', () => {
    expect(
      [
        {kind: 'level', from: 3, to: 4},
        {kind: 'resource', id: 'hp', label: 'Health', from: {current: 30, max: 40}, to: {current: 12, max: 40}},
        {kind: 'stat', id: 'str', label: 'Strength', from: '12', to: '14'},
        {kind: 'status', name: 'Poisoned', change: 'added'},
        {kind: 'item', name: 'Potion', fromQuantity: 2, toQuantity: 1},
        {kind: 'equipment', name: 'Ember Blade', change: 'equipped'},
        {kind: 'location', from: null, to: 'The Vault'}
      ].map((change) => describeCharacterSnapshotChange(change as never))
    ).toEqual([
      'Level 3 → 4',
      'Health 30/40 → 12/40',
      'Strength 12 → 14',
      'Gained Poisoned',
      'Potion 2 → 1 (lost)',
      'Equipped Ember Blade',
      'Moved nowhere → The Vault'
    ]);
  });
});
