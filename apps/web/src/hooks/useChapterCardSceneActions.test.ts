// @vitest-environment jsdom
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ChapterCard, WritingDocument} from '../entityTypes';
import {useChapterCardSceneActions} from './useChapterCardSceneActions';

const card: ChapterCard = {
  id: 'card-a', projectId: 'project-a', title: 'The Salt Door', summary: '',
  status: 'planned', order: 0, sceneIds: ['scene-a'], plotPoints: [], createdAt: 1, updatedAt: 1
};
const document: WritingDocument = {
  id: 'scene-b', projectId: 'project-a', title: 'The Salt Door — Scene 2',
  content: '<p></p>', createdAt: 2, updatedAt: 2
};

describe('useChapterCardSceneActions', () => {
  it('creates through the supplied owner and links the returned document', async () => {
    const createDocument = vi.fn().mockResolvedValue(document);
    const updateCard = vi.fn().mockResolvedValue(undefined);
    const {result} = renderHook(() => useChapterCardSceneActions({createDocument, updateCard}));

    await act(async () => {
      await expect(result.current.createLinkedScene(card)).resolves.toEqual({document, linked: true});
    });
    expect(createDocument).toHaveBeenCalledWith({title: 'The Salt Door — Scene 2'});
    expect(updateCard).toHaveBeenCalledWith('card-a', ['scene-a', 'scene-b']);
  });

  it('keeps the scene after link failure and retries without creating another', async () => {
    const createDocument = vi.fn().mockResolvedValue(document);
    const updateCard = vi.fn()
      .mockRejectedValueOnce(new Error('storage failed'))
      .mockResolvedValueOnce(undefined);
    const {result} = renderHook(() => useChapterCardSceneActions({createDocument, updateCard}));

    await act(async () => {
      await expect(result.current.createLinkedScene(card)).resolves.toEqual({document, linked: false});
    });
    await act(async () => {
      await expect(result.current.retryLink(card, document)).resolves.toBe(true);
    });
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(updateCard).toHaveBeenCalledTimes(2);
  });

  it('does not link when scene creation fails', async () => {
    const createDocument = vi.fn().mockResolvedValue(null);
    const updateCard = vi.fn();
    const {result} = renderHook(() => useChapterCardSceneActions({createDocument, updateCard}));

    await act(async () => {
      await expect(result.current.createLinkedScene(card)).resolves.toEqual({document: null, linked: false});
    });
    expect(updateCard).not.toHaveBeenCalled();
  });
});
