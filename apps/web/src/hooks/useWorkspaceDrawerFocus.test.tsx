import {act, renderHook} from '@testing-library/react';
import type {PropsWithChildren} from 'react';
import {MemoryRouter} from 'react-router';
import {describe, expect, it, vi} from 'vitest';
import type {WritingDocument} from '../entityTypes';
import {useWorkspaceDrawerFocus} from './useWorkspaceDrawerFocus';

const scene: WritingDocument = {
  id: 'scene-1',
  projectId: 'project-1',
  title: 'The Ledgerbound',
  content: '<p>Her same green.</p>',
  createdAt: 1,
  updatedAt: 1
};

const wrapper = ({children}: PropsWithChildren) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useWorkspaceDrawerFocus', () => {
  it('focuses canon conflicts on their evidence instead of the related character', () => {
    const setActiveContextView = vi.fn();
    const {result} = renderHook(
      () =>
        useWorkspaceDrawerFocus({
          activeProjectId: 'project-1',
          selectedId: scene.id,
          documents: [scene],
          content: scene.content,
          editorScrollResetToken: 0,
          isContextDrawerOpen: true,
          handleSelectDocument: vi.fn(),
          setActiveContextView,
          setContextDrawerOpen: vi.fn()
        }),
      {wrapper}
    );

    act(() => {
      result.current.focusReviewItemInScene({
        id: 'conflict-1',
        sceneId: scene.id,
        issue: {
          focusText: 'Her same green',
          surface: undefined
        }
      });
    });

    expect(result.current.focusQuery).toBe('Her same green');
    expect(result.current.activeReviewItemId).toBe('conflict-1');
    expect(setActiveContextView).toHaveBeenCalledWith('review');
  });
});
