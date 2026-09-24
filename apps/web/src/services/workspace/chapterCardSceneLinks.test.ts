import {describe, expect, it} from 'vitest';
import type {ChapterCard, WritingDocument} from '../../entityTypes';
import {
  addSceneLink,
  deriveLinkedSceneTitle,
  findCardsForScene,
  removeSceneLink,
  resolveSceneLinks,
  toggleSceneLink
} from './chapterCardSceneLinks';

const card = (sceneIds?: string[]): ChapterCard => ({
  id: 'card-1', projectId: 'project-1', title: 'The Salt Door', summary: '',
  status: 'planned', order: 0, sceneIds, plotPoints: [], createdAt: 1, updatedAt: 1
});
const document = (id: string, title: string): WritingDocument => ({
  id, projectId: 'project-1', title, content: '', createdAt: 1, updatedAt: 1
});

describe('chapter card scene links', () => {
  it('derives the first and subsequent linked scene titles', () => {
    expect(deriveLinkedSceneTitle(card(), 0)).toBe('The Salt Door');
    expect(deriveLinkedSceneTitle(card(), 2)).toBe('The Salt Door — Scene 3');
    expect(deriveLinkedSceneTitle({...card(), title: '   '}, 0)).toBe('Untitled scene');
  });

  it('adds a link idempotently and preserves explicit order', () => {
    expect(addSceneLink(card(['scene-2', 'scene-1', 'scene-2']), 'scene-3'))
      .toEqual(['scene-2', 'scene-1', 'scene-3']);
    expect(addSceneLink(card(['scene-2', 'scene-1']), 'scene-1'))
      .toEqual(['scene-2', 'scene-1']);
  });

  it('toggles a link without changing unrelated ids', () => {
    expect(toggleSceneLink(card(['scene-2', 'scene-1']), 'scene-1')).toEqual(['scene-2']);
    expect(toggleSceneLink(card(['scene-2']), 'scene-1')).toEqual(['scene-2', 'scene-1']);
  });

  it('removes duplicate occurrences of only the requested id', () => {
    expect(removeSceneLink(card(['scene-1', 'scene-2', 'scene-1']), 'scene-1'))
      .toEqual(['scene-2']);
  });

  it('resolves unique linked scenes in card order and reports missing ids', () => {
    const result = resolveSceneLinks(
      card(['scene-2', 'missing', 'scene-1', 'scene-2']),
      [document('scene-1', 'First'), document('scene-2', 'Second')]
    );
    expect(result.linked.map((item) => item.id)).toEqual(['scene-2', 'scene-1']);
    expect(result.missingSceneIds).toEqual(['missing']);
  });

  it('finds every card linked by an explicit scene id only', () => {
    const cards = [
      card(['scene-1']),
      {...card(['scene-2', 'scene-1', 'scene-1']), id: 'card-2', title: 'Second'},
      {...card(), id: 'card-3', title: 'scene-1'}
    ];

    expect(findCardsForScene(cards, 'scene-1').map((item) => item.id))
      .toEqual(['card-1', 'card-2']);
    expect(findCardsForScene(cards, 'missing')).toEqual([]);
  });
});
