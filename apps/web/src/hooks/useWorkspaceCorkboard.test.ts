// @vitest-environment jsdom
import {act, renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ChapterCard} from '../entityTypes';
import {useWorkspaceCorkboard} from './useWorkspaceCorkboard';

const stored: ChapterCard[] = ['Arrival', 'Heist', 'Escape'].map((title, order) => ({
  id: title.toLowerCase(),
  projectId: 'p1',
  title,
  summary: '',
  status: 'planned',
  order,
  plotPoints: ['One', 'Two', 'Three'].map((pointTitle, pointOrder) => ({
    id: `${title}-${pointTitle}`.toLowerCase(),
    chapterCardId: title.toLowerCase(),
    title: pointTitle,
    order: pointOrder,
    createdAt: 0,
    updatedAt: 0
  })),
  createdAt: 0,
  updatedAt: 0
}));

vi.mock('../services/storage', () => ({
  getChapterCardsByProjectId: vi.fn(async () => structuredClone(stored)),
  saveChapterCard: vi.fn(async () => {}),
  deleteChapterCard: vi.fn(async () => {})
}));

describe('useWorkspaceCorkboard moves', () => {
  it('moves a card and a plot point, and the move survives normalizing', async () => {
    const {result} = renderHook(() => useWorkspaceCorkboard('p1'));
    await waitFor(() => expect(result.current.corkboardCards).toHaveLength(3));

    act(() => result.current.moveCorkboardCard('escape', -1));
    expect(result.current.corkboardCards.map((card) => card.title)).toEqual(['Arrival', 'Escape', 'Heist']);
    expect(result.current.corkboardCards.map((card) => card.order)).toEqual([0, 1, 2]);

    act(() => {
      result.current.moveCorkboardCard('heist', -1);
      result.current.moveCorkboardCard('heist', -1);
    });
    expect(result.current.corkboardCards.map((card) => card.title)).toEqual(['Heist', 'Arrival', 'Escape']);

    act(() => result.current.moveCorkboardPlotPoint('arrival', 'arrival-three', -1));
    expect(result.current.corkboardCards[1]!.plotPoints.map((point) => point.title)).toEqual(['One', 'Three', 'Two']);
  });
});
